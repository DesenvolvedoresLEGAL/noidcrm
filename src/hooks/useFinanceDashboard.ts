import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, endOfMonth, subMonths, format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function useFinanceDashboard() {
  const { organization } = useCurrentUser();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ["finance-dashboard", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization");

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const in30Days = addDays(now, 30);

      // Fetch all data in parallel
      const [
        monthlyRevenueResult,
        pipelineResult,
        pendingProposalsResult,
        salesGoalResult,
        contractsResult,
        oteResult,
      ] = await Promise.all([
        // Monthly Revenue (won opportunities this month)
        supabase
          .from("opportunities")
          .select("valor_previsto")
          .eq("organization_id", organizationId)
          .eq("status", "won")
          .gte("updated_at", monthStart.toISOString())
          .lte("updated_at", monthEnd.toISOString()),

        // Pipeline (open opportunities with probability)
        supabase
          .from("opportunities")
          .select("valor_previsto, prob, stages!inner(probability)")
          .eq("organization_id", organizationId)
          .not("status", "in", '("won","lost")'),

        // Pending Proposals
        supabase
          .from("proposals")
          .select("total_amount")
          .eq("organization_id", organizationId)
          .in("status", ["sent", "viewed"]),

        // Sales Goal
        supabase
          .from("sales_goals")
          .select("target_value")
          .eq("organization_id", organizationId)
          .eq("period_type", "monthly")
          .gte("period_start", monthStart.toISOString())
          .lte("period_start", monthEnd.toISOString())
          .is("user_id", null)
          .maybeSingle(),

        // Contracts
        supabase
          .from("contracts")
          .select("id, title, contract_value, status, end_date, accounts(razao_social, nome_fantasia)")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(5),

        // OTE Results
        supabase
          .from("ote_monthly_results")
          .select("final_variable_amount, user_id, profiles!inner(full_name)")
          .eq("organization_id", organizationId)
          .eq("period_month", format(now, "yyyy-MM"))
          .order("final_variable_amount", { ascending: false })
          .limit(5),
      ]);

      // Calculate Monthly Revenue
      const monthlyRevenue = (monthlyRevenueResult.data || [])
        .reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);

      // Calculate Weighted Pipeline
      const weightedPipeline = (pipelineResult.data || [])
        .reduce((sum, opp) => {
          const prob = opp.prob || opp.stages?.probability || 50;
          return sum + ((opp.valor_previsto || 0) * prob / 100);
        }, 0);

      // Calculate Pending Proposals Value
      const pendingProposals = (pendingProposalsResult.data || [])
        .reduce((sum, prop) => sum + (prop.total_amount || 0), 0);

      // Calculate Goal Progress
      const goalTarget = salesGoalResult.data?.target_value || 0;
      const goalProgress = goalTarget > 0 ? (monthlyRevenue / goalTarget) * 100 : 0;

      // Process Contracts
      const contractsData = contractsResult.data || [];
      const activeContracts = contractsData.filter(c => c.status === "active").length;
      const totalContractValue = contractsData.reduce((sum, c) => sum + (c.contract_value || 0), 0);
      const dueIn30Days = contractsData.filter(c => {
        if (!c.end_date) return false;
        const endDate = new Date(c.end_date);
        return endDate >= now && endDate <= in30Days;
      }).length;

      // Process OTE
      const oteData = (oteResult.data || []) as any[];
      const totalCalculated = oteData.reduce((sum, o) => sum + (o.final_variable_amount || 0), 0);

      // Generate Revenue History (last 6 months)
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(now, 5 - i);
        return {
          month: format(date, "MMM", { locale: ptBR }),
          revenue: 0,
          target: goalTarget || 50000,
        };
      });

      // Current month revenue
      last6Months[5].revenue = monthlyRevenue;

      // Calculate forecast scenarios
      const avgMonthlyRevenue = last6Months.reduce((s, m) => s + m.revenue, 0) / 6 || monthlyRevenue;
      const forecast = {
        pessimistic: avgMonthlyRevenue * 0.7,
        realistic: avgMonthlyRevenue * 1.0,
        optimistic: avgMonthlyRevenue * 1.3,
        bestCase: weightedPipeline,
        trend: monthlyRevenue > avgMonthlyRevenue ? "up" as const : 
               monthlyRevenue < avgMonthlyRevenue ? "down" as const : "stable" as const,
        trendPercent: avgMonthlyRevenue > 0 
          ? ((monthlyRevenue - avgMonthlyRevenue) / avgMonthlyRevenue) * 100 
          : 0,
      };

      return {
        kpis: {
          monthlyRevenue,
          weightedPipeline,
          pendingProposals,
          goalProgress,
        },
        revenueHistory: last6Months,
        contracts: {
          activeContracts,
          totalContractValue,
          dueIn30Days,
          recentContracts: contractsData.map(c => ({
            id: c.id,
            title: c.title,
            accountName: (c.accounts as any)?.nome_fantasia || (c.accounts as any)?.razao_social || "N/A",
            value: c.contract_value || 0,
            endDate: c.end_date,
            status: c.status,
          })),
        },
        ote: {
          totalCalculated,
          totalPending: 0,
          totalPaid: 0,
          topEarners: (oteData as any[]).map(o => ({
            name: o.profiles?.full_name || "N/A",
            amount: o.final_variable_amount || 0,
            achievement: 100,
          })),
        },
        forecast,
      };
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
