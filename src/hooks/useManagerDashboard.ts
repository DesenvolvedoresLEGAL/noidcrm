import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, endOfMonth, subDays, differenceInDays } from "date-fns";

export interface TeamMemberStats {
  userId: string;
  name: string;
  avatarUrl: string | null;
  monthlyGoal: number;
  achieved: number;
  percentage: number;
  openOpportunities: number;
  pipelineValue: number;
  conversionRate: number;
  activitiesThisWeek: number;
  proposalsSent: number;
  pendingProposals: number;
  avgCycleTime: number;
}

export interface ManagerDashboardData {
  // KPIs
  teamGoal: { goal: number; achieved: number; percentage: number };
  forecastAI: { probability: number; predictedValue: number };
  teamConversionRate: number;
  totalOpenOpportunities: number;
  totalPipelineValue: number;
  leadsByOrigin: Array<{ origin: string; count: number }>;
  
  // Revenue metrics
  teamRevenue: {
    closedOneTime: number;
    closedMRR: number;
    totalMRR: number;
  };
  
  // Team members
  teamMembers: TeamMemberStats[];
  
  // Funnel
  teamFunnel: { leads: number; opportunities: number; proposals: number; won: number };
  
  // Activity heatmap
  activityHeatmap: Array<{
    userId: string;
    name: string;
    calls: number;
    emails: number;
    meetings: number;
    whatsapp: number;
    total: number;
  }>;
  
  // Loss reasons
  lossReasons: Array<{ reason: string; count: number; value: number }>;
  
  // Sales velocity
  avgCycleTime: number;
  
  // Pipeline aging
  pipelineAging: Array<{ range: string; count: number; value: number }>;
  
  // Proposals by stage
  proposalsByStatus: Array<{ status: string; count: number; value: number }>;
  
  // Smart lists
  atRiskSellers: Array<{ userId: string; name: string; achieved: number; goal: number; gap: number }>;
  highValueOpportunities: Array<{ id: string; title: string; value: number; owner: string; stage: string }>;
  bottlenecks: Array<{ stageId: string; stageName: string; count: number; avgDays: number }>;
  aiRecommendations: Array<{ userId: string; userName: string; action: string; priority: string; deals: number }>;
  
  // Behavior monitor
  behaviorMonitor: Array<{
    userId: string;
    name: string;
    activitiesLogged: number;
    callsMade: number;
    dealsAbandoned: number;
    lastActivity: string | null;
  }>;
}

export function useManagerDashboard() {
  const { user, organization } = useCurrentUser();
  const userId = user?.id;
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["manager-dashboard", userId, orgId],
    queryFn: async (): Promise<ManagerDashboardData> => {
      if (!userId || !orgId) throw new Error("User or organization not found");

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const sevenDaysAgo = subDays(now, 7);

      // Get team members (all active members in org except current user if they're manager)
      const membersRes = await (supabase as any)
        .from("organization_members")
        .select("user_id, org_role")
        .eq("organization_id", orgId)
        .eq("status", "active");

      const memberIds = (membersRes.data || [])
        .filter((m: any) => m.org_role === "sales" || m.org_role === "manager")
        .map((m: any) => m.user_id);

      // Get profiles for team members
      const profilesRes = await (supabase as any)
        .from("profiles")
        .select("user_id, full_name, avatar_url, monthly_goal")
        .in("user_id", memberIds.length > 0 ? memberIds : ["none"]);

      const profiles = profilesRes.data || [];
      const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null; monthly_goal: number | null }>(
        profiles.map((p: any) => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url, monthly_goal: p.monthly_goal }])
      );

      // Get pipelines to filter by pipeline_type='sales'
      const pipelinesRes = await (supabase as any)
        .from("pipelines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("pipeline_type", "sales");
      
      const salesPipelineIds = (pipelinesRes.data || []).map((p: any) => p.id);

      // Get all opportunities for team - ONLY from sales pipelines for revenue metrics
      const oppsRes = await (supabase as any)
        .from("opportunities")
        .select("id, title, valor_previsto, commission_value, status, owner_user_id, stage_id, pipeline_id, created_at, updated_at, loss_reason_id")
        .eq("organization_id", orgId)
        .in("owner_user_id", memberIds.length > 0 ? memberIds : ["none"]);

      const allOpportunities = oppsRes.data || [];
      
      // Filter to only sales pipeline opportunities for revenue calculations
      const opportunities = allOpportunities.filter((o: any) => salesPipelineIds.includes(o.pipeline_id));

      // Get all proposals for team via opportunity ownership
      const teamOpportunityIds = (oppsRes.data || []).map((o: any) => o.id);
      const proposalsRes = await (supabase as any)
        .from("proposals")
        .select("id, status, total_amount, opportunity_id, created_at")
        .in("opportunity_id", teamOpportunityIds.length > 0 ? teamOpportunityIds : ["none"]);

      const proposals = proposalsRes.data || [];

      // Get all activities for team this week
      const activitiesRes = await (supabase as any)
        .from("activities")
        .select("id, type, owner_user_id, created_at")
        .eq("organization_id", orgId)
        .in("owner_user_id", memberIds.length > 0 ? memberIds : ["none"])
        .gte("created_at", sevenDaysAgo.toISOString());

      const activities = activitiesRes.data || [];

      // Get accounts for leads count
      const accountsRes = await (supabase as any)
        .from("accounts")
        .select("id, owner_user_id, origem_principal, created_at")
        .eq("organization_id", orgId);

      const accounts = accountsRes.data || [];

      // Get loss reasons
      const lossReasonsRes = await (supabase as any)
        .from("loss_reasons")
        .select("id, name")
        .eq("organization_id", orgId);

      const lossReasonsData = lossReasonsRes.data || [];
      const lossReasonsMap = new Map<string, string>(lossReasonsData.map((lr: any) => [lr.id, lr.name]));

      // Get pipeline stages
      const stagesRes = await (supabase as any)
        .from("stages")
        .select("id, name")
        .eq("organization_id", orgId);

      const stages = stagesRes.data || [];
      const stagesMap = new Map<string, string>(stages.map((s: any) => [s.id, s.name]));

      // Calculate team goal
      // Use closed_at for accurate date tracking (immutable close date, fallback to updated_at)
      const totalGoal = profiles.reduce((sum: number, p: any) => sum + (p.monthly_goal || 0), 0);
      const wonThisMonth = opportunities.filter((o: any) => {
        if (o.status !== "won") return false;
        const closeDate = new Date(o.closed_at || o.updated_at);
        return closeDate >= monthStart && closeDate <= monthEnd;
      });
      const totalAchieved = wonThisMonth.reduce((sum: number, o: any) => sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);
      const teamGoal = {
        goal: totalGoal,
        achieved: totalAchieved,
        percentage: totalGoal > 0 ? Math.round((totalAchieved / totalGoal) * 100) : 0,
      };

      // =================== TEAM REVENUE: ONE-TIME VS MRR ===================
      // Fetch proposals with payment terms to identify recurring revenue
      const wonOpportunityIds = wonThisMonth.map((o: any) => o.id);
      const { data: teamProposalsWithTerms } = await supabase
        .from('proposals')
        .select('opportunity_id, proposal_payment_terms(payment_type, monthly_value)')
        .eq('organization_id', orgId)
        .eq('status', 'accepted')
        .in('opportunity_id', wonOpportunityIds.length > 0 ? wonOpportunityIds : ['none']);

      const teamRecurringMRRByOpp = new Map<string, number>();
      const teamOppsWithRecurring = new Set<string>();
      
      (teamProposalsWithTerms || []).forEach((p: any) => {
        const terms = p.proposal_payment_terms || [];
        terms.forEach((t: any) => {
          if (t.payment_type === 'recurring' || t.payment_type === 'monthly') {
            teamOppsWithRecurring.add(p.opportunity_id);
            const current = teamRecurringMRRByOpp.get(p.opportunity_id) || 0;
            teamRecurringMRRByOpp.set(p.opportunity_id, current + (t.monthly_value || 0));
          }
        });
      });

      // Team closed MRR this month
      const teamClosedMRR = wonThisMonth.reduce((sum: number, o: any) => {
        return sum + (teamRecurringMRRByOpp.get(o.id) || 0);
      }, 0);

      // Team closed one-time this month (opportunities without recurring)
      const teamClosedOneTime = wonThisMonth
        .filter((o: any) => !teamOppsWithRecurring.has(o.id))
        .reduce((sum: number, o: any) => sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);

      // Total MRR usando função centralizada
      const { calculateRealMRR } = await import('@/services/crm/mrr-calculations');
      const mrrResult = await calculateRealMRR({ 
        organizationId: orgId, 
        onlySalesPipelines: true 
      });
      const teamTotalMRR = mrrResult.totalMRR;

      const teamRevenue = {
        closedOneTime: teamClosedOneTime,
        closedMRR: teamClosedMRR,
        totalMRR: teamTotalMRR,
      };

      // AI Forecast (simplified calculation based on pipeline and conversion)
      const openOpps = opportunities.filter((o: any) => o.status === "open");
      const totalOpenValue = openOpps.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0);
      const historicalConversion = opportunities.length > 0
        ? wonThisMonth.length / Math.max(opportunities.filter((o: any) => o.status !== "open").length, 1)
        : 0.3;
      const predictedValue = totalAchieved + (totalOpenValue * historicalConversion);
      const forecastAI = {
        probability: Math.min(Math.round((predictedValue / Math.max(totalGoal, 1)) * 100), 100),
        predictedValue,
      };

      // Team conversion rate
      const totalWon = opportunities.filter((o: any) => o.status === "won").length;
      const totalClosed = opportunities.filter((o: any) => o.status !== "open").length;
      const teamConversionRate = totalClosed > 0 ? Math.round((totalWon / totalClosed) * 100) : 0;

      // Total open opportunities and pipeline value
      const totalOpenOpportunities = openOpps.length;
      const totalPipelineValue = totalOpenValue;

      // Leads by origin
      const originCounts = new Map<string, number>();
      accounts.forEach((a: any) => {
        const origin = a.origem_principal || "Desconhecida";
        originCounts.set(origin, (originCounts.get(origin) || 0) + 1);
      });
      const leadsByOrigin = Array.from(originCounts.entries())
        .map(([origin, count]) => ({ origin, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Team members stats
      const teamMembers: TeamMemberStats[] = memberIds.map((memberId: string) => {
        const profile = profilesMap.get(memberId) || { full_name: "Unknown", monthly_goal: 0, avatar_url: null };
        const memberOpps = opportunities.filter((o: any) => o.owner_user_id === memberId);
        // Use closed_at for accurate date tracking
        const memberWon = memberOpps.filter((o: any) => {
          if (o.status !== "won") return false;
          const closeDate = new Date(o.closed_at || o.updated_at);
          return closeDate >= monthStart;
        });
        const memberOpen = memberOpps.filter((o: any) => o.status === "open");
        const memberClosed = memberOpps.filter((o: any) => o.status !== "open");
        const memberOppIds = memberOpps.map((o: any) => o.id);
        const memberProposals = proposals.filter((p: any) => memberOppIds.includes(p.opportunity_id));
        const memberActivities = activities.filter((a: any) => a.owner_user_id === memberId);

        const achieved = memberWon.reduce((sum: number, o: any) => sum + (o.commission_value ?? o.valor_previsto ?? 0), 0);
        const goal = profile.monthly_goal || 0;

        // Calculate avg cycle time for won deals (use closed_at for accurate timing)
        const wonDeals = memberOpps.filter((o: any) => o.status === "won");
        const avgCycle = wonDeals.length > 0
          ? wonDeals.reduce((sum: number, o: any) => {
              const closeDate = new Date(o.closed_at || o.updated_at);
              return sum + differenceInDays(closeDate, new Date(o.created_at));
            }, 0) / wonDeals.length
          : 0;

        return {
          userId: memberId,
          name: profile.full_name || "Sem nome",
          avatarUrl: profile.avatar_url,
          monthlyGoal: goal,
          achieved,
          percentage: goal > 0 ? Math.round((achieved / goal) * 100) : 0,
          openOpportunities: memberOpen.length,
          pipelineValue: memberOpen.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0),
          conversionRate: memberClosed.length > 0 ? Math.round((memberWon.length / memberClosed.length) * 100) : 0,
          activitiesThisWeek: memberActivities.length,
          proposalsSent: memberProposals.length,
          pendingProposals: memberProposals.filter((p: any) => p.status === "sent").length,
          avgCycleTime: Math.round(avgCycle),
        };
      }).sort((a, b) => b.percentage - a.percentage);

      // Team funnel
      const teamFunnel = {
        leads: accounts.length,
        opportunities: opportunities.length,
        proposals: proposals.length,
        won: totalWon,
      };

      // Activity heatmap
      const activityHeatmap = memberIds.map((memberId: string) => {
        const profile = profilesMap.get(memberId);
        const memberActivities = activities.filter((a: any) => a.owner_user_id === memberId);
        return {
          userId: memberId,
          name: profile?.full_name || "Unknown",
          calls: memberActivities.filter((a: any) => a.type === "call").length,
          emails: memberActivities.filter((a: any) => a.type === "email").length,
          meetings: memberActivities.filter((a: any) => a.type === "meeting").length,
          whatsapp: memberActivities.filter((a: any) => a.type === "whatsapp").length,
          total: memberActivities.length,
        };
      }).sort((a, b) => b.total - a.total);

      // Loss reasons
      const lostOpps = opportunities.filter((o: any) => o.status === "lost");
      const lossReasonCounts = new Map<string, { count: number; value: number }>();
      lostOpps.forEach((o: any) => {
        const reason = o.loss_reason_id ? lossReasonsMap.get(o.loss_reason_id) || "Outro" : "Não informado";
        const existing = lossReasonCounts.get(reason) || { count: 0, value: 0 };
        lossReasonCounts.set(reason, {
          count: existing.count + 1,
          value: existing.value + (o.valor_previsto || 0),
        });
      });
      const lossReasons = Array.from(lossReasonCounts.entries())
        .map(([reason, data]) => ({ reason, ...data }))
        .sort((a, b) => b.count - a.count);

      // Average cycle time (overall)
      const allWonDeals = opportunities.filter((o: any) => o.status === "won");
      const avgCycleTime = allWonDeals.length > 0
        ? Math.round(allWonDeals.reduce((sum: number, o: any) => {
            return sum + differenceInDays(new Date(o.updated_at), new Date(o.created_at));
          }, 0) / allWonDeals.length)
        : 0;

      // Pipeline aging
      const agingRanges = [
        { range: "0-7 dias", min: 0, max: 7 },
        { range: "8-14 dias", min: 8, max: 14 },
        { range: "15-30 dias", min: 15, max: 30 },
        { range: "31-60 dias", min: 31, max: 60 },
        { range: "60+ dias", min: 61, max: Infinity },
      ];
      const pipelineAging = agingRanges.map((range) => {
        const oppsInRange = openOpps.filter((o: any) => {
          const age = differenceInDays(now, new Date(o.created_at));
          return age >= range.min && age <= range.max;
        });
        return {
          range: range.range,
          count: oppsInRange.length,
          value: oppsInRange.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0),
        };
      });

      // Proposals by status
      const proposalStatusCounts = new Map<string, { count: number; value: number }>();
      proposals.forEach((p: any) => {
        const status = p.status || "draft";
        const existing = proposalStatusCounts.get(status) || { count: 0, value: 0 };
        proposalStatusCounts.set(status, {
          count: existing.count + 1,
          value: existing.value + (p.total_amount || 0),
        });
      });
      const proposalsByStatus = Array.from(proposalStatusCounts.entries())
        .map(([status, data]) => ({ status, ...data }));

      // At-risk sellers (below 70% of goal with less than 2 weeks left)
      const daysLeftInMonth = differenceInDays(monthEnd, now);
      const atRiskSellers = teamMembers
        .filter((m) => m.percentage < 70 && m.monthlyGoal > 0)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          achieved: m.achieved,
          goal: m.monthlyGoal,
          gap: m.monthlyGoal - m.achieved,
        }))
        .slice(0, 5);

      // High-value opportunities (>R$20k)
      const highValueOpportunities = openOpps
        .filter((o: any) => (o.valor_previsto || 0) >= 20000)
        .map((o: any) => {
          const owner = profilesMap.get(o.owner_user_id);
          return {
            id: o.id,
            title: o.title,
            value: o.valor_previsto || 0,
            owner: owner?.full_name || "Unknown",
            stage: stagesMap.get(o.stage_id) || "Unknown",
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Bottlenecks (stages with most stale opportunities)
      const stageAging = new Map<string, { count: number; totalDays: number }>();
      openOpps.forEach((o: any) => {
        const age = differenceInDays(now, new Date(o.updated_at));
        if (age >= 7) {
          const existing = stageAging.get(o.stage_id) || { count: 0, totalDays: 0 };
          stageAging.set(o.stage_id, {
            count: existing.count + 1,
            totalDays: existing.totalDays + age,
          });
        }
      });
      const bottlenecks = Array.from(stageAging.entries())
        .map(([stageId, data]) => ({
          stageId,
          stageName: stagesMap.get(stageId) || "Unknown",
          count: data.count,
          avgDays: Math.round(data.totalDays / data.count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // AI Recommendations
      const aiRecommendations: ManagerDashboardData["aiRecommendations"] = [];
      teamMembers.forEach((m) => {
        // Check for pending proposals
        if (m.pendingProposals > 0) {
          aiRecommendations.push({
            userId: m.userId,
            userName: m.name,
            action: `tem ${m.pendingProposals} propostas sem resposta há +48h`,
            priority: m.pendingProposals >= 3 ? "high" : "medium",
            deals: m.pendingProposals,
          });
        }
        // Check for low activity
        if (m.activitiesThisWeek < 5) {
          aiRecommendations.push({
            userId: m.userId,
            userName: m.name,
            action: `registrou apenas ${m.activitiesThisWeek} atividades esta semana`,
            priority: m.activitiesThisWeek === 0 ? "high" : "medium",
            deals: m.openOpportunities,
          });
        }
      });

      // Behavior monitor
      const behaviorMonitor = teamMembers.map((m) => {
        const memberActivities = activities.filter((a: any) => a.owner_user_id === m.userId);
        const lastActivity = memberActivities.length > 0
          ? memberActivities.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
          : null;
        const staleOpps = opportunities.filter(
          (o: any) => o.owner_user_id === m.userId && o.status === "open" && differenceInDays(now, new Date(o.updated_at)) >= 14
        );
        return {
          userId: m.userId,
          name: m.name,
          activitiesLogged: m.activitiesThisWeek,
          callsMade: memberActivities.filter((a: any) => a.type === "call").length,
          dealsAbandoned: staleOpps.length,
          lastActivity,
        };
      });

      return {
        teamGoal,
        forecastAI,
        teamConversionRate,
        totalOpenOpportunities,
        totalPipelineValue,
        leadsByOrigin,
        teamRevenue,
        teamMembers,
        teamFunnel,
        activityHeatmap,
        lossReasons,
        avgCycleTime,
        pipelineAging,
        proposalsByStatus,
        atRiskSellers,
        highValueOpportunities,
        bottlenecks,
        aiRecommendations,
        behaviorMonitor,
      };
    },
    enabled: !!userId && !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}
