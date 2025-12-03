import { supabase } from '@/integrations/supabase/client';

export interface PipelineMetrics {
  pipeline_id: string;
  pipeline_name: string;
  pipeline_type: string;
  organization_id: string;
  total_opportunities: number;
  won_count: number;
  lost_count: number;
  active_count: number;
  total_value: number;
  won_value: number;
  avg_won_value: number;
  win_rate: number;
}

export interface SDRPerformance {
  sdr_user_id: string;
  sdr_name: string;
  organization_id: string;
  total_sqls_generated: number;
  deals_won: number;
  deals_lost: number;
  revenue_attributed: number;
  conversion_rate: number;
  avg_qualification_hours: number;
}

export interface CloserPerformance {
  closer_user_id: string;
  closer_name: string;
  organization_id: string;
  deals_won: number;
  deals_lost: number;
  deals_active: number;
  revenue_closed: number;
  pipeline_value: number;
  avg_deal_size: number;
  win_rate: number;
  avg_sales_cycle_days: number;
}

/**
 * Busca métricas de todos os pipelines
 */
export async function getPipelineMetrics(): Promise<PipelineMetrics[]> {
  const { data, error } = await supabase
    .from('pipeline_metrics')
    .select('*');

  if (error) {
    console.error('Error fetching pipeline metrics:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca métricas apenas de pipelines de vendas (para forecast de receita)
 */
export async function getSalesPipelineMetrics(): Promise<PipelineMetrics[]> {
  const { data, error } = await supabase
    .from('pipeline_metrics')
    .select('*')
    .eq('pipeline_type', 'sales');

  if (error) {
    console.error('Error fetching sales pipeline metrics:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca métricas apenas de pipelines de qualificação (para contagem de SQLs)
 */
export async function getQualificationPipelineMetrics(): Promise<PipelineMetrics[]> {
  const { data, error } = await supabase
    .from('pipeline_metrics')
    .select('*')
    .eq('pipeline_type', 'qualification');

  if (error) {
    console.error('Error fetching qualification pipeline metrics:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca performance de SDRs
 */
export async function getSDRPerformance(): Promise<SDRPerformance[]> {
  const { data, error } = await supabase
    .from('sdr_performance')
    .select('*');

  if (error) {
    console.error('Error fetching SDR performance:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca performance de Closers
 */
export async function getCloserPerformance(): Promise<CloserPerformance[]> {
  const { data, error } = await supabase
    .from('closer_performance')
    .select('*');

  if (error) {
    console.error('Error fetching Closer performance:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca métricas consolidadas para o dashboard
 */
export async function getDashboardMetrics(): Promise<{
  salesMetrics: {
    totalPipeline: number;
    wonValue: number;
    activeDeals: number;
    winRate: number;
  };
  qualificationMetrics: {
    totalSQLs: number;
    activeSQLs: number;
    conversionToSales: number;
  };
  sdrLeaderboard: SDRPerformance[];
}> {
  const [salesPipelines, qualificationPipelines, sdrPerformance] = await Promise.all([
    getSalesPipelineMetrics(),
    getQualificationPipelineMetrics(),
    getSDRPerformance()
  ]);

  // Agregar métricas de vendas
  const salesMetrics = salesPipelines.reduce((acc, p) => ({
    totalPipeline: acc.totalPipeline + (p.total_value || 0),
    wonValue: acc.wonValue + (p.won_value || 0),
    activeDeals: acc.activeDeals + (p.active_count || 0),
    winRate: salesPipelines.length > 0 
      ? salesPipelines.reduce((sum, sp) => sum + sp.win_rate, 0) / salesPipelines.length 
      : 0
  }), { totalPipeline: 0, wonValue: 0, activeDeals: 0, winRate: 0 });

  // Agregar métricas de qualificação (SQLs)
  const qualificationMetrics = qualificationPipelines.reduce((acc, p) => ({
    totalSQLs: acc.totalSQLs + (p.won_count || 0), // SQLs = opportunities ganhas em pré-vendas
    activeSQLs: acc.activeSQLs + (p.active_count || 0),
    conversionToSales: qualificationPipelines.length > 0
      ? qualificationPipelines.reduce((sum, qp) => sum + qp.win_rate, 0) / qualificationPipelines.length
      : 0
  }), { totalSQLs: 0, activeSQLs: 0, conversionToSales: 0 });

  // Ordenar SDRs por receita atribuída
  const sdrLeaderboard = [...sdrPerformance].sort((a, b) => 
    (b.revenue_attributed || 0) - (a.revenue_attributed || 0)
  );

  return {
    salesMetrics,
    qualificationMetrics,
    sdrLeaderboard
  };
}
