import { supabase } from '@/integrations/supabase/client';

export type RFMSegment =
  | 'campeao'
  | 'vip'
  | 'leal'
  | 'promissor'
  | 'novo_cliente'
  | 'precisa_atencao'
  | 'em_risco'
  | 'hibernando'
  | 'perdido';

export const RFM_SEGMENT_LABEL: Record<RFMSegment, string> = {
  campeao: 'Campeão',
  vip: 'VIP',
  leal: 'Leal',
  promissor: 'Promissor',
  novo_cliente: 'Novo cliente',
  precisa_atencao: 'Precisa de atenção',
  em_risco: 'Em risco',
  hibernando: 'Hibernando',
  perdido: 'Perdido',
};

export const RFM_SEGMENTS: RFMSegment[] = [
  'campeao',
  'vip',
  'leal',
  'promissor',
  'novo_cliente',
  'precisa_atencao',
  'em_risco',
  'hibernando',
  'perdido',
];

export interface RFMOverview {
  clientes_analisados: number;
  receita_total: number;
  ticket_medio: number;
  score_rfm_medio: number;
  campeoes: number;
  vip: number;
  leais: number;
  em_risco: number;
  hibernando: number;
  perdidos: number;
}

export interface RFMSegmentRow {
  segment: RFMSegment;
  count: number;
  revenue: number;
  avg_ticket: number;
  percent: number;
  action: string;
}

export interface RFMAccountRow {
  account_id: string;
  account_name: string | null;
  last_won_date: string | null;
  won_count: number;
  total_revenue: number;
  avg_ticket: number;
  recency_days: number | null;
  r_score: number;
  f_score: number;
  m_score: number;
  rfm_score: number;
  rfm_segment: RFMSegment;
  suggested_action: string | null;
  owner_id: string | null;
  owner_name: string | null;
}

export interface RFMIntelligence {
  overview: RFMOverview;
  segments: RFMSegmentRow[];
  accounts: RFMAccountRow[];
  recommended_actions: Record<RFMSegment, string>;
}

export interface RFMQueryParams {
  organizationId: string;
  periodStart: string; // yyyy-mm-dd
  periodEnd: string;
  ownerId?: string | null;
  segment?: RFMSegment | null;
  search?: string | null;
}

export async function getAccountRFMIntelligence(p: RFMQueryParams): Promise<RFMIntelligence> {
  const { data, error } = await supabase.rpc('get_account_rfm_intelligence' as any, {
    p_organization_id: p.organizationId,
    p_period_start: p.periodStart,
    p_period_end: p.periodEnd,
    p_owner_id: p.ownerId ?? null,
    p_segment: p.segment ?? null,
    p_search: p.search ?? null,
  });
  if (error) throw error;
  return data as unknown as RFMIntelligence;
}

export async function recalculateAccountRFM(p: {
  organizationId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('recalculate_account_rfm' as any, {
    p_organization_id: p.organizationId,
    p_period_start: p.periodStart,
    p_period_end: p.periodEnd,
  });
  if (error) throw error;
  const payload = (data ?? null) as { success?: boolean; processed_accounts?: number } | number | null;
  if (typeof payload === 'number') return payload;
  return Number(payload?.processed_accounts ?? 0);
}
