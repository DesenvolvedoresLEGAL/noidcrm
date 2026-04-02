import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from './useCurrentUser';
import { useHolidays, useSalesConfig, useSellerTargets } from './useSalesConfig';
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend, isBefore, isToday, parseISO } from 'date-fns';
import { toast } from 'sonner';

export interface DailyActivityLog {
  id: string;
  organization_id: string;
  user_id: string;
  log_date: string;
  calls_made: number;
  leads_generated: number;
  proposals_sent: number;
  sales_closed: number;
  revenue_closed: number;
  outbound_calls: number;
  inbound_leads: number;
  referral_requests: number;
  pace_score: 'red' | 'yellow' | 'green' | 'pending';
  pace_percentage: number;
  notes: string | null;
}

export interface PACEMetrics {
  userId: string;
  userName: string;
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
  goalType?: 'revenue' | 'leads';
}

export function getWorkingDays(
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

export function getWorkingDaysUntilDate(
  startDate: Date,
  targetDate: Date,
  holidays: { holiday_date: string }[]
): number {
  if (isBefore(targetDate, startDate)) return 0;
  return getWorkingDays(startDate, targetDate, holidays);
}

export function usePACEData(month?: Date) {
  const { organization } = useCurrentUser();
  const currentMonth = month || new Date();
  const periodMonth = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  
  const { holidays } = useHolidays(currentMonth.getFullYear());
  const { config } = useSalesConfig();
  const { targets } = useSellerTargets(periodMonth);

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-pace', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select(`user_id, org_role, profiles!inner(full_name, avatar_url)`)
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .in('org_role', ['sales', 'manager']);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });


  const { data: sellerConfigs } = useQuery({
    queryKey: ['seller-configs-pace', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('ote_seller_config')
        .select('user_id, custom_goal_override, ote_level:ote_levels(monthly_goal, goal_type)')
        .eq('organization_id', organization.id)
        .is('end_date', null);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Fetch qualification pipelines for lead counting
  const { data: qualificationPipelines } = useQuery({
    queryKey: ['qualification-pipelines', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('pipeline_type', 'qualification');
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const qualificationPipelineIds = qualificationPipelines?.map(p => p.id) || [];

  // Fetch won opportunities for the month (using commission_value for goal tracking)
  const { data: wonOpportunities } = useQuery({
    queryKey: ['won-opportunities-pace', organization?.id, periodMonth],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, owner_user_id, valor_previsto, commission_value, updated_at, pipeline_id')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Calculate PACE metrics for each seller
  const paceMetrics: PACEMetrics[] = teamMembers?.map((member) => {
    const userId = member.user_id;
    const userName = (member.profiles as any)?.full_name || 'Usuário';
    
    // Determine goal_type from OTE config
    const sellerConfig = sellerConfigs?.find(sc => sc.user_id === userId);
    const goalType: 'revenue' | 'leads' = (sellerConfig?.ote_level as any)?.goal_type === 'leads' ? 'leads' : 'revenue';

    // Get seller's target for this month
    const sellerTarget = targets?.find(t => t.user_id === userId);
    let monthlyTarget: number;
    if (goalType === 'leads') {
      // For leads: use monthly_goal from OTE level (count of leads)
      monthlyTarget = sellerConfig?.custom_goal_override || (sellerConfig?.ote_level as any)?.monthly_goal || 0;
    } else {
      monthlyTarget = sellerTarget?.monthly_revenue_target || 0;
    }
    
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
    
    // Calculate achieved based on goal_type
    let achieved: number;
    if (goalType === 'leads') {
      // Count won opportunities from qualification pipelines
      achieved = wonOpportunities
        ?.filter(o => o.owner_user_id === userId && qualificationPipelineIds.includes(o.pipeline_id))
        .length || 0;
    } else {
      // Sum revenue - use commission_value if available, fallback to valor_previsto
      achieved = wonOpportunities
        ?.filter(o => o.owner_user_id === userId)
        .reduce((sum, o) => sum + ((o as any).commission_value ?? o.valor_previsto ?? 0), 0) || 0;
    }
    
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
      userId,
      userName,
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
      goalType,
    };
  }) || [];

  return {
    paceMetrics,
    holidays,
    config,
    targets,
    teamMembers,
    isLoading: !teamMembers || !wonOpportunities,
  };
}

export function useDailyActivityLog(userId?: string, month?: Date) {
  const { organization, user } = useCurrentUser();
  const queryClient = useQueryClient();
  const currentMonth = month || new Date();
  const targetUserId = userId || user?.id;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['daily-activity-log', organization?.id, targetUserId, format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      if (!organization?.id || !targetUserId) return [];
      
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const { data, error } = await supabase
        .from('daily_activity_log')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('user_id', targetUserId)
        .gte('log_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('log_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('log_date', { ascending: false });
      
      if (error) throw error;
      return data as DailyActivityLog[];
    },
    enabled: !!organization?.id && !!targetUserId,
  });

  const { mutateAsync: upsertLog } = useMutation({
    mutationFn: async (log: Partial<DailyActivityLog> & { log_date: string }) => {
      if (!organization?.id || !targetUserId) throw new Error('Missing data');
      
      const { data, error } = await supabase
        .from('daily_activity_log')
        .upsert({
          organization_id: organization.id,
          user_id: targetUserId,
          ...log,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-activity-log'] });
      toast.success('Atividade registrada');
    },
  });

  return {
    logs,
    isLoading,
    upsertLog,
  };
}

export function useReverseFunnel() {
  const { config } = useSalesConfig();
  
  const calculateReverseFunnel = (targetRevenue: number) => {
    if (!config) {
      return {
        outbound: { calls: 0, leads: 0, mqls: 0, proposals: 0, sales: 0, revenue: 0 },
        inbound: { leads: 0, mqls: 0, proposals: 0, sales: 0, revenue: 0 },
        referral: { requests: 0, leads: 0, proposals: 0, sales: 0, revenue: 0 },
        total: { sales: 0, proposals: 0, mqls: 0, leads: 0 },
      };
    }
    
    const averageTicket = config.average_ticket || 1000;
    
    // Revenue by channel
    const outboundRevenue = targetRevenue * config.revenue_share_outbound;
    const inboundRevenue = targetRevenue * config.revenue_share_inbound;
    const referralRevenue = targetRevenue * config.revenue_share_referral;
    
    // Outbound funnel (reverse calculation)
    const outboundSales = outboundRevenue / averageTicket;
    const outboundProposals = outboundSales / config.outbound_proposal_to_sale;
    const outboundMQLs = outboundProposals / config.outbound_mql_to_proposal;
    const outboundLeads = outboundMQLs / config.outbound_lead_to_mql;
    const outboundCalls = outboundLeads / config.outbound_call_to_lead;
    
    // Inbound funnel
    const inboundSales = inboundRevenue / averageTicket;
    const inboundProposals = inboundSales / config.inbound_proposal_to_sale;
    const inboundMQLs = inboundProposals / config.inbound_mql_to_proposal;
    const inboundLeads = inboundMQLs / config.inbound_lead_to_mql;
    
    // Referral funnel
    const referralSales = referralRevenue / averageTicket;
    const referralProposals = referralSales / config.referral_proposal_to_sale;
    const referralLeads = referralProposals / config.referral_lead_to_proposal;
    const referralRequests = referralLeads / config.referral_request_to_lead;
    
    return {
      outbound: {
        calls: Math.ceil(outboundCalls),
        leads: Math.ceil(outboundLeads),
        mqls: Math.ceil(outboundMQLs),
        proposals: Math.ceil(outboundProposals),
        sales: Math.ceil(outboundSales),
        revenue: outboundRevenue,
      },
      inbound: {
        leads: Math.ceil(inboundLeads),
        mqls: Math.ceil(inboundMQLs),
        proposals: Math.ceil(inboundProposals),
        sales: Math.ceil(inboundSales),
        revenue: inboundRevenue,
      },
      referral: {
        requests: Math.ceil(referralRequests),
        leads: Math.ceil(referralLeads),
        proposals: Math.ceil(referralProposals),
        sales: Math.ceil(referralSales),
        revenue: referralRevenue,
      },
      total: {
        sales: Math.ceil(outboundSales + inboundSales + referralSales),
        proposals: Math.ceil(outboundProposals + inboundProposals + referralProposals),
        mqls: Math.ceil(outboundMQLs + inboundMQLs),
        leads: Math.ceil(outboundLeads + inboundLeads + referralLeads),
      },
    };
  };
  
  return { calculateReverseFunnel, config };
}
