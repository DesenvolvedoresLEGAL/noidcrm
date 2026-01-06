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

export interface StageConversionMetrics {
  stage_id: string;
  stage_name: string;
  order_index: number;
  pipeline_id: string;
  pipeline_name: string;
  pipeline_type: string;
  organization_id: string;
  total_opportunities: number;
  opportunities_count: number;
  won_count: number;
  lost_count: number;
  total_value: number;
  stage_value: number;
  avg_days_in_stage: number;
  conversion_rate_to_next: number | null;
}

export interface HandoffMetrics {
  sdr_user_id: string;
  sdr_name: string;
  closer_user_id: string;
  closer_name: string;
  organization_id: string;
  total_handoffs: number;
  won_after_handoff: number;
  lost_after_handoff: number;
  active_after_handoff: number;
  revenue_from_handoffs: number;
  handoff_win_rate: number;
  avg_qualification_hours: number;
}

/**
 * Busca métricas de todos os pipelines com filtro opcional de visibilidade
 */
export async function getPipelineMetrics(visibleUserIds?: string[] | null): Promise<PipelineMetrics[]> {
  // Se temos filtro de usuários, precisamos calcular métricas manualmente
  if (visibleUserIds && visibleUserIds.length > 0) {
    return getPipelineMetricsFiltered(visibleUserIds);
  }

  // Sem filtro, usa a view otimizada
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
 * Calcula métricas de pipeline com filtro de usuários
 */
async function getPipelineMetricsFiltered(visibleUserIds: string[]): Promise<PipelineMetrics[]> {
  // Busca oportunidades filtradas por usuário
  const { data: opportunities, error: oppsError } = await supabase
    .from('opportunities')
    .select('id, pipeline_id, status, valor_previsto, owner_user_id')
    .in('owner_user_id', visibleUserIds);

  if (oppsError) {
    console.error('Error fetching filtered opportunities:', oppsError);
    return [];
  }

  // Busca pipelines para nomes
  const { data: pipelines, error: pipError } = await supabase
    .from('pipelines')
    .select('id, name, pipeline_type, organization_id');

  if (pipError) {
    console.error('Error fetching pipelines:', pipError);
    return [];
  }

  // Agrupa métricas por pipeline
  const metricsMap = new Map<string, PipelineMetrics>();

  pipelines?.forEach(p => {
    metricsMap.set(p.id, {
      pipeline_id: p.id,
      pipeline_name: p.name,
      pipeline_type: p.pipeline_type || 'sales',
      organization_id: p.organization_id,
      total_opportunities: 0,
      won_count: 0,
      lost_count: 0,
      active_count: 0,
      total_value: 0,
      won_value: 0,
      avg_won_value: 0,
      win_rate: 0,
    });
  });

  // Calcula métricas
  opportunities?.forEach(opp => {
    const metrics = metricsMap.get(opp.pipeline_id);
    if (!metrics) return;

    metrics.total_opportunities++;
    metrics.total_value += opp.valor_previsto || 0;

    if (opp.status === 'won') {
      metrics.won_count++;
      metrics.won_value += opp.valor_previsto || 0;
    } else if (opp.status === 'lost') {
      metrics.lost_count++;
    } else {
      metrics.active_count++;
    }
  });

  // Calcula médias e taxas
  metricsMap.forEach(metrics => {
    const processed = metrics.won_count + metrics.lost_count;
    metrics.win_rate = processed > 0 ? (metrics.won_count / processed) * 100 : 0;
    metrics.avg_won_value = metrics.won_count > 0 ? metrics.won_value / metrics.won_count : 0;
  });

  return Array.from(metricsMap.values()).filter(m => m.total_opportunities > 0);
}

/**
 * Busca métricas apenas de pipelines de vendas (para forecast de receita)
 */
export async function getSalesPipelineMetrics(visibleUserIds?: string[] | null): Promise<PipelineMetrics[]> {
  const allMetrics = await getPipelineMetrics(visibleUserIds);
  return allMetrics.filter(m => m.pipeline_type === 'sales');
}

/**
 * Busca métricas apenas de pipelines de qualificação (para contagem de SQLs)
 */
export async function getQualificationPipelineMetrics(visibleUserIds?: string[] | null): Promise<PipelineMetrics[]> {
  const allMetrics = await getPipelineMetrics(visibleUserIds);
  return allMetrics.filter(m => m.pipeline_type === 'qualification');
}

/**
 * Busca performance de SDRs com filtro opcional
 */
export async function getSDRPerformance(visibleUserIds?: string[] | null): Promise<SDRPerformance[]> {
  let query = supabase
    .from('sdr_performance')
    .select('*');

  // Filtrar por sdr_user_id se necessário
  if (visibleUserIds && visibleUserIds.length > 0) {
    query = query.in('sdr_user_id', visibleUserIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching SDR performance:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca performance de Closers com filtro opcional
 */
export async function getCloserPerformance(visibleUserIds?: string[] | null): Promise<CloserPerformance[]> {
  let query = supabase
    .from('closer_performance')
    .select('*');

  // Filtrar por closer_user_id se necessário
  if (visibleUserIds && visibleUserIds.length > 0) {
    query = query.in('closer_user_id', visibleUserIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching Closer performance:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca métricas de conversão por estágio com filtro opcional
 */
export async function getStageConversionMetrics(visibleUserIds?: string[] | null): Promise<StageConversionMetrics[]> {
  // Se temos filtro, precisamos calcular manualmente
  if (visibleUserIds && visibleUserIds.length > 0) {
    return getStageConversionMetricsFiltered(visibleUserIds);
  }

  const { data, error } = await supabase
    .from('stage_conversion_metrics')
    .select('*');

  if (error) {
    console.error('Error fetching stage conversion metrics:', error);
    return [];
  }

  return data || [];
}

/**
 * Calcula métricas de conversão por estágio com filtro
 */
async function getStageConversionMetricsFiltered(visibleUserIds: string[]): Promise<StageConversionMetrics[]> {
  try {
    // Busca oportunidades filtradas
    const { data: opportunities, error: oppsError } = await supabase
      .from('opportunities')
      .select('id, pipeline_id, stage_id, valor_previsto, owner_user_id')
      .in('owner_user_id', visibleUserIds)
      .eq('status', 'open');

    if (oppsError) {
      console.error('Error fetching filtered opportunities:', oppsError);
      return [];
    }

    // Busca pipelines
    const { data: pipelines, error: pipError } = await supabase
      .from('pipelines')
      .select('id, name, pipeline_type, organization_id');

    if (pipError || !pipelines) {
      console.error('Error fetching pipelines:', pipError);
      return [];
    }

    // Busca stages via view ou tabela disponível
    // Usar pipeline_stages que deve existir no schema
    const pipelineIds = pipelines.map(p => p.id);
    
    // Query pipeline_stages via opportunities para construir o mapa
    const stageIds = [...new Set(opportunities?.map(o => o.stage_id).filter(Boolean) || [])];
    
    if (stageIds.length === 0) {
      return [];
    }

    // Buscar nome dos stages via oportunidades agrupadas
    const stageMetrics: StageConversionMetrics[] = [];
    
    // Agrupar por pipeline e stage
    const stageMap = new Map<string, { 
      count: number; 
      value: number; 
      pipelineId: string;
      stageName: string;
    }>();

    opportunities?.forEach(opp => {
      if (!opp.stage_id) return;
      const key = `${opp.pipeline_id}_${opp.stage_id}`;
      const existing = stageMap.get(key) || { count: 0, value: 0, pipelineId: opp.pipeline_id, stageName: opp.stage_id };
      existing.count++;
      existing.value += opp.valor_previsto || 0;
      stageMap.set(key, existing);
    });

    // Converter para array de métricas
    stageMap.forEach((data, key) => {
      const pipeline = pipelines.find(p => p.id === data.pipelineId);
      if (!pipeline) return;

      stageMetrics.push({
        stage_id: data.stageName,
        stage_name: data.stageName, // Simplificado - usa ID como nome
        order_index: 0,
        pipeline_id: data.pipelineId,
        pipeline_name: pipeline.name,
        pipeline_type: pipeline.pipeline_type || 'sales',
        organization_id: pipeline.organization_id,
        total_opportunities: data.count,
        opportunities_count: data.count,
        won_count: 0,
        lost_count: 0,
        total_value: data.value,
        stage_value: data.value,
        avg_days_in_stage: 0,
        conversion_rate_to_next: null,
      });
    });

    return stageMetrics;
  } catch (err) {
    console.error('Error in getStageConversionMetricsFiltered:', err);
    return [];
  }
}

/**
 * Busca métricas de handoff SDR → Closer com filtro opcional
 */
export async function getHandoffMetrics(visibleUserIds?: string[] | null): Promise<HandoffMetrics[]> {
  let query = supabase
    .from('handoff_metrics')
    .select('*');

  // Filtrar se temos restrição de visibilidade
  if (visibleUserIds && visibleUserIds.length > 0) {
    // Mostra handoffs onde SDR OU closer está na lista de visíveis
    query = query.or(`sdr_user_id.in.(${visibleUserIds.join(',')}),closer_user_id.in.(${visibleUserIds.join(',')})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching handoff metrics:', error);
    return [];
  }

  return data || [];
}

/**
 * Busca métricas consolidadas para o dashboard com filtro opcional
 */
export async function getDashboardMetrics(visibleUserIds?: string[] | null): Promise<{
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
    getSalesPipelineMetrics(visibleUserIds),
    getQualificationPipelineMetrics(visibleUserIds),
    getSDRPerformance(visibleUserIds)
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
