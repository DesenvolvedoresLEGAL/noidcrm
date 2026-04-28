import { supabase } from '@/integrations/supabase/client';
import type { CloserDashboardData, CloserPeriodKey } from '@/types/dashboard/closer';

export interface CloserDashboardParams {
  tenantId: string;
  userId: string;
  period: CloserPeriodKey;
  startDate?: string;
  endDate?: string;
}

export async function getCloserDashboardData(
  params: CloserDashboardParams,
): Promise<CloserDashboardData> {
  const { data, error } = await supabase.rpc('crm_get_closer_dashboard_data' as any, {
    p_tenant_id: params.tenantId,
    p_user_id: params.userId,
    p_period: params.period,
    p_start_date: params.startDate ?? null,
    p_end_date: params.endDate ?? null,
  });
  if (error) throw error;
  return data as unknown as CloserDashboardData;
}
