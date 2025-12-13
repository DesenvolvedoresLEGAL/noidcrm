import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChartData {
  revenueData: { month: string; mrr: number }[];
  signupsData: { date: string; signups: number }[];
  planDistribution: { name: string; value: number; color: string }[];
  aiUsageByFeature: { feature: string; volts: number }[];
  usageData: { day: string; users: number }[];
}

export function useAdminCharts() {
  return useQuery({
    queryKey: ["admin-charts"],
    queryFn: async (): Promise<ChartData> => {
      const now = new Date();

      // 1. MRR Evolution (last 6 months) - from accepted proposals with recurring terms
      const sixMonthsAgo = subMonths(now, 6);
      const { data: mrrByMonth } = await supabase
        .from("proposal_payment_terms")
        .select(`
          monthly_value,
          created_at,
          proposal:proposals!inner(status, created_at)
        `)
        .in("payment_type", ["recurring", "subscription"])
        .gte("created_at", sixMonthsAgo.toISOString());

      // Group by month for accepted proposals
      const mrrByMonthMap: Record<string, number> = {};
      (mrrByMonth || [])
        .filter((d: any) => d.proposal?.status === "accepted")
        .forEach((d: any) => {
          const month = format(new Date(d.created_at), "MMM", { locale: ptBR });
          mrrByMonthMap[month] = (mrrByMonthMap[month] || 0) + (d.monthly_value || 0);
        });

      // Build revenue data for last 6 months
      const revenueData = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(now, 5 - i);
        const month = format(date, "MMM", { locale: ptBR });
        return {
          month,
          mrr: mrrByMonthMap[month] || 0,
        };
      });

      // 2. Signups (last 7 days) - from organizations created
      const sevenDaysAgo = subDays(now, 7);
      const { data: orgsCreated } = await supabase
        .from("organizations")
        .select("created_at")
        .gte("created_at", sevenDaysAgo.toISOString());

      // Group by day
      const signupsByDay: Record<string, number> = {};
      (orgsCreated || []).forEach((org) => {
        const day = format(new Date(org.created_at), "dd/MM");
        signupsByDay[day] = (signupsByDay[day] || 0) + 1;
      });

      const signupsData = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const day = format(date, "dd/MM");
        return {
          date: day,
          signups: signupsByDay[day] || 0,
        };
      });

      // 3. Plan Distribution - from organizations by status
      const { data: orgs } = await supabase
        .from("organizations")
        .select("status, current_plan_id");

      const statusCounts: Record<string, number> = {};
      (orgs || []).forEach((org) => {
        const status = org.status || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const total = orgs?.length || 1;
      const planDistribution = [
        { 
          name: "Trial", 
          value: Math.round(((statusCounts["trial"] || 0) / total) * 100), 
          color: "hsl(var(--muted-foreground))" 
        },
        { 
          name: "Ativo", 
          value: Math.round(((statusCounts["active"] || 0) / total) * 100), 
          color: "hsl(142, 76%, 36%)" 
        },
        { 
          name: "Suspenso", 
          value: Math.round(((statusCounts["suspended"] || 0) / total) * 100), 
          color: "hsl(45, 93%, 47%)" 
        },
        { 
          name: "Cancelado", 
          value: Math.round(((statusCounts["canceled"] || 0) / total) * 100), 
          color: "hsl(0, 84%, 60%)" 
        },
      ].filter(p => p.value > 0);

      // 4. AI Usage by Feature
      const { data: aiUsage } = await supabase
        .from("ai_usage_logs")
        .select("feature, volts_used");

      const voltsByFeature: Record<string, number> = {};
      (aiUsage || []).forEach((log) => {
        const feature = log.feature || "Outros";
        voltsByFeature[feature] = (voltsByFeature[feature] || 0) + (log.volts_used || 0);
      });

      const aiUsageByFeature = Object.entries(voltsByFeature)
        .map(([feature, volts]) => ({ feature, volts }))
        .sort((a, b) => b.volts - a.volts)
        .slice(0, 5);

      // 5. Daily Active Users (last 7 days)
      const { data: activities } = await supabase
        .from("activities")
        .select("created_at, owner_user_id")
        .gte("created_at", sevenDaysAgo.toISOString());

      // Group by day counting unique users
      const usersByDay: Record<string, Set<string>> = {};
      (activities || []).forEach((act) => {
        const dayName = format(new Date(act.created_at), "EEE", { locale: ptBR });
        if (!usersByDay[dayName]) usersByDay[dayName] = new Set();
        if (act.owner_user_id) usersByDay[dayName].add(act.owner_user_id);
      });

      const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      const usageData = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const dayName = format(date, "EEE", { locale: ptBR });
        return {
          day: dayName.charAt(0).toUpperCase() + dayName.slice(1, 3),
          users: usersByDay[dayName]?.size || 0,
        };
      });

      return {
        revenueData,
        signupsData,
        planDistribution,
        aiUsageByFeature,
        usageData,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
