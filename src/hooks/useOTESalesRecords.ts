import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface OTESalesRecord {
  id: string;
  organization_id: string;
  ote_result_id: string;
  opportunity_id?: string | null;
  proposal_id?: string | null;
  proposal_number?: string | null;
  client_name: string;
  sale_value: number;
  mrr_amount: number;
  one_shot_amount: number;
  sale_date: string;
  closed_at?: string | null;
  pipeline_id?: string | null;
  pipeline_name?: string | null;
  payment_status: string;
  counts_toward_goal: boolean;
  exclusion_reason?: string | null;
  record_kind: 'sale' | 'qualified_lead';
  revenue_confidence?: string | null;
  observations?: string | null;
}

/**
 * Detalhe transparente das vendas/leads qualificados que compõem o OTE.
 * Filtra por períodos (resultIds) já carregados na tela.
 */
export function useOTESalesRecords(resultIds: string[]) {
  const { organization } = useCurrentOrganization();
  const ids = [...resultIds].sort();

  return useQuery({
    queryKey: ['ote-sales-records', organization?.id, ids],
    enabled: !!organization?.id && ids.length > 0,
    queryFn: async (): Promise<OTESalesRecord[]> => {
      const { data, error } = await supabase
        .from('ote_sales_records')
        .select('*')
        .eq('organization_id', organization!.id)
        .in('ote_result_id', ids)
        .order('closed_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OTESalesRecord[];
    },
  });
}
