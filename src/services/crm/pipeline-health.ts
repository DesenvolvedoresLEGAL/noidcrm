import { supabase } from '@/integrations/supabase/client';

export interface PipelineHealthMetrics {
  pipeline_id: string;
  pipeline_name: string;
  stage_id: string;
  stage_name: string;
  order_index: number;
  probability: number;
  organization_id: string;
  deal_count: number;
  total_value: number;
  weighted_value: number;
  avg_age_days: number;
  stale_deals: number;
  won_deals: number;
  lost_deals: number;
}

export interface PipelineHealthSummary {
  pipeline_id: string;
  pipeline_name: string;
  total_deals: number;
  total_value: number;
  weighted_forecast: number;
  avg_age_days: number;
  stale_deals_count: number;
  win_rate: number;
  stages: PipelineHealthMetrics[];
}

export async function getPipelineHealth(pipelineId?: string): Promise<PipelineHealthMetrics[]> {
  let query = supabase
    .from('pipeline_health')
    .select('*');

  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId);
  }

  const { data, error } = await query.order('pipeline_id').order('order_index');

  if (error) throw error;
  return data as PipelineHealthMetrics[];
}

export async function getPipelineHealthSummary(pipelineId: string): Promise<PipelineHealthSummary> {
  const metrics = await getPipelineHealth(pipelineId);
  
  if (metrics.length === 0) {
    throw new Error('No data found for this pipeline');
  }

  const totalDeals = metrics.reduce((sum, m) => sum + m.deal_count, 0);
  const totalValue = metrics.reduce((sum, m) => sum + m.total_value, 0);
  const weightedForecast = metrics.reduce((sum, m) => sum + m.weighted_value, 0);
  const avgAgeDays = metrics.reduce((sum, m, _, arr) => sum + m.avg_age_days / arr.length, 0);
  const staleDealsCount = metrics.reduce((sum, m) => sum + m.stale_deals, 0);
  const wonDeals = metrics.reduce((sum, m) => sum + m.won_deals, 0);
  const lostDeals = metrics.reduce((sum, m) => sum + m.lost_deals, 0);
  const winRate = (wonDeals + lostDeals) > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

  return {
    pipeline_id: metrics[0].pipeline_id,
    pipeline_name: metrics[0].pipeline_name,
    total_deals: totalDeals,
    total_value: totalValue,
    weighted_forecast: weightedForecast,
    avg_age_days: avgAgeDays,
    stale_deals_count: staleDealsCount,
    win_rate: winRate,
    stages: metrics,
  };
}
