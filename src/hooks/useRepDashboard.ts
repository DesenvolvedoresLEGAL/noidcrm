import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";

export interface RepDashboardData {
  openOpportunities: { count: number; value: number };
  proposalsSent7d: { count: number; pending: number; viewed: number; accepted: number };
  monthlyGoal: { goal: number; achieved: number; percentage: number };
  pendingTasks: { total: number; overdue: number };
  newLeads: { today: number; yesterday: number; last7d: number };
  funnelConversion: { leads: number; opportunities: number; proposals: number; won: number };
  hotLeads: Array<{ id: string; name: string; score: number; source: string; createdAt: string }>;
  atRiskOpportunities: Array<{ id: string; title: string; value: number; daysStale: number; reason: string }>;
  pendingProposals: Array<{ id: string; title: string; value: number; sentAt: string; hoursAgo: number }>;
  inactiveClients: Array<{ id: string; name: string; lastPurchase: string; totalValue: number }>;
  weeklyActivities: { calls: number; emails: number; meetings: number; whatsapp: number };
  pipelineByStage: Array<{ stageId: string; stageName: string; count: number; value: number; color: string }>;
}

export function useRepDashboard() {
  const { user, organization } = useCurrentUser();
  const userId = user?.id;
  const orgId = organization?.id;

  return useQuery({
    queryKey: ["rep-dashboard", userId, orgId],
    queryFn: async (): Promise<RepDashboardData> => {
      if (!userId || !orgId) throw new Error("User or organization not found");

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const today = format(now, "yyyy-MM-dd");
      const yesterday = format(subDays(now, 1), "yyyy-MM-dd");
      const sevenDaysAgo = subDays(now, 7);

      // Get sales pipelines only
      const pipelinesRes = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", orgId)
        .eq("pipeline_type", "sales") as any;
      
      const salesPipelineIds = (pipelinesRes.data || []).map((p: any) => p.id);

      // Open opportunities - ONLY from sales pipelines
      const openOppsRes = await supabase
        .from("opportunities")
        .select("id, valor_previsto, pipeline_id")
        .eq("owner_user_id", userId)
        .eq("status", "open") as any;

      const allOpenOpps = openOppsRes.data || [];
      const openOpps = allOpenOpps.filter((o: any) => salesPipelineIds.includes(o.pipeline_id));
      const openOpportunities = {
        count: openOpps.length,
        value: openOpps.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0),
      };

      // Proposals sent last 7 days - get via user's opportunities
      const userOppIds = openOpps.map((o: any) => o.id);
      const proposalsRes = await (supabase as any)
        .from("proposals")
        .select("id, status, created_at, opportunity_id")
        .in("opportunity_id", userOppIds.length > 0 ? userOppIds : ["none"])
        .gte("created_at", sevenDaysAgo.toISOString());

      const proposals = proposalsRes.data || [];
      const proposalsSent7d = {
        count: proposals.length,
        pending: proposals.filter((p: any) => p.status === "sent").length,
        viewed: proposals.filter((p: any) => p.status === "viewed").length,
        accepted: proposals.filter((p: any) => p.status === "accepted").length,
      };

      // Monthly goal from OTE config (ote_seller_config + ote_levels)
      const sellerConfigRes = await (supabase as any)
        .from("ote_seller_config")
        .select("custom_goal_override, ote_level_id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .is("end_date", null)
        .maybeSingle();

      let monthlyGoalValue = 0;
      if (sellerConfigRes.data) {
        if (sellerConfigRes.data.custom_goal_override) {
          monthlyGoalValue = sellerConfigRes.data.custom_goal_override;
        } else if (sellerConfigRes.data.ote_level_id) {
          const levelRes = await (supabase as any)
            .from("ote_levels")
            .select("monthly_goal")
            .eq("id", sellerConfigRes.data.ote_level_id)
            .single();
          monthlyGoalValue = levelRes.data?.monthly_goal || 0;
        }
      }

      // Won opportunities this month - ONLY from sales pipelines
      const wonOppsRes = await supabase
        .from("opportunities")
        .select("valor_previsto, pipeline_id")
        .eq("owner_user_id", userId)
        .eq("status", "won")
        .gte("updated_at", monthStart.toISOString())
        .lte("updated_at", monthEnd.toISOString()) as any;

      const allWonOpps = wonOppsRes.data || [];
      const wonOpps = allWonOpps.filter((o: any) => salesPipelineIds.includes(o.pipeline_id));
      const achieved = wonOpps.reduce((sum: number, o: any) => sum + (o.valor_previsto || 0), 0);
      const monthlyGoal = {
        goal: monthlyGoalValue,
        achieved,
        percentage: monthlyGoalValue > 0 ? Math.round((achieved / monthlyGoalValue) * 100) : 0,
      };

      // Pending tasks
      const tasksRes = await supabase
        .from("activities")
        .select("id, scheduled_date, status")
        .eq("owner_user_id", userId)
        .eq("status", "pending") as any;

      const tasks = tasksRes.data || [];
      const overdueTasks = tasks.filter(
        (t: any) => t.scheduled_date && new Date(t.scheduled_date) < now
      );
      const pendingTasks = { total: tasks.length, overdue: overdueTasks.length };

      // New leads
      const newLeadsRes = await supabase
        .from("accounts")
        .select("id, created_at")
        .eq("organization_id", orgId)
        .eq("owner_user_id", userId)
        .gte("created_at", sevenDaysAgo.toISOString()) as any;

      const newLeadsData = newLeadsRes.data || [];
      const newLeads = {
        today: newLeadsData.filter((l: any) => l.created_at?.startsWith(today)).length,
        yesterday: newLeadsData.filter((l: any) => l.created_at?.startsWith(yesterday)).length,
        last7d: newLeadsData.length,
      };

      // Funnel counts
      const leadsCountRes = await (supabase as any)
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", userId)
        .eq("organization_id", orgId);

      const oppsCountRes = await (supabase as any)
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", userId);

      // Get all user opportunities for proposal count
      const allUserOppsRes = await (supabase as any)
        .from("opportunities")
        .select("id")
        .eq("owner_user_id", userId);
      
      const allUserOppIds = (allUserOppsRes.data || []).map((o: any) => o.id);
      
      const propsCountRes = await (supabase as any)
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .in("opportunity_id", allUserOppIds.length > 0 ? allUserOppIds : ["none"]);

      // Won count - filter by sales pipelines for accurate conversion
      const wonOppsForFunnel = await (supabase as any)
        .from("opportunities")
        .select("id, pipeline_id")
        .eq("owner_user_id", userId)
        .eq("status", "won");

      const wonInSalesPipelines = (wonOppsForFunnel.data || []).filter((o: any) => salesPipelineIds.includes(o.pipeline_id));

      const funnelConversion = {
        leads: leadsCountRes.count || 0,
        opportunities: oppsCountRes.count || 0,
        proposals: propsCountRes.count || 0,
        won: wonInSalesPipelines.length,
      };

      // Weekly activities
      const activitiesRes = await supabase
        .from("activities")
        .select("type")
        .eq("owner_user_id", userId)
        .gte("created_at", sevenDaysAgo.toISOString()) as any;

      const activities = activitiesRes.data || [];
      const weeklyActivities = {
        calls: activities.filter((a: any) => a.type === "call").length,
        emails: activities.filter((a: any) => a.type === "email").length,
        meetings: activities.filter((a: any) => a.type === "meeting").length,
        whatsapp: activities.filter((a: any) => a.type === "whatsapp").length,
      };

      // Pipeline by stage
      const pipelineOppsRes = await (supabase as any)
        .from("opportunities")
        .select("stage_id, valor_previsto")
        .eq("owner_user_id", userId)
        .eq("status", "open");

      const stagesRes = await (supabase as any)
        .from("stages")
        .select("id, name, color")
        .eq("organization_id", orgId);

      const pipelineOpps = pipelineOppsRes.data || [];
      const stagesData = stagesRes.data || [];
      const stagesMap = new Map(stagesData.map((s: any) => [s.id, { name: s.name, color: s.color }]));
      const stageAggr = new Map<string, { count: number; value: number }>();
      
      pipelineOpps.forEach((opp: any) => {
        const existing = stageAggr.get(opp.stage_id) || { count: 0, value: 0 };
        stageAggr.set(opp.stage_id, {
          count: existing.count + 1,
          value: existing.value + (opp.valor_previsto || 0),
        });
      });

      const pipelineByStage = Array.from(stageAggr.entries()).map(([stageId, data]) => {
        const stageInfo = stagesMap.get(stageId) as { name: string; color: string } | undefined;
        return {
          stageId,
          stageName: stageInfo?.name || "Unknown",
          count: data.count,
          value: data.value,
          color: stageInfo?.color || "#6B7280",
        };
      });

      // Hot leads
      const hotLeadsRes = await supabase
        .from("accounts")
        .select("id, razao_social, nome_fantasia, lead_score, origem_principal, created_at")
        .eq("owner_user_id", userId)
        .eq("organization_id", orgId)
        .not("lead_score", "is", null)
        .order("lead_score", { ascending: false })
        .limit(5) as any;

      const hotLeads = (hotLeadsRes.data || []).map((l: any) => ({
        id: l.id,
        name: l.nome_fantasia || l.razao_social,
        score: l.lead_score || 0,
        source: l.origem_principal || "Desconhecida",
        createdAt: l.created_at || "",
      }));

      // At risk opportunities
      const atRiskRes = await supabase
        .from("opportunities")
        .select("id, title, valor_previsto, updated_at")
        .eq("owner_user_id", userId)
        .eq("status", "open")
        .lt("updated_at", subDays(now, 7).toISOString())
        .order("updated_at", { ascending: true })
        .limit(5) as any;

      const atRiskOpportunities = (atRiskRes.data || []).map((o: any) => {
        const daysStale = Math.floor(
          (now.getTime() - new Date(o.updated_at || now).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: o.id,
          title: o.title,
          value: o.valor_previsto || 0,
          daysStale,
          reason: `${daysStale} dias sem atualização`,
        };
      });

      // Pending proposals - get via user's opportunities
      const pendingProposalsRes = await (supabase as any)
        .from("proposals")
        .select("id, total_amount, created_at, opportunity_id")
        .in("opportunity_id", allUserOppIds.length > 0 ? allUserOppIds : ["none"])
        .eq("status", "sent")
        .lt("created_at", subDays(now, 2).toISOString())
        .limit(5);

      const pendingProposals = (pendingProposalsRes.data || []).map((p: any) => {
        const hoursAgo = Math.floor(
          (now.getTime() - new Date(p.created_at || now).getTime()) / (1000 * 60 * 60)
        );
        return {
          id: p.id,
          title: `Proposta #${p.id.slice(0, 8)}`,
          value: p.total_amount || 0,
          sentAt: p.created_at || "",
          hoursAgo,
        };
      });

      return {
        openOpportunities,
        proposalsSent7d,
        monthlyGoal,
        pendingTasks,
        newLeads,
        funnelConversion,
        hotLeads,
        atRiskOpportunities,
        pendingProposals,
        inactiveClients: [],
        weeklyActivities,
        pipelineByStage,
      };
    },
    enabled: !!userId && !!orgId,
    staleTime: 1000 * 60 * 5,
  });
}
