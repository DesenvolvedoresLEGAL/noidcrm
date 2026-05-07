import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from '@/hooks/useWinLossData';

export interface ProposalApprovalEntry {
  id: string;
  status: 'accepted' | 'declined' | 'expired' | string;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at: string | null;
  declined_reason: string | null;
  acceptor_name: string | null;
  acceptor_email: string | null;
  acceptor_position: string | null;
  acceptor_phone: string | null;
  acceptor_ip: string | null;
  proposal_number: string | null;
  total_value: number | null;
  opportunity_id: string;
  opportunity_title: string;
  opportunity_value: number;
  pipeline_id: string;
  owner_user_id: string | null;
  owner_name: string;
  // win/loss enrichment (when available)
  win_reason_name?: string;
  key_differentiators?: string[];
  customer_feedback?: string;
  loss_reason_name?: string;
  loss_reason_category?: string;
  competitor?: string;
}

export function useProposalApprovalsHistory(
  organizationId: string | undefined,
  dateRange: DateRange,
  pipelineId: string | null
) {
  return useQuery({
    queryKey: ['proposal-approvals-history', organizationId, pipelineId, dateRange.from.getTime(), dateRange.to.getTime()],
    enabled: !!organizationId,
    queryFn: async (): Promise<ProposalApprovalEntry[]> => {
      if (!organizationId) return [];

      const fromISO = dateRange.from.toISOString();
      const toISO = dateRange.to.toISOString();

      // Resolve pipeline ids (sales pipelines if none specified)
      let pipelineIds: string[] = [];
      if (pipelineId) pipelineIds = [pipelineId];
      else {
        const { data: pipes } = await supabase
          .from('pipelines')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('pipeline_type', 'sales');
        pipelineIds = pipes?.map(p => p.id) || [];
      }
      if (pipelineIds.length === 0) return [];

      // Fetch proposals with terminal states in window
      const { data: props, error } = await supabase
        .from('proposals')
        .select(`
          id, status, accepted_at, declined_at, expires_at, declined_reason,
          acceptor_name, acceptor_email, acceptor_position, acceptor_phone, acceptor_ip,
          proposal_number, total_value, opportunity_id,
          opportunity:opportunities!inner(id, title, valor_previsto, pipeline_id, owner_user_id, organization_id)
        `)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .in('status', ['accepted', 'declined', 'expired'])
        .or(`accepted_at.gte.${fromISO},declined_at.gte.${fromISO},expires_at.gte.${fromISO}`)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('[useProposalApprovalsHistory]', error);
        throw error;
      }

      const filtered = (props || []).filter((p: any) => {
        if (!pipelineIds.includes(p.opportunity?.pipeline_id)) return false;
        const ts = p.accepted_at || p.declined_at || p.expires_at;
        if (!ts) return false;
        const d = new Date(ts);
        return d >= dateRange.from && d <= dateRange.to;
      });

      const oppIds = [...new Set(filtered.map((p: any) => p.opportunity_id))];
      const ownerIds = [...new Set(filtered.map((p: any) => p.opportunity?.owner_user_id).filter(Boolean))];

      // Enrichment: win/loss records by opportunity
      const wlMap = new Map<string, any>();
      if (oppIds.length > 0) {
        const { data: records } = await supabase
          .from('win_loss_records')
          .select(`
            opportunity_id, outcome, win_reason_id, key_differentiator, customer_feedback, competitor,
            loss_reason:loss_reasons!win_loss_records_reason_id_fkey(name, category)
          `)
          .in('opportunity_id', oppIds);
        records?.forEach(r => wlMap.set(r.opportunity_id, r));
      }

      const winReasonIds = [...new Set([...wlMap.values()].map(r => r.win_reason_id).filter(Boolean))] as string[];
      const winReasonNames = new Map<string, string>();
      if (winReasonIds.length > 0) {
        const { data: wr } = await supabase.from('win_reasons').select('id, name').in('id', winReasonIds);
        wr?.forEach(w => winReasonNames.set(w.id, w.name));
      }

      const profileMap = new Map<string, string>();
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', ownerIds as string[]);
        profiles?.forEach(p => profileMap.set(p.user_id, p.full_name || 'Sem nome'));
      }

      return filtered.map((p: any) => {
        const opp = p.opportunity;
        const wl = wlMap.get(p.opportunity_id);
        return {
          id: p.id,
          status: p.status,
          accepted_at: p.accepted_at,
          declined_at: p.declined_at,
          expires_at: p.expires_at,
          declined_reason: p.declined_reason,
          acceptor_name: p.acceptor_name,
          acceptor_email: p.acceptor_email,
          acceptor_position: p.acceptor_position,
          acceptor_phone: p.acceptor_phone,
          acceptor_ip: p.acceptor_ip,
          proposal_number: p.proposal_number,
          total_value: p.total_value,
          opportunity_id: opp.id,
          opportunity_title: opp.title,
          opportunity_value: opp.valor_previsto || 0,
          pipeline_id: opp.pipeline_id,
          owner_user_id: opp.owner_user_id,
          owner_name: opp.owner_user_id ? (profileMap.get(opp.owner_user_id) || '—') : '—',
          win_reason_name: wl?.win_reason_id ? winReasonNames.get(wl.win_reason_id) : undefined,
          key_differentiators: wl?.key_differentiator
            ? String(wl.key_differentiator).split(',').map((s: string) => s.trim()).filter(Boolean)
            : undefined,
          customer_feedback: wl?.customer_feedback || undefined,
          loss_reason_name: (wl?.loss_reason as any)?.name,
          loss_reason_category: (wl?.loss_reason as any)?.category,
          competitor: wl?.competitor,
        };
      });
    },
    staleTime: 60_000,
  });
}
