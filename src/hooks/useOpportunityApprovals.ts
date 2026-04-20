import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingApproval {
  id: string;
  run_id: string;
  agent_id: string;
  status: string;
  approval_type: string;
  requested_at: string;
  organization_id: string;
  agent: { name: string } | null;
  email: {
    id: string;
    subject: string;
    body_html: string | null;
    body_text: string | null;
    recipient_email: string;
    recipient_name: string | null;
    preview_text: string | null;
  } | null;
  run: {
    id: string;
    decision_json: any;
    scenario_label: string | null;
    output_preview_json: any;
  } | null;
}

/**
 * Resilient lookup: finds any pending approval whose run is bound to the given opportunity,
 * via any of these signals (resilient to denormalization gaps):
 *   1) ai_agent_execution_runs.opportunity_id = X
 *   2) ai_agent_execution_runs.entity_type='opportunity' AND entity_id = X
 *   3) ai_email_messages.opportunity_id = X
 */
async function fetchOpportunityApprovals(opportunityId: string): Promise<PendingApproval[]> {
  // 1+2) Runs by opportunity_id OR entity match
  const { data: runsByOpp, error: r1 } = await supabase
    .from('ai_agent_execution_runs')
    .select('id, decision_json, scenario_label, output_preview_json, organization_id, opportunity_id, entity_type, entity_id')
    .or(`opportunity_id.eq.${opportunityId},and(entity_type.eq.opportunity,entity_id.eq.${opportunityId})`);
  if (r1) throw r1;

  // 3) Runs reachable via ai_email_messages.opportunity_id
  const { data: emailsByOpp, error: r2 } = await supabase
    .from('ai_email_messages')
    .select('run_id')
    .eq('opportunity_id', opportunityId);
  if (r2) throw r2;

  const runIdSet = new Set<string>();
  (runsByOpp || []).forEach(r => runIdSet.add(r.id));
  (emailsByOpp || []).forEach(e => e.run_id && runIdSet.add(e.run_id));
  if (runIdSet.size === 0) return [];

  const runIds = Array.from(runIdSet);

  // Hydrate any runs we found only via emails
  let runMap = new Map((runsByOpp || []).map(r => [r.id, r]));
  const missing = runIds.filter(id => !runMap.has(id));
  if (missing.length > 0) {
    const { data: extra } = await supabase
      .from('ai_agent_execution_runs')
      .select('id, decision_json, scenario_label, output_preview_json, organization_id, opportunity_id, entity_type, entity_id')
      .in('id', missing);
    (extra || []).forEach(r => runMap.set(r.id, r));
  }

  const { data: queue, error: qErr } = await supabase
    .from('ai_agent_approval_queue')
    .select('id, run_id, agent_id, status, approval_type, requested_at, organization_id, ai_agents(name)')
    .in('run_id', runIds)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (qErr) throw qErr;
  if (!queue || queue.length === 0) return [];

  const { data: emails } = await supabase
    .from('ai_email_messages')
    .select('id, run_id, subject, body_html, body_text, recipient_email, recipient_name, preview_text')
    .in('run_id', queue.map(q => q.run_id));

  const emailByRun = new Map((emails || []).map(e => [e.run_id, e]));

  return queue.map((q: any) => ({
    id: q.id,
    run_id: q.run_id,
    agent_id: q.agent_id,
    status: q.status,
    approval_type: q.approval_type,
    requested_at: q.requested_at,
    organization_id: q.organization_id,
    agent: q.ai_agents ? { name: q.ai_agents.name } : null,
    email: (emailByRun.get(q.run_id) as any) || null,
    run: (runMap.get(q.run_id) as any) || null,
  }));
}

export function useOpportunityApprovals(opportunityId: string | undefined) {
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['opportunity-approvals', opportunityId],
    queryFn: () => fetchOpportunityApprovals(opportunityId!),
    enabled: !!opportunityId,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setOrgId(query.data[0].organization_id);
    }
  }, [query.data]);

  // Realtime subscription
  useEffect(() => {
    if (!opportunityId) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-approvals', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-timeline', opportunityId] });
    };
    const channel = supabase
      .channel(`opp-approvals-${opportunityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_approval_queue' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_execution_runs' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_email_messages' }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [opportunityId, queryClient, orgId]);

  return query;
}
