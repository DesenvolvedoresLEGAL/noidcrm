import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';

export interface ProductSoldRow {
  product_key: string;
  product_id: string | null;
  name: string;
  billing_type: string;
  sales_count: number;
  proposals_count: number;
  total_quantity: number;
  total_revenue: number;
  avg_ticket: number;
  share_pct: number;
  first_sold: string | null;
  last_sold: string | null;
}

export interface ProductMonthlyRow {
  product_key: string;
  name: string;
  month: string;
  sales_count: number;
  total_revenue: number;
}

export interface ProductCrossRow {
  dimension: 'closer' | 'account' | 'pipeline';
  product_key: string;
  product_name: string;
  entity_id: string | null;
  entity_name: string | null;
  sales_count: number;
  total_revenue: number;
}

function buildArgs(filters: ReturnType<typeof useReportFiltersContext>) {
  const { effectiveDates, filters: f } = filters;
  return {
    p_start: effectiveDates.startDate,
    p_end: effectiveDates.endDate,
    p_pipelines: f.pipelines && f.pipelines.length > 0 ? f.pipelines : null,
    p_users: f.users && f.users !== 'all' ? [f.users] : null,
  };
}

export function useProductsSold() {
  const ctx = useReportFiltersContext();
  const args = buildArgs(ctx);
  return useQuery({
    queryKey: ['products-report', 'sold', args],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_products_sold', args as any);
      if (error) throw error;
      return (data || []) as ProductSoldRow[];
    },
    staleTime: 60_000,
  });
}

export function useProductsMonthly(topN = 5) {
  const ctx = useReportFiltersContext();
  const args = { ...buildArgs(ctx), p_top_n: topN };
  return useQuery({
    queryKey: ['products-report', 'monthly', args],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_products_monthly', args as any);
      if (error) throw error;
      return (data || []) as ProductMonthlyRow[];
    },
    staleTime: 60_000,
  });
}

export function useProductsCross() {
  const ctx = useReportFiltersContext();
  const args = buildArgs(ctx);
  return useQuery({
    queryKey: ['products-report', 'cross', args],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_products_cross', args as any);
      if (error) throw error;
      return (data || []) as ProductCrossRow[];
    },
    staleTime: 60_000,
  });
}
