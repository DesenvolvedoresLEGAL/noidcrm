import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aiAgentKeys, crmTimelineKeys } from '@/lib/query-keys';

export interface HallucinationWarning {
  flag: string; // 'possible_hallucination' | 'unverifiable_metric' | 'possible_hallucination_and_metric' | 'style_violation' | combinations
  suspicious_terms?: string[];
  unverifiable_metrics?: string[];
  style_violations?: Array<{ kind: string; match: string; hint?: string }>;
  style_summary?: string;
  reason?: string;
  brief_signature?: string;
  detected_at?: string;
}

export interface PendingApproval {
  id: string;
  run_id: string;
  agent_id: string;
  status: string; // 'pending' | 'send_failed'
  approval_type: string;
  requested_at: string;
  organization_id: string;
  rejection_reason?: string | null;
  agent: { name: string } | null;
  email: {
    id: string;
    subject: string;
    body_html: string | null;
    body_text: string | null;
    recipient_email: string;
    recipient_name: string | null;
    preview_text: string | null;
    scheduled_send_at: string | null;
    send_status?: string | null;
    send_failure_reason?: string | null;
    send_attempts?: number | null;
    validation_warnings_json?: HallucinationWarning | null;
  } | null;
  run: {
    id: string;
    decision_json: any;
    scenario_label: string | null;
    output_preview_json: any;
    validation_warnings_json?: HallucinationWarning | null;
    brief_signature?: string | null;
    context_snapshot_json?: any;
  } | null;
}

/**
 * Single source of truth: calls the SECURITY DEFINER RPC
 * `get_opportunity_pending_approvals` so the opportunity UI and the global
 * approvals queue always agree on what's pending. Resolves the opportunity
 * link deterministically on the backend (denormalized opportunity_id,
 * context snapshot, entity reference, OR email row).
 */
async function fetchOpportunityApprovals(opportunityId: string): Promise<PendingApproval[]> {
  const { data, error } = await supabase.rpc('get_opportunity_pending_approvals', {
    p_opportunity_id: opportunityId,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    run_id: row.run_id,
    agent_id: row.agent_id,
    status: row.status,
    approval_type: row.approval_type,
    requested_at: row.requested_at,
    organization_id: row.organization_id,
    rejection_reason: row.rejection_reason,
    agent: row.agent_name ? { name: row.agent_name } : null,
    email: row.email_id
      ? {
          id: row.email_id,
          subject: row.email_subject,
          body_html: row.email_body_html,
          body_text: row.email_body_text,
          recipient_email: row.email_recipient_email,
          recipient_name: row.email_recipient_name,
          preview_text: row.email_preview_text,
          scheduled_send_at: row.email_scheduled_send_at,
          send_status: row.email_send_status,
          send_failure_reason: row.email_send_failure_reason,
          send_attempts: row.email_send_attempts,
          validation_warnings_json: row.email_validation_warnings_json ?? null,
        }
      : null,
    run: row.run_id
      ? {
          id: row.run_id,
          decision_json: row.run_decision_json,
          scenario_label: row.run_scenario_label,
          output_preview_json: row.run_output_preview_json,
          validation_warnings_json: row.run_validation_warnings_json ?? null,
          brief_signature: row.run_brief_signature ?? null,
          context_snapshot_json: row.run_context_snapshot_json ?? null,
        }
      : null,
  }));
}

export function useOpportunityApprovals(opportunityId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: aiAgentKeys.opportunityApprovals(opportunityId),
    queryFn: () => fetchOpportunityApprovals(opportunityId!),
    enabled: !!opportunityId,
    // Sem refetchInterval: realtime abaixo já invalida em mudanças (audit Fase 1A).
  });


  // Realtime: any change in the approval/run/email tables refreshes the
  // opportunity surfaces immediately (no hard refresh needed).
  useEffect(() => {
    if (!opportunityId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.opportunityApprovals(opportunityId) });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueAll() });
      queryClient.invalidateQueries({ queryKey: aiAgentKeys.approvalQueueCountAll() });
      queryClient.invalidateQueries({ queryKey: crmTimelineKeys.enhanced(opportunityId) });
      queryClient.invalidateQueries({ queryKey: crmTimelineKeys.unifiedAll() });
    };
    const channel = supabase
      .channel(`opp-approvals-${opportunityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_approval_queue' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_execution_runs' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_email_messages' }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [opportunityId, queryClient]);

  return query;
}
