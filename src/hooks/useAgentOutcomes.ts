import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aiAgentKeys } from '@/lib/query-keys';

export interface OutcomesKPIs {
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  click_rate: number;
  deals_progressed: number;
  deals_won: number;
  influenced_revenue: number;
}

export interface OutcomeRunRow {
  run_id: string;
  created_at: string;
  approved_at: string | null;
  scenario_label: string | null;
  execution_status: string;
  approval_status: string;
  opportunity_id: string | null;
  opportunity_title: string | null;
  opportunity_amount: number | null;
  email_subject: string | null;
  recipient_email: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  deal_progressed_at: string | null;
  deal_won_at: string | null;
  // AI intent transparency
  ai_should_act: boolean | null;
  forced_to_draft: boolean;
  original_should_act: boolean | null;
  ai_reasoning: string | null;
  skip_reason: string | null;
  // Email send metadata
  was_human_edited: boolean;
  send_attempts: number;
}

export function useAgentOutcomes(agentId: string | undefined, rangeDays = 30) {
  return useQuery({
    queryKey: aiAgentKeys.outcomes(agentId, rangeDays),
    enabled: !!agentId,
    queryFn: async (): Promise<{ kpis: OutcomesKPIs; runs: OutcomeRunRow[] }> => {
      const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();

      // Fetch recent runs for this agent
      const { data: runs, error: runsErr } = await supabase
        .from('ai_agent_execution_runs')
        .select(`
          id, created_at, scenario_label, execution_status, approval_status, entity_id
        `)
        .eq('agent_id', agentId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (runsErr) throw runsErr;

      const runIds = (runs || []).map(r => r.id);
      const oppIds = Array.from(new Set((runs || []).map(r => r.entity_id).filter(Boolean)));

      // Fetch outcomes
      const { data: outcomes } = runIds.length
        ? await supabase
            .from('ai_agent_run_outcomes')
            .select('run_id, email_message_id, opportunity_id, email_sent_at, opened_at, clicked_at, replied_at, bounced_at, deal_progressed_at, deal_won_at, deal_lost_at')
            .in('run_id', runIds)
        : { data: [] as any[] };

      // Fetch opportunity meta
      const { data: opps } = oppIds.length
        ? await supabase
            .from('opportunities')
            .select('id, title, amount')
            .in('id', oppIds as string[])
        : { data: [] as any[] };

      // Fetch emails
      const messageIds = (outcomes || []).map((o: any) => o.email_message_id).filter(Boolean);
      const { data: emails } = messageIds.length
        ? await supabase
            .from('ai_email_messages')
            .select('id, subject, recipient_email')
            .in('id', messageIds as string[])
        : { data: [] as any[] };

      const emailById = new Map((emails || []).map((e: any) => [e.id, e]));
      const oppById = new Map((opps || []).map((o: any) => [o.id, o]));
      const outcomeByRun = new Map((outcomes || []).map((o: any) => [o.run_id, o]));

      const rows: OutcomeRunRow[] = (runs || []).map((r: any) => {
        const o: any = outcomeByRun.get(r.id) || {};
        const e: any = o.email_message_id ? emailById.get(o.email_message_id) : null;
        const opp: any = oppById.get(r.entity_id);
        return {
          run_id: r.id,
          created_at: r.created_at,
          scenario_label: r.scenario_label,
          execution_status: r.execution_status,
          approval_status: r.approval_status,
          opportunity_id: r.entity_id,
          opportunity_title: opp?.title ?? null,
          opportunity_amount: opp?.amount ?? null,
          email_subject: e?.subject ?? null,
          recipient_email: e?.recipient_email ?? null,
          email_sent_at: o.email_sent_at ?? null,
          opened_at: o.opened_at ?? null,
          clicked_at: o.clicked_at ?? null,
          replied_at: o.replied_at ?? null,
          deal_progressed_at: o.deal_progressed_at ?? null,
          deal_won_at: o.deal_won_at ?? null,
        };
      });

      const sent = rows.filter(r => r.email_sent_at).length;
      const opened = rows.filter(r => r.opened_at).length;
      const clicked = rows.filter(r => r.clicked_at).length;
      const replied = rows.filter(r => r.replied_at).length;
      const progressed = rows.filter(r => r.deal_progressed_at).length;
      const won = rows.filter(r => r.deal_won_at).length;
      const influenced_revenue = rows
        .filter(r => r.deal_won_at)
        .reduce((sum, r) => sum + (r.opportunity_amount || 0), 0);

      const kpis: OutcomesKPIs = {
        emails_sent: sent,
        open_rate: sent ? opened / sent : 0,
        reply_rate: sent ? replied / sent : 0,
        click_rate: sent ? clicked / sent : 0,
        deals_progressed: progressed,
        deals_won: won,
        influenced_revenue,
      };

      return { kpis, runs: rows };
    },
  });
}
