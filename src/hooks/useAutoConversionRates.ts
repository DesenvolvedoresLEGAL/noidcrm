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

export interface ConversionRatesData {
  overall: {
    winRate: number;
    totalWon: number;
    totalLost: number;
    totalOpportunities: number;
  };
  byChannel: ChannelConversionRates[];
  period: string;
  isLoading: boolean;
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
        };
      }
      
      const sixMonthsAgo = subMonths(new Date(), 6);
      
      // Get all opportunities with final status (won or lost)
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('status, fonte, valor_previsto')
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost'])
        .gte('updated_at', sixMonthsAgo.toISOString());
      
      if (error) throw error;
      
      // Calculate overall win rate
      const totalWon = opportunities?.filter(o => o.status === 'won').length || 0;
      const totalLost = opportunities?.filter(o => o.status === 'lost').length || 0;
      const totalOpportunities = totalWon + totalLost;
      const winRate = totalOpportunities > 0 ? (totalWon / totalOpportunities) * 100 : 0;
      
      // Calculate by channel
      const channelStats: Record<string, { won: number; lost: number; total: number }> = {};
      
      opportunities?.forEach(o => {
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
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    overall: data?.overall || { winRate: 0, totalWon: 0, totalLost: 0, totalOpportunities: 0 },
    byChannel: data?.byChannel || [],
    period: 'últimos 6 meses',
    isLoading,
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

// Estimated rates based on industry benchmarks - these would ideally come from pipeline stage analysis
function getEstimatedRate(channel: string, rateType: 'leadToMql' | 'mqlToProposal'): number {
  const rates: Record<string, Record<string, number>> = {
    outbound: { leadToMql: 79, mqlToProposal: 90 },
    inbound: { leadToMql: 87, mqlToProposal: 90 },
    indicacao: { leadToMql: 90, mqlToProposal: 95 },
    outros: { leadToMql: 70, mqlToProposal: 80 },
  };
  return rates[channel]?.[rateType] || 75;
}
