import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';

export interface OTESalesRecordItem {
  id: string;
  ote_sales_record_id: string;
  product_id?: string | null;
  product_name?: string | null;
  billing_type?: string | null;
  quantity?: number | null;
  line_amount: number;
  mrr_amount: number;
  one_shot_amount: number;
  counts_toward_goal: boolean;
  exclusion_reason?: string | null;
}

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
  eligible_amount?: number | null;
  non_eligible_amount?: number | null;
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
  items?: OTESalesRecordItem[];
}

/**
 * Detalhe transparente das vendas/leads qualificados que compõem o OTE,
 * incluindo a quebra por item (produto/serviço) com flag counts_toward_goal.
 */
export function useOTESalesRecords(resultIds: string[]) {
  const { organization } = useCurrentOrganization();
  const ids = [...resultIds].sort();

  return useQuery({
    queryKey: ['ote-sales-records', organization?.id, ids],
    enabled: !!organization?.id && ids.length > 0,
    queryFn: async (): Promise<OTESalesRecord[]> => {
      const { data: records, error } = await supabase
        .from('ote_sales_records')
        .select('*')
        .eq('organization_id', organization!.id)
        .in('ote_result_id', ids)
        .order('closed_at', { ascending: false });
      if (error) throw error;

      const recordList = (records || []) as OTESalesRecord[];
      if (recordList.length === 0) return recordList;

      const recordIds = recordList.map((r) => r.id);
      const { data: itemRows, error: itemsErr } = await supabase
        .from('ote_sales_record_items' as any)
        .select('*')
        .in('ote_sales_record_id', recordIds);

      if (itemsErr) {
        // Tabela pode estar vazia para resultados antigos; não bloquear.
        console.warn('[useOTESalesRecords] items fetch failed:', itemsErr);
        return recordList;
      }

      const byRecord = new Map<string, OTESalesRecordItem[]>();
      for (const it of (itemRows || []) as any[]) {
        const arr = byRecord.get(it.ote_sales_record_id) || [];
        arr.push(it as OTESalesRecordItem);
        byRecord.set(it.ote_sales_record_id, arr);
      }
      return recordList.map((r) => ({ ...r, items: byRecord.get(r.id) || [] }));
    },
  });
}
