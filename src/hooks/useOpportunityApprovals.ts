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

async function fetchOpportunityApprovals(opportunityId: string): Promise<PendingApproval[]> {
  const { data: runs, error: runsErr } = await supabase
    .from('ai_agent_execution_runs')
    .select('id, decision_json, scenario_label, output_preview_json')
    .eq('opportunity_id', opportunityId);

  if (runsErr) throw runsErr;
  const runIds = (runs || []).map(r => r.id);
  if (runIds.length === 0) return [];

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
  const runById = new Map((runs || []).map(r => [r.id, r]));

  return queue.map((q: any) => ({
    id: q.id,
    run_id: q.run_id,
    agent_id: q.agent_id,
    status: q.status,
    approval_type: q.approval_type,
    requested_at: q.requested_at,
    organization_id: q.organization_id,
    agent: q.ai_agents ? { name: q.ai_agents.name } : null,
    email: emailByRun.get(q.run_id) as any || null,
    run: runById.get(q.run_id) as any || null,
  }));
}

export function useOpportunityApprovals(opportunityId: string | undefined) {
  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['opportunity-approvals', opportunityId],
    queryFn: () => fetchOpportunityApprovals(opportunityId!),
    enabled: !!opportunityId,
    refetchInterval: 30000,
  });

  // Capture org id for realtime filter
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setOrgId(query.data[0].organization_id);
    }
  }, [query.data]);

  // Realtime subscription
  useEffect(() => {
    if (!opportunityId) return;
    const channel = supabase
      .channel(`opp-approvals-${opportunityId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_agent_approval_queue' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['opportunity-approvals', opportunityId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opportunityId, queryClient, orgId]);

  return query;
}
