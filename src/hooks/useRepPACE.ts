import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useCurrentOrganization';
import { useSalesConfig, useHolidays } from './useSalesConfig';
import { useOTESellerConfigs, useOTELevels } from './useOTEData';
import { format, startOfMonth, endOfMonth, isWeekend, eachDayOfInterval, isBefore } from 'date-fns';

export interface RepPACEData {
  monthlyTarget: number;
  dailyTarget: number;
  targetUntilToday: number;
  achieved: number;
  projection: number;
  paceVariance: number;
  pacePercentage: number;
  paceScore: 'red' | 'yellow' | 'green';
  workingDaysTotal: number;
  workingDaysPassed: number;
  workingDaysRemaining: number;
  goalType: 'revenue' | 'leads';
  dailyActivities: {
    calls: { target: number; achieved: number };
    leads: { target: number; achieved: number };
    proposals: { target: number; achieved: number };
    sales: { target: number; achieved: number };
    revenue: { target: number; achieved: number };
  };
}

// Calculate working days excluding weekends and holidays
function getWorkingDays(startDate: Date, endDate: Date, holidays: { holiday_date: string }[]): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const holidayDates = new Set(holidays.map(h => h.holiday_date));
  
  return days.filter(day => {
    if (isWeekend(day)) return false;
    if (holidayDates.has(format(day, 'yyyy-MM-dd'))) return false;
    return true;
  }).length;
}

function getWorkingDaysUntilDate(startDate: Date, targetDate: Date, holidays: { holiday_date: string }[]): number {
  if (isBefore(targetDate, startDate)) return 0;
  return getWorkingDays(startDate, targetDate, holidays);
}

export function useRepPACE(month?: string) {
  const { organization } = useCurrentOrganization();
  const { config } = useSalesConfig();
  const { holidays } = useHolidays();
  const { data: sellerConfigs } = useOTESellerConfigs();
  const { data: oteLevels } = useOTELevels();
  
  const currentMonth = month || format(new Date(), 'yyyy-MM');
  const monthStart = startOfMonth(new Date(currentMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);
  const today = new Date();

  // Get target from OTE config or level — determine goalType early
  let monthlyTarget = 0;
  let goalType: 'revenue' | 'leads' = 'revenue';
  
  // Get current user's OTE config
  const { data: currentUserConfig, isLoading: configLoading } = useQuery({
    queryKey: ['rep-ote-config', organization?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !sellerConfigs) return null;
      return sellerConfigs.find(c => c.user_id === user.id) || null;
    },
    enabled: !!organization?.id && !!sellerConfigs,
  });

  if (currentUserConfig) {
    if (currentUserConfig.ote_level_id && oteLevels) {
      const level = oteLevels.find(l => l.id === currentUserConfig.ote_level_id);
      if (level) {
        goalType = level.goal_type || 'revenue';
        monthlyTarget = currentUserConfig.custom_goal_override || level.monthly_goal;
      }
    } else if (currentUserConfig.custom_goal_override) {
      monthlyTarget = currentUserConfig.custom_goal_override;
    }
  }

  // Fetch opportunities based on goalType
  const { data: achievedData, isLoading: oppsLoading } = useQuery({
    queryKey: ['rep-pace-achieved', organization?.id, currentMonth, goalType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organization?.id) return { achieved: 0 };

      // Determine which pipeline type to query
      const pipelineType = goalType === 'leads' ? 'qualification' : 'sales';

      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('pipeline_type', pipelineType);

      const pipelineIds = (pipelines || []).map(p => p.id);
      if (pipelineIds.length === 0) return { achieved: 0 };

      const { data, error } = await supabase
        .from('opportunities')
        .select('id, valor_previsto, commission_value, updated_at, pipeline_id')
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .eq('status', 'won')
        .in('pipeline_id', pipelineIds)
        .gte('updated_at', format(monthStart, 'yyyy-MM-dd'))
        .lte('updated_at', format(monthEnd, 'yyyy-MM-dd'));

      if (error) throw error;
      const opps = data || [];

      if (goalType === 'leads') {
        // For leads: count of won opportunities = qualified leads
        return { achieved: opps.length };
      } else {
        // For revenue: sum of commission_value or valor_previsto
        const sum = opps.reduce((s, opp) => s + ((opp as any).commission_value ?? opp.valor_previsto ?? 0), 0);
        return { achieved: sum };
      }
    },
    enabled: !!organization?.id,
  });

  // Calculate PACE data
  const holidaysList = holidays || [];
  const workingDaysTotal = getWorkingDays(monthStart, monthEnd, holidaysList);
  const effectiveToday = isBefore(today, monthEnd) ? today : monthEnd;
  const workingDaysPassed = getWorkingDaysUntilDate(monthStart, effectiveToday, holidaysList);
  const workingDaysRemaining = workingDaysTotal - workingDaysPassed;

  const dailyTarget = workingDaysTotal > 0 ? monthlyTarget / workingDaysTotal : 0;
  const targetUntilToday = dailyTarget * workingDaysPassed;
  const achieved = achievedData?.achieved || 0;
  const dailyAchieved = workingDaysPassed > 0 ? achieved / workingDaysPassed : 0;
  const projection = workingDaysRemaining > 0 ? achieved + (dailyAchieved * workingDaysRemaining) : achieved;
  const paceVariance = achieved - targetUntilToday;
  const pacePercentage = targetUntilToday > 0 ? (achieved / targetUntilToday) * 100 : 0;

  // Determine PACE score
  let paceScore: 'red' | 'yellow' | 'green' = 'green';
  if (pacePercentage < 70) {
    paceScore = 'red';
  } else if (pacePercentage < 90) {
    paceScore = 'yellow';
  }

  // Daily activities targets from OTE config
  const dailyActivities = {
    calls: { 
      target: currentUserConfig?.daily_calls_target ?? 15, 
      achieved: 0
    },
    leads: { 
      target: currentUserConfig?.daily_leads_target ?? 4, 
      achieved: 0 
    },
    proposals: { 
      target: currentUserConfig?.daily_proposals_target ?? 3, 
      achieved: 0 
    },
    sales: { 
      target: currentUserConfig?.daily_sales_target ?? 2, 
      achieved: 0 
    },
    revenue: { 
      target: currentUserConfig?.daily_revenue_target ?? dailyTarget, 
      achieved: goalType === 'revenue' ? dailyAchieved : 0 
    },
  };

  const paceData: RepPACEData = {
    monthlyTarget,
    dailyTarget,
    targetUntilToday,
    achieved,
    projection,
    paceVariance,
    pacePercentage,
    paceScore,
    workingDaysTotal,
    workingDaysPassed,
    workingDaysRemaining,
    dailyActivities,
    goalType,
  };

  const hasTarget = monthlyTarget > 0;

  return {
    paceData,
    isLoading: oppsLoading || configLoading,
    hasTarget,
  };
}
