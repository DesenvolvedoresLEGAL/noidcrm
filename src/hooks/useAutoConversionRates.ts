import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { subMonths } from 'date-fns';

export interface ChannelConversionRates {
  channel: string;
  label: string;
  leadToMql: number;
  mqlToProposal: number;
  proposalToSale: number;
  winRate: number;
  totalLeads: number;
  totalWon: number;
  totalLost: number;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  isImproving: boolean;
}

export interface ChannelTrend {
  channel: string;
  label: string;
  winRate: TrendData;
  proposalToSale: TrendData;
}

export interface ConversionRatesData {
  overall: {
    winRate: number;
    totalWon: number;
    totalLost: number;
    totalOpportunities: number;
  };
  byChannel: ChannelConversionRates[];
  trends: {
    overall: TrendData;
    byChannel: ChannelTrend[];
  };
  period: string;
  isLoading: boolean;
}

function calculateTrend(current: number, previous: number): TrendData {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  let direction: 'up' | 'down' | 'stable' = 'stable';
  
  if (change > 2) direction = 'up';
  else if (change < -2) direction = 'down';
  
  return {
    current,
    previous,
    change,
    direction,
    isImproving: direction === 'up',
  };
}

export function useAutoConversionRates(): ConversionRatesData {
  const { organization } = useCurrentUser();
  
  const { data, isLoading } = useQuery({
    queryKey: ['auto-conversion-rates', organization?.id],
    queryFn: async () => {
      if (!organization?.id) {
        return {
          overall: { winRate: 0, totalWon: 0, totalLost: 0, totalOpportunities: 0 },
          byChannel: [],
          trends: { overall: calculateTrend(0, 0), byChannel: [] },
        };
      }
      
      const now = new Date();
      const threeMonthsAgo = subMonths(now, 3);
      const sixMonthsAgo = subMonths(now, 6);
      
      // Get opportunities for current period (last 3 months)
      const { data: currentOps, error: currentError } = await supabase
        .from('opportunities')
        .select('status, fonte, valor_previsto, updated_at')
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost'])
        .gte('updated_at', threeMonthsAgo.toISOString());
      
      if (currentError) throw currentError;
      
      // Get opportunities for previous period (3-6 months ago)
      const { data: previousOps, error: previousError } = await supabase
        .from('opportunities')
        .select('status, fonte, valor_previsto, updated_at')
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost'])
        .gte('updated_at', sixMonthsAgo.toISOString())
        .lt('updated_at', threeMonthsAgo.toISOString());
      
      if (previousError) throw previousError;
      
      // Calculate current period stats
      const currentStats = calculatePeriodStats(currentOps || []);
      const previousStats = calculatePeriodStats(previousOps || []);
      
      // Calculate trends
      const overallTrend = calculateTrend(currentStats.overall.winRate, previousStats.overall.winRate);
      
      const channelTrends: ChannelTrend[] = currentStats.byChannel.map(current => {
        const previous = previousStats.byChannel.find(p => p.channel === current.channel);
        return {
          channel: current.channel,
          label: current.label,
          winRate: calculateTrend(current.winRate, previous?.winRate || 0),
          proposalToSale: calculateTrend(current.proposalToSale, previous?.proposalToSale || 0),
        };
      });
      
      return {
        overall: currentStats.overall,
        byChannel: currentStats.byChannel,
        trends: {
          overall: overallTrend,
          byChannel: channelTrends,
        },
      };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    overall: data?.overall || { winRate: 0, totalWon: 0, totalLost: 0, totalOpportunities: 0 },
    byChannel: data?.byChannel || [],
    trends: data?.trends || { overall: calculateTrend(0, 0), byChannel: [] },
    period: 'últimos 3 meses',
    isLoading,
  };
}

function calculatePeriodStats(opportunities: any[]) {
  // Overall stats
  const totalWon = opportunities.filter(o => o.status === 'won').length;
  const totalLost = opportunities.filter(o => o.status === 'lost').length;
  const totalOpportunities = totalWon + totalLost;
  const winRate = totalOpportunities > 0 ? (totalWon / totalOpportunities) * 100 : 0;
  
  // By channel stats
  const channelStats: Record<string, { won: number; lost: number; total: number }> = {};
  
  opportunities.forEach(o => {
    const channel = normalizeChannel(o.fonte);
    if (!channelStats[channel]) {
      channelStats[channel] = { won: 0, lost: 0, total: 0 };
    }
    channelStats[channel].total += 1;
    if (o.status === 'won') {
      channelStats[channel].won += 1;
    } else {
      channelStats[channel].lost += 1;
    }
  });
  
  const byChannel: ChannelConversionRates[] = Object.entries(channelStats)
    .map(([channel, stats]) => ({
      channel,
      label: getChannelLabel(channel),
      leadToMql: getEstimatedRate(channel, 'leadToMql'),
      mqlToProposal: getEstimatedRate(channel, 'mqlToProposal'),
      proposalToSale: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
      winRate: stats.total > 0 ? (stats.won / stats.total) * 100 : 0,
      totalLeads: stats.total,
      totalWon: stats.won,
      totalLost: stats.lost,
    }))
    .sort((a, b) => b.totalWon - a.totalWon);
  
  return {
    overall: { winRate, totalWon, totalLost, totalOpportunities },
    byChannel,
  };
}

function normalizeChannel(fonte: string | null): string {
  if (!fonte) return 'outros';
  
  const source = fonte.toLowerCase();
  
  if (source.includes('outbound') || source.includes('prospecção') || source.includes('cold')) {
    return 'outbound';
  }
  if (source.includes('inbound') || source.includes('site') || source.includes('marketing') || source.includes('orgânico')) {
    return 'inbound';
  }
  if (source.includes('indicação') || source.includes('referral') || source.includes('referência')) {
    return 'indicacao';
  }
  
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

function getEstimatedRate(channel: string, rateType: 'leadToMql' | 'mqlToProposal'): number {
  const rates: Record<string, Record<string, number>> = {
    outbound: { leadToMql: 79, mqlToProposal: 90 },
    inbound: { leadToMql: 87, mqlToProposal: 90 },
    indicacao: { leadToMql: 90, mqlToProposal: 95 },
    outros: { leadToMql: 70, mqlToProposal: 80 },
  };
  return rates[channel]?.[rateType] || 75;
}
