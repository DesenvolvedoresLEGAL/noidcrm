import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useHolidays } from './useSalesConfig';
import { startOfMonth, endOfMonth, subMonths, format, eachDayOfInterval, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AverageTicketData {
  averageTicket: number;
  totalSales: number;
  totalRevenue: number;
  period: string;
  isLoading: boolean;
}

export interface WorkingDaysData {
  workingDays: number;
  totalDays: number;
  weekends: number;
  holidaysCount: number;
  holidaysList: string[];
  month: string;
  year: number;
  isLoading: boolean;
}

export interface ChannelDistribution {
  channel: string;
  label: string;
  revenue: number;
  count: number;
  percentage: number;
}

export interface RevenueDistributionData {
  distribution: ChannelDistribution[];
  totalRevenue: number;
  totalSales: number;
  period: string;
  isLoading: boolean;
}

// Calculate average ticket from won opportunities (last 12 months)
export function useAverageTicket(): AverageTicketData {
  const { organization } = useCurrentUser();
  
  const { data, isLoading } = useQuery({
    queryKey: ['auto-average-ticket', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { averageTicket: 0, totalSales: 0, totalRevenue: 0 };
      
      const twelveMonthsAgo = subMonths(new Date(), 12);
      
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', twelveMonthsAgo.toISOString())
        .not('valor_previsto', 'is', null);
      
      if (error) throw error;
      
      const totalRevenue = opportunities?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const totalSales = opportunities?.length || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      return { averageTicket, totalSales, totalRevenue };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    averageTicket: data?.averageTicket || 0,
    totalSales: data?.totalSales || 0,
    totalRevenue: data?.totalRevenue || 0,
    period: 'últimos 12 meses',
    isLoading,
  };
}

// Calculate working days for a specific month
export function useWorkingDaysForMonth(month?: Date): WorkingDaysData {
  const targetMonth = month || new Date();
  const year = targetMonth.getFullYear();
  const monthIndex = targetMonth.getMonth();
  
  const { holidays, isLoading: holidaysLoading } = useHolidays(year);
  
  const monthStart = startOfMonth(targetMonth);
  const monthEnd = endOfMonth(targetMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Create a set of holiday dates for this month
  const holidayDatesInMonth = (holidays || []).filter(h => {
    const holidayDate = new Date(h.holiday_date + 'T00:00:00');
    return holidayDate >= monthStart && holidayDate <= monthEnd;
  });
  
  const holidayDates = new Set(holidayDatesInMonth.map(h => h.holiday_date));
  
  // Count weekends
  const weekends = days.filter(day => isWeekend(day)).length;
  
  // Count holidays that are not on weekends
  const holidaysNotOnWeekend = holidayDatesInMonth.filter(h => {
    const date = new Date(h.holiday_date + 'T00:00:00');
    return !isWeekend(date);
  }).length;
  
  // Working days = total days - weekends - holidays (not on weekends)
  const workingDays = days.length - weekends - holidaysNotOnWeekend;
  
  const monthName = format(targetMonth, 'MMMM', { locale: ptBR });
  
  return {
    workingDays,
    totalDays: days.length,
    weekends,
    holidaysCount: holidaysNotOnWeekend,
    holidaysList: holidayDatesInMonth.map(h => h.name),
    month: monthName,
    year,
    isLoading: holidaysLoading,
  };
}

// Calculate revenue distribution by channel (fonte) from last 6 months
export function useRevenueDistribution(): RevenueDistributionData {
  const { organization } = useCurrentUser();
  
  const { data, isLoading } = useQuery({
    queryKey: ['auto-revenue-distribution', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { distribution: [], totalRevenue: 0, totalSales: 0 };
      
      const sixMonthsAgo = subMonths(new Date(), 6);
      
      const { data: opportunities, error } = await supabase
        .from('opportunities')
        .select('valor_previsto, fonte')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', sixMonthsAgo.toISOString());
      
      if (error) throw error;
      
      // Group by fonte (lead source)
      const byChannel: Record<string, { revenue: number; count: number }> = {};
      let totalRevenue = 0;
      let totalSales = 0;
      
      opportunities?.forEach(o => {
        const channel = normalizeChannel(o.fonte);
        if (!byChannel[channel]) {
          byChannel[channel] = { revenue: 0, count: 0 };
        }
        byChannel[channel].revenue += o.valor_previsto || 0;
        byChannel[channel].count += 1;
        totalRevenue += o.valor_previsto || 0;
        totalSales += 1;
      });
      
      // Convert to array with percentages
      const distribution: ChannelDistribution[] = Object.entries(byChannel)
        .map(([channel, data]) => ({
          channel,
          label: getChannelLabel(channel),
          revenue: data.revenue,
          count: data.count,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);
      
      return { distribution, totalRevenue, totalSales };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    distribution: data?.distribution || [],
    totalRevenue: data?.totalRevenue || 0,
    totalSales: data?.totalSales || 0,
    period: 'últimos 6 meses',
    isLoading,
  };
}

// Normalize lead_source to standard channels
function normalizeChannel(leadSource: string | null): string {
  if (!leadSource) return 'outros';
  
  const source = leadSource.toLowerCase();
  
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

// Get display label for channel
function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    outbound: 'Outbound',
    inbound: 'Inbound',
    indicacao: 'Indicação',
    outros: 'Outros',
  };
  return labels[channel] || channel;
}
