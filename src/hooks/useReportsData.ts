import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPipelineMetrics, getStageConversionMetrics } from '@/services/crm/pipeline-metrics';

export interface ReportFilters {
  pipelines: string[];
  users: string;
  period: string;
  startDate: string;
  endDate: string;
}

export interface LossReasonData {
  id: string;
  name: string;
  count: number;
  value: number;
}

export interface ProcessedOpportunityData {
  status: string;
  count: number;
  total_value: number;
  avg_value: number;
}

export interface MonthlyTrendData {
  month: string;
  won_count: number;
  won_value: number;
  lost_count: number;
  lost_value: number;
  created_count: number;
}

export function useGeneralOverviewData() {
  return useQuery({
    queryKey: ['reports', 'general-overview'],
    queryFn: async () => {
      const [pipelineMetrics, { data: totals }] = await Promise.all([
        getPipelineMetrics(),
        supabase.from('opportunities')
          .select('status, valor_previsto')
      ]);

      // Calculate totals from opportunities
      const totalValue = totals?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const wonValue = pipelineMetrics.reduce((acc, p) => acc + (p.won_value || 0), 0);
      const totalDeals = pipelineMetrics.reduce((acc, p) => acc + (p.total_opportunities || 0), 0);
      const wonDeals = pipelineMetrics.reduce((acc, p) => acc + (p.won_count || 0), 0);
      const lostDeals = pipelineMetrics.reduce((acc, p) => acc + (p.lost_count || 0), 0);
      const activeDeals = pipelineMetrics.reduce((acc, p) => acc + (p.active_count || 0), 0);
      const avgWinRate = pipelineMetrics.length > 0 
        ? pipelineMetrics.reduce((acc, p) => acc + (p.win_rate || 0), 0) / pipelineMetrics.length 
        : 0;

      return {
        kpis: {
          totalValue,
          wonValue,
          totalDeals,
          wonDeals,
          lostDeals,
          activeDeals,
          avgWinRate,
        },
        pipelineMetrics,
      };
    },
  });
}

export function useLostReasonsData() {
  return useQuery({
    queryKey: ['reports', 'lost-reasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loss_reasons')
        .select(`
          id,
          name,
          opportunities:opportunities!loss_reason_id(id, valor_previsto, status)
        `);

      if (error) throw error;

      const reasons: LossReasonData[] = (data || [])
        .map(lr => ({
          id: lr.id,
          name: lr.name,
          count: lr.opportunities?.filter((o: any) => o.status === 'lost').length || 0,
          value: lr.opportunities
            ?.filter((o: any) => o.status === 'lost')
            .reduce((acc: number, o: any) => acc + (o.valor_previsto || 0), 0) || 0,
        }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);

      return reasons;
    },
  });
}

export function useProcessedOpportunitiesData() {
  return useQuery({
    queryKey: ['reports', 'processed-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('status, valor_previsto, created_at, updated_at')
        .in('status', ['won', 'lost']);

      if (error) throw error;

      const won = data?.filter(o => o.status === 'won') || [];
      const lost = data?.filter(o => o.status === 'lost') || [];

      return {
        won: {
          count: won.length,
          total_value: won.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
          avg_value: won.length > 0 ? won.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) / won.length : 0,
        },
        lost: {
          count: lost.length,
          total_value: lost.reduce((acc, o) => acc + (o.valor_previsto || 0), 0),
          avg_value: lost.length > 0 ? lost.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) / lost.length : 0,
        },
        total: {
          count: data?.length || 0,
          total_value: data?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0,
        },
        winRate: data && data.length > 0 ? (won.length / data.length) * 100 : 0,
      };
    },
  });
}

export function useConversionRateData() {
  return useQuery({
    queryKey: ['reports', 'conversion-rate'],
    queryFn: async () => {
      const stageMetrics = await getStageConversionMetrics();
      
      // Group by pipeline
      const byPipeline = stageMetrics.reduce((acc, stage) => {
        if (!acc[stage.pipeline_id]) {
          acc[stage.pipeline_id] = {
            pipeline_id: stage.pipeline_id,
            pipeline_name: stage.pipeline_name,
            stages: [],
          };
        }
        acc[stage.pipeline_id].stages.push({
          stage_id: stage.stage_id,
          stage_name: stage.stage_name,
          order_index: stage.order_index,
          count: stage.opportunities_count || 0,
          value: stage.stage_value || 0,
          conversion_rate: stage.conversion_rate_to_next,
        });
        return acc;
      }, {} as Record<string, { pipeline_id: string; pipeline_name: string; stages: any[] }>);

      // Sort stages by order_index within each pipeline
      Object.values(byPipeline).forEach(pipeline => {
        pipeline.stages.sort((a, b) => a.order_index - b.order_index);
      });

      return Object.values(byPipeline);
    },
  });
}

export function useRevenueForecastData() {
  return useQuery({
    queryKey: ['reports', 'revenue-forecast'],
    queryFn: async () => {
      // Get opportunities closing this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const [{ data: closingThisMonth }, { data: wonThisMonth }, pipelineMetrics] = await Promise.all([
        supabase
          .from('opportunities')
          .select('id, title, valor_previsto, prob, close_date_prevista, status, pipeline_id')
          .eq('status', 'open')
          .gte('close_date_prevista', startOfMonth.toISOString())
          .lte('close_date_prevista', endOfMonth.toISOString()),
        supabase
          .from('opportunities')
          .select('id, valor_previsto, updated_at')
          .eq('status', 'won')
          .gte('updated_at', startOfMonth.toISOString())
          .lte('updated_at', endOfMonth.toISOString()),
        getPipelineMetrics(),
      ]);

      const closedRevenue = wonThisMonth?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const openPipeline = closingThisMonth?.reduce((acc, o) => acc + (o.valor_previsto || 0), 0) || 0;
      const weightedPipeline = closingThisMonth?.reduce((acc, o) => {
        const prob = (o.prob || 50) / 100;
        return acc + (o.valor_previsto || 0) * prob;
      }, 0) || 0;

      // Calculate scenarios
      const pessimistic = closedRevenue + weightedPipeline * 0.5;
      const realistic = closedRevenue + weightedPipeline;
      const optimistic = closedRevenue + weightedPipeline * 1.5;
      const bestCase = closedRevenue + openPipeline;

      // Get monthly goal from organization settings (default 100k)
      const goal = 100000;

      return {
        closedRevenue,
        openPipeline,
        weightedPipeline,
        goal,
        scenarios: [
          { name: 'Pessimista', value: pessimistic, probability: 25 },
          { name: 'Realista', value: realistic, probability: 50 },
          { name: 'Otimista', value: optimistic, probability: 20 },
          { name: 'Melhor Caso', value: bestCase, probability: 5 },
        ],
        closingOpportunities: closingThisMonth || [],
        pipelineMetrics,
      };
    },
  });
}
