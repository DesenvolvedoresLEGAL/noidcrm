import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { startOfMonth, endOfMonth, subMonths, differenceInDays, format } from 'date-fns';

export interface PeriodMetrics {
  period: string;
  periodLabel: string;
  averageTicket: number;
  salesCycle: number; // days
  winRate: number;
  totalSales: number;
  totalRevenue: number;
  totalOpportunities: number;
  lostCount: number;
}

export interface ConsolidatedMetrics {
  currentMonth: PeriodMetrics;
  lastMonth: PeriodMetrics;
  last3Months: PeriodMetrics;
  last6Months: PeriodMetrics;
  last12Months: PeriodMetrics;
  ytd: PeriodMetrics;
  isLoading: boolean;
}

export interface ChannelTrend {
  channel: string;
  label: string;
  historical: number;
  projection: number;
  trend: 'up' | 'down' | 'stable';
}

async function fetchMetricsForPeriod(
  organizationId: string,
  startDate: Date,
  endDate: Date,
  periodLabel: string
): Promise<PeriodMetrics> {
  // Fetch won opportunities
  const { data: wonOpps, error: wonError } = await supabase
    .from('opportunities')
    .select('valor_previsto, commission_value, created_at, updated_at')
    .eq('organization_id', organizationId)
    .eq('status', 'won')
    .gte('updated_at', startDate.toISOString())
    .lte('updated_at', endDate.toISOString());

  if (wonError) throw wonError;

  // Fetch lost opportunities
  const { data: lostOpps, error: lostError } = await supabase
    .from('opportunities')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'lost')
    .gte('updated_at', startDate.toISOString())
    .lte('updated_at', endDate.toISOString());

  if (lostError) throw lostError;

  // Calculate metrics
  const totalSales = wonOpps?.length || 0;
  const lostCount = lostOpps?.length || 0;
  const totalOpportunities = totalSales + lostCount;
  const totalRevenue = wonOpps?.reduce((sum, o) => sum + ((o as any).commission_value ?? o.valor_previsto ?? 0), 0) || 0;
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const winRate = totalOpportunities > 0 ? (totalSales / totalOpportunities) * 100 : 0;

  // Calculate average sales cycle (days from created to won)
  let totalCycleDays = 0;
  let validCycleCount = 0;
  wonOpps?.forEach(o => {
    if (o.created_at && o.updated_at) {
      const created = new Date(o.created_at);
      const won = new Date(o.updated_at);
      const days = differenceInDays(won, created);
      if (days >= 0) {
        totalCycleDays += days;
        validCycleCount++;
      }
    }
  });
  const salesCycle = validCycleCount > 0 ? Math.round(totalCycleDays / validCycleCount) : 0;

  return {
    period: format(startDate, 'yyyy-MM'),
    periodLabel,
    averageTicket,
    salesCycle,
    winRate,
    totalSales,
    totalRevenue,
    totalOpportunities,
    lostCount,
  };
}

export function useSalesMetrics(): ConsolidatedMetrics {
  const { organization } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['consolidated-sales-metrics', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      const now = new Date();
      const currentMonthStart = startOfMonth(now);
      const currentMonthEnd = endOfMonth(now);
      
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));
      
      const threeMonthsAgo = subMonths(now, 3);
      const sixMonthsAgo = subMonths(now, 6);
      const twelveMonthsAgo = subMonths(now, 12);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [currentMonth, lastMonth, last3Months, last6Months, last12Months, ytd] = await Promise.all([
        fetchMetricsForPeriod(organization.id, currentMonthStart, currentMonthEnd, 'Mês Atual'),
        fetchMetricsForPeriod(organization.id, lastMonthStart, lastMonthEnd, 'Mês Anterior'),
        fetchMetricsForPeriod(organization.id, threeMonthsAgo, now, 'Últimos 3 Meses'),
        fetchMetricsForPeriod(organization.id, sixMonthsAgo, now, 'Últimos 6 Meses'),
        fetchMetricsForPeriod(organization.id, twelveMonthsAgo, now, 'Últimos 12 Meses'),
        fetchMetricsForPeriod(organization.id, yearStart, now, 'YTD'),
      ]);

      return { currentMonth, lastMonth, last3Months, last6Months, last12Months, ytd };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const emptyMetrics: PeriodMetrics = {
    period: '',
    periodLabel: '',
    averageTicket: 0,
    salesCycle: 0,
    winRate: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalOpportunities: 0,
    lostCount: 0,
  };

  return {
    currentMonth: data?.currentMonth || emptyMetrics,
    lastMonth: data?.lastMonth || emptyMetrics,
    last3Months: data?.last3Months || emptyMetrics,
    last6Months: data?.last6Months || emptyMetrics,
    last12Months: data?.last12Months || emptyMetrics,
    ytd: data?.ytd || emptyMetrics,
    isLoading,
  };
}

// Hook for channel trend comparison (historical vs projection)
export function useChannelTrends(): { trends: ChannelTrend[]; isLoading: boolean } {
  const { organization } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['channel-trends', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const now = new Date();
      const threeMonthsAgo = subMonths(now, 3);
      const sixMonthsAgo = subMonths(now, 6);

      // Fetch recent period (last 3 months)
      const { data: recentOpps, error: recentError } = await supabase
        .from('opportunities')
        .select('valor_previsto, fonte')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', threeMonthsAgo.toISOString());

      if (recentError) throw recentError;

      // Fetch historical period (3-6 months ago)
      const { data: historicalOpps, error: historicalError } = await supabase
        .from('opportunities')
        .select('valor_previsto, fonte')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', sixMonthsAgo.toISOString())
        .lt('updated_at', threeMonthsAgo.toISOString());

      if (historicalError) throw historicalError;

      // Calculate distribution for both periods
      const calcDistribution = (opps: any[]) => {
        const byChannel: Record<string, number> = {};
        let total = 0;
        opps?.forEach(o => {
          const channel = normalizeChannel(o.fonte);
          byChannel[channel] = (byChannel[channel] || 0) + (o.valor_previsto || 0);
          total += o.valor_previsto || 0;
        });
        // Convert to percentages
        Object.keys(byChannel).forEach(k => {
          byChannel[k] = total > 0 ? (byChannel[k] / total) * 100 : 0;
        });
        return byChannel;
      };

      const recentDist = calcDistribution(recentOpps || []);
      const historicalDist = calcDistribution(historicalOpps || []);

      // Get all channels
      const allChannels = new Set([...Object.keys(recentDist), ...Object.keys(historicalDist)]);
      
      const trends: ChannelTrend[] = Array.from(allChannels).map(channel => {
        const historical = historicalDist[channel] || 0;
        const projection = recentDist[channel] || 0;
        const diff = projection - historical;
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (diff > 5) trend = 'up';
        else if (diff < -5) trend = 'down';

        return {
          channel,
          label: getChannelLabel(channel),
          historical,
          projection,
          trend,
        };
      }).sort((a, b) => b.projection - a.projection);

      return trends;
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { trends: data || [], isLoading };
}

function normalizeChannel(fonte: string | null): string {
  if (!fonte) return 'outros';
  const source = fonte.toLowerCase();
  if (source.includes('outbound') || source.includes('prospecção') || source.includes('cold')) return 'outbound';
  if (source.includes('inbound') || source.includes('site') || source.includes('marketing') || source.includes('orgânico')) return 'inbound';
  if (source.includes('indicação') || source.includes('referral') || source.includes('referência')) return 'indicacao';
  return 'outros';
}

function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    outbound: 'Outbound',
    inbound: 'Inbound',
    indicacao: 'Indicação',
    outros: 'Outros',
  };
  return labels[channel] || channel;
}
