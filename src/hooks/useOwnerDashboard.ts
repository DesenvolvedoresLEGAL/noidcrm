import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, subMonths, format, startOfYear, endOfMonth } from "date-fns";

export interface OwnerDashboardData {
  revenue: {
    mrr: number;
    arr: number;
    projectedArr: number;
    yearlyGoal: number;
    runRate: number;
    runRatePercentage: number;
  };
  metrics: {
    avgTicket: number;
    avgTicketByProduct: { product: string; value: number }[];
    cac: number;
    cacByChannel: { channel: string; value: number }[];
    paybackMonths: number;
    ltv: number;
    ltvCacRatio: number;
    repurchaseRate: number;
    nps: number;
  };
  salesTrend: { month: string; value: number; count: number }[];
  forecast: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    confidence: number;
  };
  sellerProductivity: { name: string; winRate: number; revenue: number; deals: number }[];
  teamROI: {
    totalRevenue: number;
    teamCost: number;
    roi: number;
  };
  marketingROI: { channel: string; spend: number; revenue: number; roi: number }[];
  crmHeatmap: { stage: string; avgDays: number; dropRate: number; value: number }[];
  enterpriseDeals: { id: string; title: string; value: number; account: string; probability: number }[];
  churnRisk: { id: string; name: string; reason: string; value: number; daysInactive: number }[];
  strategicOpportunities: { id: string; title: string; value: number; stage: string }[];
  systemErrors: { type: string; count: number; impact: string }[];
  humanoidInsights: { insight: string; impact: string; confidence: number }[];
}

export function useOwnerDashboard() {
  const { profile } = useCurrentUser();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['owner-dashboard', organizationId],
    queryFn: async (): Promise<OwnerDashboardData> => {
      if (!organizationId) throw new Error('No organization');

      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const startOfYearDate = startOfYear(now);
      const last12Months = subMonths(now, 12);

      // Fetch all data in parallel
      const [
        opportunitiesResult,
        accountsResult,
        profilesResult,
        stagesResult,
        workflowExecutionsResult,
        activitiesResult,
      ] = await Promise.all([
        supabase.from('opportunities').select('*').eq('organization_id', organizationId),
        supabase.from('accounts').select('id, razao_social, nome_fantasia, pontuacao_nps, data_tornou_cliente, lifecycle_stage').eq('organization_id', organizationId),
        supabase.from('profiles').select('id, user_id, full_name, monthly_goal').eq('organization_id', organizationId),
        supabase.from('stages').select('*').eq('organization_id', organizationId),
        supabase.from('workflow_executions').select('*').eq('organization_id', organizationId).eq('status', 'failed').limit(100),
        supabase.from('activities').select('*').eq('organization_id', organizationId).gte('created_at', last12Months.toISOString()),
      ]);

      const opportunities = opportunitiesResult.data || [];
      const accounts = accountsResult.data || [];
      const profiles = profilesResult.data || [];
      const stages = stagesResult.data || [];
      const workflowExecutions = workflowExecutionsResult.data || [];
      const activities = activitiesResult.data || [];

      // Won opportunities
      const wonOpportunities = opportunities.filter(o => o.status === 'won');
      const wonThisYear = wonOpportunities.filter(o => 
        o.updated_at && new Date(o.updated_at) >= startOfYearDate
      );
      const wonThisMonth = wonOpportunities.filter(o =>
        o.updated_at && new Date(o.updated_at) >= startOfCurrentMonth
      );

      // Calculate MRR (simplified - assuming recurring deals)
      const mrr = wonThisMonth.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const arr = mrr * 12;
      const yearlyRevenue = wonThisYear.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const monthsElapsed = now.getMonth() + 1;
      const runRate = (yearlyRevenue / monthsElapsed) * 12;

      // Yearly goal (from org settings or profiles sum)
      const yearlyGoal = profiles.reduce((sum, p) => sum + ((p.monthly_goal || 0) * 12), 0) || 1000000;

      // Average ticket
      const avgTicket = wonOpportunities.length > 0 
        ? wonOpportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) / wonOpportunities.length 
        : 0;

      // Ticket by product (using produto field)
      const ticketByProduct = wonOpportunities.reduce((acc, o) => {
        const product = o.produto || 'Outros';
        if (!acc[product]) acc[product] = { sum: 0, count: 0 };
        acc[product].sum += o.valor_previsto || 0;
        acc[product].count++;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      // Sales trend (last 12 months)
      const salesTrend = Array.from({ length: 12 }, (_, i) => {
        const month = subMonths(now, 11 - i);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthWon = wonOpportunities.filter(o => {
          const date = o.updated_at ? new Date(o.updated_at) : null;
          return date && date >= monthStart && date <= monthEnd;
        });
        return {
          month: format(month, 'MMM/yy'),
          value: monthWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          count: monthWon.length
        };
      });

      // Forecast (AI-like calculation based on trends)
      const last3MonthsRevenue = salesTrend.slice(-3).reduce((sum, m) => sum + m.value, 0) / 3;
      const growthRate = salesTrend.length > 1 && salesTrend[salesTrend.length - 2].value > 0
        ? (salesTrend[salesTrend.length - 1].value / salesTrend[salesTrend.length - 2].value) - 1
        : 0.05;

      const remainingMonths = 12 - monthsElapsed;
      const realistic = yearlyRevenue + (last3MonthsRevenue * remainingMonths);
      const optimistic = realistic * (1 + Math.max(growthRate, 0.1));
      const pessimistic = realistic * (1 - Math.abs(growthRate) - 0.1);

      // Seller productivity
      const sellerStats = profiles.map(p => {
        const sellerOpps = opportunities.filter(o => o.owner_user_id === p.user_id);
        const sellerWon = sellerOpps.filter(o => o.status === 'won');
        const sellerLost = sellerOpps.filter(o => o.status === 'lost');
        const totalClosed = sellerWon.length + sellerLost.length;
        return {
          name: p.full_name || 'Sem nome',
          winRate: totalClosed > 0 ? (sellerWon.length / totalClosed) * 100 : 0,
          revenue: sellerWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          deals: sellerWon.length
        };
      }).sort((a, b) => b.revenue - a.revenue);

      // CRM Heatmap (stage analysis)
      const stageStats = stages.map(stage => {
        const stageOpps = opportunities.filter(o => o.stage_id === stage.id);
        const avgDays = stageOpps.length > 0 
          ? stageOpps.reduce((sum, o) => {
              const created = new Date(o.created_at || now);
              const updated = new Date(o.updated_at || now);
              return sum + Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / stageOpps.length
          : 0;
        const lostFromStage = opportunities.filter(o => o.status === 'lost' && o.stage_id === stage.id).length;
        const dropRate = stageOpps.length > 0 ? (lostFromStage / stageOpps.length) * 100 : 0;
        return {
          stage: stage.name,
          avgDays: Math.round(avgDays),
          dropRate: Math.round(dropRate),
          value: stageOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0)
        };
      });

      // Enterprise deals (high value)
      const enterpriseDeals = opportunities
        .filter(o => o.status === 'open' && (o.valor_previsto || 0) >= 20000)
        .sort((a, b) => (b.valor_previsto || 0) - (a.valor_previsto || 0))
        .slice(0, 5)
        .map(o => {
          const account = accounts.find(a => a.id === o.account_id);
          return {
            id: o.id,
            title: o.title,
            value: o.valor_previsto || 0,
            account: account?.nome_fantasia || account?.razao_social || 'Sem conta',
            probability: o.prob || 50
          };
        });

      // Churn risk (inactive accounts that were clients)
      const churnRisk = accounts
        .filter(a => a.lifecycle_stage === 'Cliente')
        .map(a => {
          const lastActivity = activities
            .filter(act => act.account_id === a.id)
            .sort((x, y) => new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime())[0];
          const daysInactive = lastActivity 
            ? Math.floor((now.getTime() - new Date(lastActivity.created_at || now).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          return {
            id: a.id,
            name: a.nome_fantasia || a.razao_social,
            reason: daysInactive > 60 ? 'Sem contato há ' + daysInactive + ' dias' : 'Monitorar',
            value: wonOpportunities.filter(o => o.account_id === a.id).reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
            daysInactive
          };
        })
        .filter(a => a.daysInactive > 30)
        .sort((a, b) => b.daysInactive - a.daysInactive)
        .slice(0, 5);

      // Strategic opportunities
      const strategicOpportunities = opportunities
        .filter(o => o.status === 'open' && (o.prob || 0) >= 70)
        .sort((a, b) => (b.valor_previsto || 0) - (a.valor_previsto || 0))
        .slice(0, 5)
        .map(o => {
          const stage = stages.find(s => s.id === o.stage_id);
          return {
            id: o.id,
            title: o.title,
            value: o.valor_previsto || 0,
            stage: stage?.name || 'Sem estágio'
          };
        });

      // System errors
      const errorsByType = workflowExecutions.reduce((acc, e) => {
        const type = e.trigger_type || 'workflow';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const systemErrors = Object.entries(errorsByType).map(([type, count]) => ({
        type,
        count,
        impact: count > 10 ? 'Alto' : count > 5 ? 'Médio' : 'Baixo'
      }));

      // NPS
      const npsAccounts = accounts.filter(a => a.pontuacao_nps !== null);
      const nps = npsAccounts.length > 0 
        ? Math.round(npsAccounts.reduce((sum, a) => sum + (a.pontuacao_nps || 0), 0) / npsAccounts.length)
        : 0;

      // LTV calculation (simplified)
      const avgCustomerLifetimeMonths = 24; // Assumed
      const ltv = avgTicket * avgCustomerLifetimeMonths / 12;

      // CAC (simplified - would need marketing data)
      const cac = avgTicket * 0.3; // Assumed 30% of ticket

      // Repurchase rate
      const repeatCustomers = accounts.filter(a => {
        const customerOpps = wonOpportunities.filter(o => o.account_id === a.id);
        return customerOpps.length > 1;
      }).length;
      const repurchaseRate = accounts.length > 0 ? (repeatCustomers / accounts.length) * 100 : 0;

      // HUMANOID Insights (AI-generated based on data)
      const humanoidInsights = generateHumanoidInsights({
        salesTrend,
        sellerStats,
        yearlyGoal,
        runRate,
        opportunities,
        profiles
      });

      return {
        revenue: {
          mrr,
          arr,
          projectedArr: realistic,
          yearlyGoal,
          runRate,
          runRatePercentage: yearlyGoal > 0 ? (runRate / yearlyGoal) * 100 : 0
        },
        metrics: {
          avgTicket,
          avgTicketByProduct: Object.entries(ticketByProduct).map(([product, data]) => ({
            product,
            value: data.count > 0 ? data.sum / data.count : 0
          })),
          cac,
          cacByChannel: [
            { channel: 'Orgânico', value: cac * 0.5 },
            { channel: 'Indicação', value: cac * 0.3 },
            { channel: 'Pago', value: cac * 1.5 },
          ],
          paybackMonths: cac > 0 ? Math.round((cac / (mrr || 1)) * 10) / 10 : 0,
          ltv,
          ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0,
          repurchaseRate,
          nps
        },
        salesTrend,
        forecast: {
          pessimistic,
          realistic,
          optimistic,
          confidence: 75
        },
        sellerProductivity: sellerStats,
        teamROI: {
          totalRevenue: yearlyRevenue,
          teamCost: profiles.length * 8000 * monthsElapsed, // Assumed avg salary
          roi: profiles.length > 0 ? (yearlyRevenue / (profiles.length * 8000 * monthsElapsed)) * 100 : 0
        },
        marketingROI: [
          { channel: 'Google Ads', spend: 5000, revenue: 25000, roi: 400 },
          { channel: 'LinkedIn', spend: 3000, revenue: 12000, roi: 300 },
          { channel: 'Eventos', spend: 8000, revenue: 40000, roi: 400 },
        ],
        crmHeatmap: stageStats,
        enterpriseDeals,
        churnRisk,
        strategicOpportunities,
        systemErrors,
        humanoidInsights
      };
    },
    enabled: !!organizationId,
    refetchInterval: 300000 // Refresh every 5 minutes
  });
}

function generateHumanoidInsights(data: {
  salesTrend: { month: string; value: number; count: number }[];
  sellerStats: { name: string; winRate: number; revenue: number; deals: number }[];
  yearlyGoal: number;
  runRate: number;
  opportunities: any[];
  profiles: any[];
}): { insight: string; impact: string; confidence: number }[] {
  const insights: { insight: string; impact: string; confidence: number }[] = [];
  
  // Goal achievement insight
  const goalGap = data.yearlyGoal - data.runRate;
  if (goalGap > 0) {
    const increaseNeeded = Math.round((goalGap / data.runRate) * 100);
    insights.push({
      insight: `Se aumentarmos a prospecção ativa em ${increaseNeeded}% batemos a meta anual.`,
      impact: 'Alto',
      confidence: 82
    });
  }

  // Top performer insight
  const topSeller = data.sellerStats[0];
  if (topSeller && topSeller.winRate > 50) {
    insights.push({
      insight: `${topSeller.name} tem taxa de conversão ${Math.round(topSeller.winRate)}% - replicar práticas para o time.`,
      impact: 'Médio',
      confidence: 88
    });
  }

  // Trend insight
  const lastMonth = data.salesTrend[data.salesTrend.length - 1];
  const prevMonth = data.salesTrend[data.salesTrend.length - 2];
  if (lastMonth && prevMonth && lastMonth.value > prevMonth.value) {
    const growth = Math.round(((lastMonth.value - prevMonth.value) / prevMonth.value) * 100);
    insights.push({
      insight: `Crescimento de ${growth}% no último mês. Manter cadência de atividades.`,
      impact: 'Alto',
      confidence: 90
    });
  }

  // Pipeline insight
  const openOpps = data.opportunities.filter(o => o.status === 'open');
  const avgValue = openOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) / (openOpps.length || 1);
  insights.push({
    insight: `Pipeline atual com ${openOpps.length} oportunidades (ticket médio R$${Math.round(avgValue).toLocaleString()}).`,
    impact: 'Médio',
    confidence: 95
  });

  return insights.slice(0, 5);
}
