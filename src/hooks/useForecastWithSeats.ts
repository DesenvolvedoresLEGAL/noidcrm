import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalSeatMetrics } from './useSeatMetrics';
import { forecastKeys } from '@/lib/query-keys';

export interface SeatForecast {
  // Current state
  currentMrr: number;
  currentArr: number;
  totalSeats: number;
  payingOrgs: number;
  revenuePerSeat: number;

  // Historical trends (last 3 months)
  avgMonthlyExpansion: number;
  avgMonthlyContraction: number;
  avgNetChange: number;
  expansionTrend: 'growing' | 'stable' | 'declining';
  
  // NRR metrics
  nrrPercent: number;
  nrrStatus: 'excellent' | 'good' | 'warning' | 'critical';

  // Projections
  projectedMrrNextMonth: number;
  projectedMrr3Months: number;
  projectedMrr6Months: number;
  projectedSeats3Months: number;

  // Confidence
  forecastConfidence: 'high' | 'medium' | 'low';
  dataPointsCount: number;
}

export function useForecastWithSeats() {
  const { data: seatMetrics } = useGlobalSeatMetrics();

  return useQuery({
    queryKey: forecastKeys.seatForecast(seatMetrics),
    queryFn: async (): Promise<SeatForecast | null> => {
      if (!seatMetrics) return null;

      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Get historical seat events for trend analysis
      const { data: historicalEvents } = await supabase
        .from('seat_events')
        .select('delta_mrr, event_type, created_at')
        .gte('created_at', threeMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      // Calculate monthly aggregates
      const monthlyData: Record<string, { expansion: number; contraction: number }> = {};
      
      (historicalEvents || []).forEach(event => {
        const month = event.created_at.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { expansion: 0, contraction: 0 };
        }
        const delta = Number(event.delta_mrr) || 0;
        if (delta > 0) {
          monthlyData[month].expansion += delta;
        } else {
          monthlyData[month].contraction += Math.abs(delta);
        }
      });

      const months = Object.keys(monthlyData).sort();
      const dataPointsCount = historicalEvents?.length || 0;

      // Calculate averages
      let totalExpansion = 0;
      let totalContraction = 0;
      months.forEach(month => {
        totalExpansion += monthlyData[month].expansion;
        totalContraction += monthlyData[month].contraction;
      });

      const monthCount = Math.max(months.length, 1);
      const avgMonthlyExpansion = totalExpansion / monthCount;
      const avgMonthlyContraction = totalContraction / monthCount;
      const avgNetChange = avgMonthlyExpansion - avgMonthlyContraction;

      // Determine expansion trend
      let expansionTrend: 'growing' | 'stable' | 'declining' = 'stable';
      if (months.length >= 2) {
        const recentMonth = monthlyData[months[months.length - 1]];
        const prevMonth = monthlyData[months[months.length - 2]];
        const recentNet = recentMonth.expansion - recentMonth.contraction;
        const prevNet = prevMonth.expansion - prevMonth.contraction;
        
        if (recentNet > prevNet * 1.1) {
          expansionTrend = 'growing';
        } else if (recentNet < prevNet * 0.9) {
          expansionTrend = 'declining';
        }
      }

      // NRR calculation and status
      const nrrPercent = seatMetrics.nrr_percent;
      let nrrStatus: 'excellent' | 'good' | 'warning' | 'critical' = 'good';
      if (nrrPercent >= 120) nrrStatus = 'excellent';
      else if (nrrPercent >= 100) nrrStatus = 'good';
      else if (nrrPercent >= 90) nrrStatus = 'warning';
      else nrrStatus = 'critical';

      // Projections based on trends
      const currentMrr = seatMetrics.total_mrr;
      const growthRate = currentMrr > 0 ? avgNetChange / currentMrr : 0;

      const projectedMrrNextMonth = currentMrr + avgNetChange;
      const projectedMrr3Months = currentMrr * Math.pow(1 + growthRate, 3);
      const projectedMrr6Months = currentMrr * Math.pow(1 + growthRate, 6);

      // Seat projections
      const seatsGrowthRate = seatMetrics.total_seats > 0 
        ? (avgNetChange / seatMetrics.revenue_per_seat) / seatMetrics.total_seats 
        : 0;
      const projectedSeats3Months = Math.round(seatMetrics.total_seats * Math.pow(1 + seatsGrowthRate, 3));

      // Forecast confidence based on data points
      let forecastConfidence: 'high' | 'medium' | 'low' = 'low';
      if (dataPointsCount >= 50) forecastConfidence = 'high';
      else if (dataPointsCount >= 20) forecastConfidence = 'medium';

      return {
        currentMrr,
        currentArr: seatMetrics.total_arr,
        totalSeats: seatMetrics.total_seats,
        payingOrgs: seatMetrics.paying_orgs,
        revenuePerSeat: seatMetrics.revenue_per_seat,

        avgMonthlyExpansion,
        avgMonthlyContraction,
        avgNetChange,
        expansionTrend,

        nrrPercent,
        nrrStatus,

        projectedMrrNextMonth,
        projectedMrr3Months,
        projectedMrr6Months,
        projectedSeats3Months,

        forecastConfidence,
        dataPointsCount,
      };
    },
    enabled: !!seatMetrics,
    staleTime: 5 * 60 * 1000,
  });
}
