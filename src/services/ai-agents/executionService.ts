import { supabase } from '@/integrations/supabase/client';

export const executionService = {
  async executeRun(runId: string) {
    const { data, error } = await supabase.functions.invoke('execute-email-agent-run', {
      body: { run_id: runId },
    });
    if (error) throw error;
    return data;
  },

  async approveAction(queueId: string, edits?: { edited_subject?: string; edited_body_html?: string; edited_body_text?: string; approval_reason?: string }) {
    const { data, error } = await supabase.functions.invoke('approve-email-agent-action', {
      body: { queue_id: queueId, ...edits },
    });
    if (error) throw error;
    return data;
  },

  async rejectAction(queueId: string, rejectionReason?: string) {
    const { data, error } = await supabase.functions.invoke('reject-email-agent-action', {
      body: { queue_id: queueId, rejection_reason: rejectionReason },
    });
    if (error) throw error;
    return data;
  },

  async listExecutionRuns(orgId: string, filters?: { agentId?: string; status?: string; limit?: number }) {
    let query = supabase
      .from('ai_agent_execution_runs')
      .select('*, ai_agents(name), ai_agent_versions(version_number)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 50);

    if (filters?.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters?.status) query = query.eq('execution_status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getApprovalQueue(orgId: string) {
    const { data, error } = await supabase
      .from('ai_agent_approval_queue')
      .select('*, ai_agents(name), ai_email_messages(subject, recipient_email, body_html, body_text), ai_agent_execution_runs(decision_json, context_snapshot_json, output_preview_json, scenario_label)')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getRunDetails(runId: string) {
    const { data: run, error: runErr } = await supabase
      .from('ai_agent_execution_runs')
      .select('*, ai_agents(name, slug), ai_agent_versions(version_number)')
      .eq('id', runId)
      .single();
    if (runErr) throw runErr;

    const { data: actions } = await supabase
      .from('ai_agent_execution_actions')
      .select('*')
      .eq('run_id', runId)
      .order('created_at');

    const { data: emails } = await supabase
      .from('ai_email_messages')
      .select('*')
      .eq('run_id', runId);

    const { data: deliveryEvents } = await supabase
      .from('ai_email_delivery_events')
      .select('*')
      .in('email_message_id', (emails || []).map(e => e.id))
      .order('event_at');

    const { data: impacts } = await supabase
      .from('ai_agent_impact_events')
      .select('*')
      .eq('run_id', runId)
      .order('observed_at');

    return { run, actions: actions || [], emails: emails || [], deliveryEvents: deliveryEvents || [], impacts: impacts || [] };
  },
};
