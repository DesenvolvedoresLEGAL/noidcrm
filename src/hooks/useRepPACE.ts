import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useHolidays, useSalesConfig, useSellerTargets } from './useSalesConfig';
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend, isBefore } from 'date-fns';

export interface RepPACEData {
  monthlyTarget: number;
  dailyTarget: number;
  targetUntilToday: number;
  achieved: number;
  projection: number;
  paceVariance: number;
  paceScore: 'red' | 'yellow' | 'green';
  pacePercentage: number;
  workingDaysLeft: number;
  workingDaysTotal: number;
  workingDaysElapsed: number;
  dailyTargets: {
    calls: number;
    leads: number;
    proposals: number;
    sales: number;
    revenue: number;
  };
}

function getWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: { holiday_date: string }[]
): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const holidayDates = new Set(holidays.map(h => h.holiday_date));
  
  return days.filter(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return !isWeekend(day) && !holidayDates.has(dateStr);
  }).length;
}

function getWorkingDaysUntilDate(
  startDate: Date,
  targetDate: Date,
  holidays: { holiday_date: string }[]
): number {
  if (isBefore(targetDate, startDate)) return 0;
  return getWorkingDays(startDate, targetDate, holidays);
}

export function useRepPACE(month?: Date) {
  const { user, organization } = useCurrentUser();
  const currentMonth = month || new Date();
  const periodMonth = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  
  const { holidays } = useHolidays(currentMonth.getFullYear());
  const { config } = useSalesConfig();
  const { targets } = useSellerTargets(periodMonth);

  // Fetch won opportunities for the current user this month
  const { data: wonOpportunities, isLoading: oppsLoading } = useQuery({
    queryKey: ['rep-won-opportunities', organization?.id, user?.id, periodMonth],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return [];
      
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, valor_previsto, updated_at')
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .eq('status', 'won')
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id && !!user?.id,
  });

  // Calculate PACE metrics for the current user
  const paceData: RepPACEData | null = (() => {
    if (!user?.id || !config) return null;
    
    // Get seller's target for this month
    const sellerTarget = targets?.find(t => t.user_id === user.id);
    const monthlyTarget = sellerTarget?.monthly_revenue_target || 0;
    
    // Daily targets from seller targets
    const dailyTargets = {
      calls: sellerTarget?.daily_calls_target || 0,
      leads: sellerTarget?.daily_leads_target || 0,
      proposals: sellerTarget?.daily_proposals_target || 0,
      sales: sellerTarget?.daily_sales_target || 0,
      revenue: sellerTarget?.daily_revenue_target || 0,
    };
    
    // Calculate working days
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const today = new Date();
    const effectiveToday = isBefore(today, monthEnd) ? today : monthEnd;
    
    const workingDaysTotal = getWorkingDays(monthStart, monthEnd, holidays || []);
    const workingDaysElapsed = getWorkingDaysUntilDate(monthStart, effectiveToday, holidays || []);
    const workingDaysLeft = workingDaysTotal - workingDaysElapsed;
    
    // Calculate daily target
    const dailyTarget = workingDaysTotal > 0 ? monthlyTarget / workingDaysTotal : 0;
    
    // Calculate target until today
    const targetUntilToday = dailyTarget * workingDaysElapsed;
    
    // Calculate achieved revenue
    const achieved = wonOpportunities?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
    
    // Calculate projection
    const projection = workingDaysElapsed > 0 
      ? (achieved / workingDaysElapsed) * workingDaysTotal 
      : 0;
    
    // Calculate PACE variance
    const paceVariance = achieved - targetUntilToday;
    
    // Calculate PACE percentage
    const pacePercentage = targetUntilToday > 0 
      ? (achieved / targetUntilToday) * 100 
      : (achieved > 0 ? 100 : 0);
    
    // Determine PACE score
    let paceScore: 'red' | 'yellow' | 'green' = 'green';
    if (pacePercentage < 70) {
      paceScore = 'red';
    } else if (pacePercentage < 90) {
      paceScore = 'yellow';
    }
    
    return {
      monthlyTarget,
      dailyTarget,
      targetUntilToday,
      achieved,
      projection,
      paceVariance,
      paceScore,
      pacePercentage,
      workingDaysLeft,
      workingDaysTotal,
      workingDaysElapsed,
      dailyTargets,
    };
  })();

  return {
    paceData,
    isLoading: oppsLoading || !config,
    hasTarget: !!targets?.find(t => t.user_id === user?.id),
  };
}
