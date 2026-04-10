import { supabase } from "@/integrations/supabase/client";

export interface MetricsFilters {
  agent_id: string;
  date_from?: string;
  date_to?: string;
  pipeline_id?: string;
  stage_id?: string;
  cadence_policy_id?: string;
}

export async function fetchDailyMetrics(filters: MetricsFilters) {
  let query = supabase
    .from("ai_email_agent_metrics_daily")
    .select("*")
    .eq("agent_id", filters.agent_id)
    .order("metric_date", { ascending: false });

  if (filters.date_from) query = query.gte("metric_date", filters.date_from);
  if (filters.date_to) query = query.lte("metric_date", filters.date_to);
  if (filters.pipeline_id) query = query.eq("pipeline_id", filters.pipeline_id);
  if (filters.stage_id) query = query.eq("stage_id", filters.stage_id);
  if (filters.cadence_policy_id) query = query.eq("cadence_policy_id", filters.cadence_policy_id);

  const { data, error } = await query.limit(365);
  if (error) throw error;
  return data;
}

export async function fetchMetricsSummary(filters: MetricsFilters) {
  const data = await fetchDailyMetrics(filters);
  if (!data || data.length === 0) return null;

  const totals = data.reduce((acc, row) => ({
    emails_generated: acc.emails_generated + (row.emails_generated || 0),
    emails_sent: acc.emails_sent + (row.emails_sent || 0),
    emails_approved: acc.emails_approved + (row.emails_approved || 0),
    emails_rejected: acc.emails_rejected + (row.emails_rejected || 0),
    emails_opened: acc.emails_opened + (row.emails_opened || 0),
    emails_replied: acc.emails_replied + (row.emails_replied || 0),
    bounced: acc.bounced + (row.bounced || 0),
    opportunities_advanced: acc.opportunities_advanced + (row.opportunities_advanced || 0),
    opportunities_reactivated: acc.opportunities_reactivated + (row.opportunities_reactivated || 0),
    influenced_deals: acc.influenced_deals + (row.influenced_deals || 0),
    cooldown_blocks: acc.cooldown_blocks + (row.cooldown_blocks || 0),
    policy_blocks: acc.policy_blocks + (row.policy_blocks || 0),
    approval_waits: acc.approval_waits + (row.approval_waits || 0),
    human_edits: acc.human_edits + (row.human_edits || 0),
    estimated_cost: acc.estimated_cost + Number(row.estimated_cost || 0),
  }), {
    emails_generated: 0, emails_sent: 0, emails_approved: 0, emails_rejected: 0,
    emails_opened: 0, emails_replied: 0, bounced: 0,
    opportunities_advanced: 0, opportunities_reactivated: 0, influenced_deals: 0,
    cooldown_blocks: 0, policy_blocks: 0, approval_waits: 0, human_edits: 0,
    estimated_cost: 0,
  });

  return {
    ...totals,
    open_rate: totals.emails_sent > 0 ? (totals.emails_opened / totals.emails_sent * 100) : 0,
    reply_rate: totals.emails_sent > 0 ? (totals.emails_replied / totals.emails_sent * 100) : 0,
    bounce_rate: totals.emails_sent > 0 ? (totals.bounced / totals.emails_sent * 100) : 0,
    advance_rate: totals.emails_sent > 0 ? (totals.opportunities_advanced / totals.emails_sent * 100) : 0,
    cooldown_block_rate: totals.emails_generated > 0 ? (totals.cooldown_blocks / totals.emails_generated * 100) : 0,
    human_edit_rate: totals.emails_approved > 0 ? (totals.human_edits / totals.emails_approved * 100) : 0,
    cost_per_sent: totals.emails_sent > 0 ? (totals.estimated_cost / totals.emails_sent) : 0,
    cost_per_reply: totals.emails_replied > 0 ? (totals.estimated_cost / totals.emails_replied) : 0,
    days: data.length,
  };
}

export async function fetchOutcomes(filters: { agent_id: string; limit?: number; outcome_type?: string }) {
  let query = supabase
    .from("ai_email_agent_outcomes")
    .select("*")
    .eq("agent_id", filters.agent_id)
    .order("observed_at", { ascending: false });

  if (filters.outcome_type) query = query.eq("outcome_type", filters.outcome_type);

  const { data, error } = await query.limit(filters.limit || 100);
  if (error) throw error;
  return data;
}
