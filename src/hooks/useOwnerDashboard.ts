import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import { startOfMonth, subMonths, format, startOfYear, endOfMonth } from "date-fns";
import { parseDateOnly } from "@/lib/dateUtils";
import { ForecastConfidenceResult } from "@/services/crm/forecastConfidence";
import { calculateForecastConfidenceFromNRHS } from "@/lib/forecast/confidenceFromNRHS";
import { subDays } from "date-fns";

export interface OwnerDashboardData {
  revenue: {
    mrr: number;
    arr: number;
    projectedArr: number;
    yearlyGoal: number;
    runRate: number;
    runRatePercentage: number;
    closedRevenue: number; // Total fechado no mês
    closedRevenueOneTime: number; // Receita avulsa fechada no mês
    closedRevenueMRR: number; // Novo MRR fechado no mês
  };
  metrics: {
    avgTicket: number;
    avgTicketByProduct: { product: string; value: number }[];
    repurchaseRate: number;
    nps: number;
    wonDealsCount: number;
    lostDealsCount: number;
    openDealsCount: number;
    conversionRate: number;
  };
  salesTrend: { month: string; value: number; count: number }[];
  forecast: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
    confidence: ForecastConfidenceResult;
    period: 'annual'; // Indica explicitamente que é previsão anual
    periodLabel: string; // Ex: "Jan-Dez 2025"
  };
  sellerProductivity: { name: string; winRate: number; revenue: number; deals: number }[];
  teamROI: {
    totalRevenue: number;
    teamCost: number;
    roi: number;
  };
  crmHeatmap: { stage: string; avgDays: number; dropRate: number; value: number }[];
  enterpriseDeals: { id: string; title: string; value: number; account: string; probability: number }[];
  churnRisk: { id: string; name: string; reason: string; value: number; daysInactive: number }[];
  strategicOpportunities: { id: string; title: string; value: number; stage: string; closeDate: string | null }[];
  systemErrors: { type: string; count: number; impact: string }[];
  humanoidInsights: { insight: string; impact: string; confidence: number }[];
  // For KeyDealsSummary component
  keyDeals: {
    enterprise: { company: string; value: number; stage: string; owner: string }[];
    closingThisMonth: { company: string; value: number; probability: number; daysLeft: number }[];
    churnRisk: { account: string; lastContact: string; risk: number }[];
  };
  revenueComparison: { month: string; revenue: number; target: number }[];
  expiringProposals: { id: string; title: string; clientName: string; expiresAt: string; status: string; opportunityId: string | null; totalAmount: number; urgency: 'expired' | 'today' | 'expiring' }[];
}

export function useOwnerDashboard() {
  const { profile } = useCurrentUser();
  const organizationId = profile?.organization_id;
  const currentMonthKey = format(new Date(), 'yyyy-MM');

  return useQuery({
    queryKey: ['owner-dashboard', organizationId, currentMonthKey, 'ssot-aligned-v5'],
    queryFn: async (): Promise<OwnerDashboardData> => {
      if (!organizationId) throw new Error('No organization');

      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const startOfYearDate = startOfYear(now);
      const last12Months = subMonths(now, 12);

      // First, get accepted proposal IDs (fixes Supabase client join filter bug)
      const { data: acceptedProposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('status', 'accepted');
      
      const acceptedProposalIds = (acceptedProposals || []).map(p => p.id);

      // Fetch all data in parallel
      const [
        opportunitiesResult,
        accountsResult,
        profilesResult,
        stagesResult,
        workflowExecutionsResult,
        activitiesResult,
        pipelinesResult,
        orgMembersResult,
        proposalPaymentTermsResult,
        proposalItemsResult,
        salesConfigResult,
        expiringProposalsResult,
      ] = await Promise.all([
        supabase.from('opportunities').select('id, account_id, owner_user_id, pipeline_id, stage_id, status, valor_previsto, prob, close_date_prevista, closed_at, updated_at, created_at, produto, deleted_at, title, nrhs_score, pipelines!inner(pipeline_type)').eq('organization_id', organizationId).is('deleted_at', null),
        // PERF 0.6D — `data_tornou_cliente` não é consumido aqui.
        supabase.from('accounts').select('id, razao_social, nome_fantasia, pontuacao_nps, lifecycle_stage').eq('organization_id', organizationId),
        // PERF 0.6D — `id` do profile não é usado (chaveamos por user_id).
        supabase.from('profiles').select('user_id, full_name, monthly_goal').eq('organization_id', organizationId),
        // PERF 0.6D — `probability` e `stagnation_alert_days` não são lidos no dashboard owner.
        supabase.from('stages').select('id, name, pipeline_id, order_index').eq('organization_id', organizationId),
        // PERF 0.6D — só `trigger_type` é consumido para o card de erros críticos.
        supabase.from('workflow_executions').select('trigger_type').eq('organization_id', organizationId).eq('status', 'failed').limit(100),
        // PERF 0.6D — só `account_id` e `created_at` são usados para inatividade/churn.
        supabase.from('activities').select('account_id, created_at').eq('organization_id', organizationId).gte('created_at', last12Months.toISOString()),
        supabase.from('pipelines').select('id, name, pipeline_type').eq('organization_id', organizationId),
        supabase.from('organization_members').select('user_id, org_role').eq('organization_id', organizationId).eq('status', 'active'),
        // MRR real de propostas aceitas - use IDs já filtrados
        acceptedProposalIds.length > 0 
          ? supabase.from('proposal_payment_terms').select('monthly_value, payment_type, proposal_id').in('proposal_id', acceptedProposalIds)
          : Promise.resolve({ data: [], error: null }),
        // (proposal_items fetch removed — one-time revenue now derived from proposals.total_amount)
        Promise.resolve({ data: [], error: null }),
        // Buscar configuração de vendas para meta anual centralizada
        supabase.from('sales_config').select('yearly_goal, monthly_revenue_target').eq('organization_id', organizationId).maybeSingle(),
        // Fetch expiring proposals
        supabase.from('proposals')
          .select('id, title, client_name, expires_at, status, opportunity_id, total_amount')
          .eq('organization_id', organizationId)
          .in('status', ['sent', 'viewed'])
          .not('expires_at', 'is', null),
      ]);

      const opportunities = opportunitiesResult.data || [];
      const accounts = accountsResult.data || [];
      const profiles = profilesResult.data || [];
      const stages = stagesResult.data || [];
      const workflowExecutions = workflowExecutionsResult.data || [];
      const activities = activitiesResult.data || [];
      const pipelines = pipelinesResult.data || [];
      const orgMembers = orgMembersResult.data || [];
      const paymentTerms = proposalPaymentTermsResult.data || [];
      const proposalItems = proposalItemsResult.data || [];
      const salesConfig = salesConfigResult.data;

      // Map user_id to org_role for filtering productivity
      const userRoleMap = new Map<string, string>(
        orgMembers.map(m => [m.user_id, m.org_role])
      );

      // Get sales pipeline IDs
      const salesPipelineIds = pipelines.filter(p => p.pipeline_type === 'sales').map(p => p.id);

      // =================== FILTER BY PIPELINE_TYPE = 'SALES' ===================
      // Only consider opportunities from SALES pipelines for revenue metrics
      const salesOpportunities = opportunities.filter(o => 
        o.pipelines?.pipeline_type === 'sales'
      );

      // Won/lost opportunities in SALES pipelines only
      // Use closed_at as primary date tracking source (fallback to updated_at)
      const wonSalesOpportunities = salesOpportunities.filter(o => o.status === 'won');
      const lostSalesOpportunities = salesOpportunities.filter(o => o.status === 'lost');
      const isClosedInCurrentMonth = (opportunity: any) => {
        const closeDate = opportunity.closed_at || opportunity.updated_at;
        return closeDate && new Date(closeDate) >= startOfCurrentMonth;
      };
      const wonSalesThisYear = wonSalesOpportunities.filter(o => {
        const closeDate = (o as any).closed_at || o.updated_at;
        return closeDate && new Date(closeDate) >= startOfYearDate;
      });
      const wonSalesThisMonth = wonSalesOpportunities.filter(isClosedInCurrentMonth);
      const lostSalesThisMonth = lostSalesOpportunities.filter(isClosedInCurrentMonth);

      // =================== REAL MRR CALCULATION (CENTRALIZED) ===================
      // Usa a função centralizada de MRR que:
      // 1. Considera apenas pipelines de vendas
      // 2. Deduplica por account_id
      // 3. Usa proposal_payment_terms como fonte de verdade
      const { calculateRealMRR } = await import('@/services/crm/mrr-calculations');
      const mrrResult = await calculateRealMRR({ 
        organizationId, 
        onlySalesPipelines: true 
      });
      const realMRR = mrrResult.totalMRR;

      // =================== CLOSED REVENUE — SINGLE SOURCE OF TRUTH ===================
      // Fonte ÚNICA: commercial_won_revenue_view.
      // Dashboard, Forecast, BI, Relatórios → Vendas Realizadas, Comissão e Win/Loss Ganhos
      // DEVEM reconciliar contra esta view no mesmo período.
      // FILTRO OBRIGATÓRIO: somente pipelines de VENDAS contam para os cards
      // (exclui renewal/onboarding/qualification). Mês atual vigente apenas.
      const [ssotMonthRes, ssotYearRes] = await Promise.all([
        (supabase as any)
          .from('commercial_won_revenue_view')
          .select('opportunity_id, commercial_amount, one_shot_amount, mrr_amount, valid_revenue_amount, cancelled_amount, is_cancelled_sale, won_at, pipeline_type')
          .eq('organization_id', organizationId)
          .eq('pipeline_type', 'sales')
          .gte('won_at', startOfCurrentMonth.toISOString())
          .lte('won_at', endOfMonth(now).toISOString()),
        (supabase as any)
          .from('commercial_won_revenue_view')
          .select('valid_revenue_amount, commercial_amount, is_cancelled_sale')
          .eq('organization_id', organizationId)
          .eq('pipeline_type', 'sales')
          .gte('won_at', startOfYearDate.toISOString())
          .lte('won_at', endOfMonth(now).toISOString()),
      ]);
      const ssotRows = ssotMonthRes.data ?? [];
      if (ssotMonthRes.error) {
        console.error('[useOwnerDashboard] commercial_won_revenue_view (month) failed:', ssotMonthRes.error);
      }
      if (ssotYearRes.error) {
        console.error('[useOwnerDashboard] commercial_won_revenue_view (ytd) failed:', ssotYearRes.error);
      }
      // Totais líquidos de cancelamento — alinhados a Relatórios → Vendas Realizadas.
      const ssotTotals = (ssotRows ?? []).reduce(
        (acc: any, r: any) => {
          const isCancelled = r.is_cancelled_sale === true;
          const commercial = Number(r.commercial_amount) || 0;
          const validAmt = Number(r.valid_revenue_amount ?? (isCancelled ? 0 : commercial)) || 0;
          acc.valid += validAmt;
          if (!isCancelled) {
            acc.valid_one_shot += Number(r.one_shot_amount) || 0;
            acc.valid_mrr += Number(r.mrr_amount) || 0;
            acc.valid_count += 1;
          }
          return acc;
        },
        { valid: 0, valid_one_shot: 0, valid_mrr: 0, valid_count: 0 },
      );
      // Contagem alinhada à SSoT líquida (bate com "Vendas Válidas" de Vendas Realizadas).
      const ssotWonCountThisMonth = ssotTotals.valid_count;
      // Run Rate YTD usa receita válida (líquida de cancelamentos).
      const ssotYearlyRevenue = ((ssotYearRes.data ?? []) as any[]).reduce(
        (sum, r) => {
          const isCancelled = r.is_cancelled_sale === true;
          const commercial = Number(r.commercial_amount) || 0;
          return sum + (Number(r.valid_revenue_amount ?? (isCancelled ? 0 : commercial)) || 0);
        },
        0,
      );

      const closedRevenueThisMonth = ssotTotals.valid;
      const closedMRRThisMonth = ssotTotals.valid_mrr;
      const closedOneTimeThisMonth = ssotTotals.valid_one_shot;

      // Mantém estrutura `recurringMRRByOpportunity` para outras seções legadas que dependem dela.
      const opportunityIdsWithRecurring = new Set<string>();
      const recurringMRRByOpportunity = new Map<string, number>();
      const oppIdToAccountId = new Map<string, string>();
      opportunities.forEach((o: any) => {
        if (o?.id && o?.account_id) oppIdToAccountId.set(o.id, o.account_id);
      });
      const { data: proposalsWithTerms } = await supabase
        .from('proposals')
        .select('opportunity_id, proposal_payment_terms!inner(payment_type, monthly_value)')
        .eq('organization_id', organizationId)
        .eq('status', 'accepted');
      (proposalsWithTerms || []).forEach((p: any) => {
        if (!p.opportunity_id) return;
        const terms = p.proposal_payment_terms || [];
        terms.forEach((t: any) => {
          if (t.payment_type === 'recurring' || t.payment_type === 'monthly') {
            opportunityIdsWithRecurring.add(p.opportunity_id);
            const current = recurringMRRByOpportunity.get(p.opportunity_id) || 0;
            recurringMRRByOpportunity.set(p.opportunity_id, current + (t.monthly_value || 0));
          }
        });
      });

      
      // ARR is based on actual MRR, not assumed
      const arr = realMRR * 12;
      
      // Yearly revenue from SSoT (commercial_won_revenue_view YTD).
      // Antes usava soma de `valor_previsto` (campo legado, frequentemente zerado em
      // negócios herdados de proposta aprovada) — resultado caía artificialmente.
      const yearlyRevenue = ssotYearlyRevenue;
      const monthsElapsed = now.getMonth() + 1;
      const runRate = monthsElapsed > 0 ? (yearlyRevenue / monthsElapsed) * 12 : 0;

      // Yearly goal: priority is sales_config.yearly_goal > sales_config.monthly_revenue_target * 12 > sum of profiles.monthly_goal * 12 > fallback
      const yearlyGoal = 
        (salesConfig?.yearly_goal && salesConfig.yearly_goal > 0 ? salesConfig.yearly_goal : null) ||
        (salesConfig?.monthly_revenue_target && salesConfig.monthly_revenue_target > 0 ? salesConfig.monthly_revenue_target * 12 : null) ||
        profiles.reduce((sum, p) => sum + ((p.monthly_goal || 0) * 12), 0) || 
        1000000;

      // =================== TICKET MÉDIO ===================
      // Average ticket do MÊS ATUAL — count da SSoT (mesmo número de Vendas Realizadas).
      const avgTicketThisMonth = ssotWonCountThisMonth > 0
        ? closedRevenueThisMonth / ssotWonCountThisMonth
        : 0;
      
      // Average ticket HISTÓRICO (para referência, se necessário)
      const avgTicketHistorical = wonSalesOpportunities.length > 0 
        ? wonSalesOpportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) / wonSalesOpportunities.length 
        : 0;

      // Ticket by product
      const ticketByProduct = wonSalesOpportunities.reduce((acc, o) => {
        const product = o.produto || 'Outros';
        if (!acc[product]) acc[product] = { sum: 0, count: 0 };
        acc[product].sum += o.valor_previsto || 0;
        acc[product].count++;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      // =================== SALES TREND (SALES PIPELINES ONLY) ===================
      // Usar closed_at como data primária (imutável após fechamento)
      const salesTrend = Array.from({ length: 12 }, (_, i) => {
        const month = subMonths(now, 11 - i);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthWon = wonSalesOpportunities.filter(o => {
          // Priorizar closed_at como fonte de verdade
          const closedAt = (o as any).closed_at;
          if (!closedAt) return false;
          const date = new Date(closedAt);
          return date >= monthStart && date <= monthEnd;
        });
        return {
          month: format(month, 'MMM/yy'),
          value: monthWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
          count: monthWon.length
        };
      });

      // =================== FORECAST WITH REAL CONFIDENCE ===================
      const last3MonthsRevenue = salesTrend.slice(-3).reduce((sum, m) => sum + m.value, 0) / 3;
      const dataQuality = salesTrend.filter(m => m.count > 0).length; // Months with data
      
      // Open deals in sales pipelines — alinhado com a tela Pipeline (qualquer status != won/lost).
      // Ver `src/services/supabase/opportunities.ts` (`not status in (won,lost)`).
      const CLOSED_STATUSES = new Set(['won', 'lost']);
      const openSalesOpportunities = salesOpportunities.filter(o => !CLOSED_STATUSES.has((o as any).status));
      const weightedPipeline = openSalesOpportunities.reduce((sum, o) => {
        const prob = o.prob || 30;
        return sum + ((o.valor_previsto || 0) * prob / 100);
      }, 0);

      const remainingMonths = 12 - monthsElapsed;
      
      // Realistic forecast based on trend + weighted pipeline
      const realisticFromTrend = yearlyRevenue + (last3MonthsRevenue * remainingMonths);
      const realistic = realisticFromTrend + weightedPipeline;
      
      // Growth rate calculation
      const growthRate = salesTrend.length > 1 && salesTrend[salesTrend.length - 2].value > 0
        ? (salesTrend[salesTrend.length - 1].value / salesTrend[salesTrend.length - 2].value) - 1
        : 0;
      
      const optimistic = realistic * (1 + Math.max(growthRate, 0.15));
      const pessimistic = realistic * 0.7;

      // Real confidence — fonte ÚNICA com a página Forecast (NRHS médio das open).
      const pipelineValue = openSalesOpportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const forecastConfidenceResult = calculateForecastConfidenceFromNRHS({
        openSalesOpportunities: openSalesOpportunities as Array<{ nrhs_score?: number | null }>,
      });

      // =================== SELLER PRODUCTIVITY (SALES ROLE ONLY) ===================
      const salesUserIds = orgMembers
        .filter(m => m.org_role === 'sales' || m.org_role === 'manager')
        .map(m => m.user_id);

      const sellerStats = profiles
        .filter(p => salesUserIds.includes(p.user_id))
        .map(p => {
          // Use SALES pipeline opportunities only
          const sellerOpps = salesOpportunities.filter(o => o.owner_user_id === p.user_id);
          const sellerWon = sellerOpps.filter(o => o.status === 'won');
          const sellerLost = sellerOpps.filter(o => o.status === 'lost');
          const totalClosed = sellerWon.length + sellerLost.length;
          return {
            name: p.full_name || 'Sem nome',
            winRate: totalClosed > 0 ? (sellerWon.length / totalClosed) * 100 : 0,
            revenue: sellerWon.reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
            deals: sellerWon.length
          };
        })
        .filter(s => s.deals > 0 || s.winRate > 0) // Only show sellers with activity
        .sort((a, b) => b.revenue - a.revenue);

      // Top performer DO MÊS (usado no insight "lidera com X negócios fechados")
      const sellerStatsThisMonth = profiles
        .filter(p => salesUserIds.includes(p.user_id))
        .map(p => {
          const won = wonSalesThisMonth.filter(o => o.owner_user_id === p.user_id);
          return {
            name: p.full_name || 'Sem nome',
            winRate: 0,
            revenue: won.reduce((s, o) => s + (o.valor_previsto || 0), 0),
            deals: won.length,
          };
        })
        .filter(s => s.deals > 0)
        .sort((a, b) => b.revenue - a.revenue);

      // =================== CRM HEATMAP (SALES STAGES ONLY) ===================
      const salesStageIds = stages.filter(s => 
        salesPipelineIds.includes(s.pipeline_id)
      ).map(s => s.id);

      const stageStats = stages
        .filter(stage => salesStageIds.includes(stage.id))
        .map(stage => {
          const stageOpps = salesOpportunities.filter(o => o.stage_id === stage.id);
          const avgDays = stageOpps.length > 0 
            ? stageOpps.reduce((sum, o) => {
                const created = new Date(o.created_at || now);
                const updated = new Date(o.updated_at || now);
                return sum + Math.floor((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
              }, 0) / stageOpps.length
            : 0;
          const lostFromStage = salesOpportunities.filter(o => o.status === 'lost' && o.stage_id === stage.id).length;
          const dropRate = stageOpps.length > 0 ? (lostFromStage / stageOpps.length) * 100 : 0;
          return {
            stage: stage.name,
            avgDays: Math.round(avgDays),
            dropRate: Math.round(dropRate),
            value: stageOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0)
          };
        });

      // =================== ENTERPRISE DEALS (DYNAMIC THRESHOLD) ===================
      // Use dynamic threshold: top 10% by value or minimum R$5.000
      const openValues = openSalesOpportunities.map(o => o.valor_previsto || 0).sort((a, b) => b - a);
      const top10PercentThreshold = openValues[Math.floor(openValues.length * 0.1)] || 5000;
      const enterpriseThreshold = Math.max(top10PercentThreshold, 5000);

      const enterpriseDeals = openSalesOpportunities
        .filter(o => (o.valor_previsto || 0) >= enterpriseThreshold)
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

      // =================== CHURN RISK (REAL LOGIC) ===================
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
            value: wonSalesOpportunities.filter(o => o.account_id === a.id).reduce((sum, o) => sum + (o.valor_previsto || 0), 0),
            daysInactive
          };
        })
        .filter(a => a.daysInactive > 30)
        .sort((a, b) => b.daysInactive - a.daysInactive)
        .slice(0, 5);

      // =================== STRATEGIC OPPORTUNITIES (CLOSING THIS MONTH) ===================
      const endOfCurrentMonth = endOfMonth(now);
      const strategicOpportunities = openSalesOpportunities
        .filter(o => {
          // Has close date this month OR high probability
          const closeDate = o.close_date_prevista ? parseDateOnly(o.close_date_prevista) : null;
          const closingThisMonth = closeDate && closeDate <= endOfCurrentMonth;
          const highProbability = (o.prob || 0) >= 50;
          return closingThisMonth || highProbability;
        })
        .sort((a, b) => (b.valor_previsto || 0) - (a.valor_previsto || 0))
        .slice(0, 5)
        .map(o => {
          const stage = stages.find(s => s.id === o.stage_id);
          return {
            id: o.id,
            title: o.title,
            value: o.valor_previsto || 0,
            stage: stage?.name || 'Sem estágio',
            closeDate: o.close_date_prevista
          };
        });

      // =================== SYSTEM ERRORS (CRITICAL ONLY) ===================
      const criticalErrors = workflowExecutions.filter(e => {
        // Only show errors that impact high-value deals
        return e.trigger_type && (e.trigger_type.includes('won') || e.trigger_type.includes('stage'));
      });

      const errorsByType = criticalErrors.reduce((acc, e) => {
        const type = e.trigger_type || 'workflow';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const systemErrors = Object.entries(errorsByType)
        .filter(([_, count]) => count >= 2) // Only show if 2+ occurrences
        .map(([type, count]) => ({
          type,
          count,
          impact: count > 10 ? 'Alto' : count > 5 ? 'Médio' : 'Baixo'
        }));

      // =================== EXPIRING PROPOSALS ===================
      // Only proposals linked to ACTIVE opportunities in SALES pipelines
      const rawExpiringProposals = (expiringProposalsResult.data || []).filter(p => {
        if (!p.opportunity_id) return false;
        const opp = salesOpportunities.find(o => o.id === p.opportunity_id);
        return opp && (opp.status === 'open' || opp.status === 'new');
      });
      const todayStr = format(now, 'yyyy-MM-dd');
      const in10Days = new Date(now);
      in10Days.setDate(in10Days.getDate() + 10);

      const expiringProposals = rawExpiringProposals
        .map(p => {
          const expiresDate = p.expires_at!.substring(0, 10);
          let urgency: 'expired' | 'today' | 'expiring';
          if (expiresDate < todayStr) urgency = 'expired';
          else if (expiresDate === todayStr) urgency = 'today';
          else urgency = 'expiring';
          return {
            id: p.id,
            title: p.title || 'Proposta sem título',
            clientName: p.client_name || 'Cliente',
            expiresAt: p.expires_at!,
            status: p.status || 'sent',
            opportunityId: p.opportunity_id,
            totalAmount: p.total_amount || 0,
            urgency,
          };
        })
        .filter(p => {
          if (p.urgency === 'expired' || p.urgency === 'today') return true;
          const d = new Date(p.expiresAt);
          return d <= in10Days;
        })
        .sort((a, b) => {
          const order = { expired: 0, today: 1, expiring: 2 };
          return order[a.urgency] - order[b.urgency];
        });

      // =================== NPS ===================
      const npsAccounts = accounts.filter(a => a.pontuacao_nps !== null);
      const nps = npsAccounts.length > 0 
        ? Math.round(npsAccounts.reduce((sum, a) => sum + (a.pontuacao_nps || 0), 0) / npsAccounts.length)
        : 0;

      // Repurchase rate — clientes (lifecycle_stage = 'Cliente') que fecharam mais
      // de uma vez, considerando ganhos em pipelines de vendas E renewal.
      const renewalPipelineIds = new Set(
        pipelines.filter(p => p.pipeline_type === 'sales' || p.pipeline_type === 'renewal').map(p => p.id),
      );
      const wonForRepurchase = opportunities.filter(
        (o: any) => o.status === 'won' && renewalPipelineIds.has(o.pipeline_id),
      );
      const wonByAccount = wonForRepurchase.reduce((acc: Map<string, number>, o: any) => {
        if (!o.account_id) return acc;
        acc.set(o.account_id, (acc.get(o.account_id) || 0) + 1);
        return acc;
      }, new Map<string, number>());
      const customerAccounts = accounts.filter(a => a.lifecycle_stage === 'Cliente');
      const repeatCustomers = customerAccounts.filter(a => (wonByAccount.get(a.id) || 0) > 1).length;
      const repurchaseRate = customerAccounts.length > 0
        ? (repeatCustomers / customerAccounts.length) * 100
        : 0;

      // Conversion rate (mês atual) — numerador alinhado à SSoT (Vendas Realizadas).
      const totalWon = ssotWonCountThisMonth;
      const totalLost = lostSalesThisMonth.length;
      const totalClosed = totalWon + totalLost;
      const conversionRate = totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0;

      // =================== HUMANOID INSIGHTS (BASED ON REAL DATA) ===================
      const humanoidInsights = generateHumanoidInsights({
        salesTrend,
        sellerStats,
        sellerStatsThisMonth,
        yearlyGoal,
        runRate,
        salesOpportunities,
        profiles,
        realMRR,
        avgTicket: avgTicketThisMonth,
        closedRevenueThisMonth,
        openSalesOpportunities,
        conversionRate
      });

      return {
        revenue: {
          mrr: realMRR,
          arr,
          projectedArr: realistic,
          yearlyGoal,
          runRate,
          runRatePercentage: yearlyGoal > 0 ? (runRate / yearlyGoal) * 100 : 0,
          closedRevenue: closedRevenueThisMonth,
          closedRevenueOneTime: closedOneTimeThisMonth,
          closedRevenueMRR: closedMRRThisMonth
        },
        metrics: {
          avgTicket: avgTicketThisMonth, // Ticket médio do MÊS (não histórico)
          avgTicketByProduct: Object.entries(ticketByProduct)
            .filter(([product]) => product !== 'Outros') // Filter out "Outros" with no context
            .map(([product, data]) => ({
              product,
              value: data.count > 0 ? data.sum / data.count : 0
            })),
          repurchaseRate,
          nps,
          wonDealsCount: totalWon,
          lostDealsCount: totalLost,
          openDealsCount: openSalesOpportunities.length,
          conversionRate
        },
        salesTrend,
        forecast: {
          pessimistic,
          realistic,
          optimistic,
          confidence: forecastConfidenceResult,
          period: 'annual' as const,
          periodLabel: `Jan-Dez ${now.getFullYear()}`
        },
        sellerProductivity: sellerStats,
        teamROI: {
          totalRevenue: yearlyRevenue,
          teamCost: salesUserIds.length * 8000 * monthsElapsed,
          roi: salesUserIds.length > 0 ? (yearlyRevenue / (salesUserIds.length * 8000 * monthsElapsed)) * 100 : 0
        },
        crmHeatmap: stageStats,
        enterpriseDeals,
        churnRisk,
        strategicOpportunities,
        systemErrors,
        humanoidInsights,
        // KeyDeals for summary component
        keyDeals: {
          enterprise: enterpriseDeals.map(d => ({
            company: d.account,
            value: d.value,
            stage: 'Enterprise',
            owner: ''
          })),
          closingThisMonth: strategicOpportunities.map(o => ({
            company: o.title,
            value: o.value,
            probability: 50,
            daysLeft: o.closeDate ? Math.max(0, Math.ceil((new Date(o.closeDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 30
          })),
          churnRisk: churnRisk.map(c => ({
            account: c.name,
            lastContact: c.reason,
            risk: Math.min(100, Math.floor(c.daysInactive / 90 * 100))
          }))
        },
        // Revenue comparison for chart
        revenueComparison: salesTrend.slice(-6).map((m, i) => ({
          month: m.month,
          revenue: m.value,
          target: yearlyGoal / 12
        })),
        expiringProposals,
      };
    },
    enabled: !!organizationId,
    refetchInterval: 300000
  });
}

function generateHumanoidInsights(data: {
  salesTrend: { month: string; value: number; count: number }[];
  sellerStats: { name: string; winRate: number; revenue: number; deals: number }[];
  sellerStatsThisMonth: { name: string; winRate: number; revenue: number; deals: number }[];
  yearlyGoal: number;
  runRate: number;
  salesOpportunities: any[];
  profiles: any[];
  realMRR: number;
  avgTicket: number;
  closedRevenueThisMonth: number;
  openSalesOpportunities: any[];
  conversionRate: number;
}): { insight: string; impact: string; confidence: number }[] {
  const insights: { insight: string; impact: string; confidence: number }[] = [];
  
  // MRR insight
  if (data.realMRR === 0) {
    insights.push({
      insight: `Todas as vendas são avulsas (MRR = R$0). Considere criar ofertas recorrentes para receita previsível.`,
      impact: 'Alto',
      confidence: 95
    });
  } else {
    insights.push({
      insight: `MRR atual de R$${data.realMRR.toLocaleString('pt-BR')} gera ARR projetado de R$${(data.realMRR * 12).toLocaleString('pt-BR')}.`,
      impact: 'Alto',
      confidence: 90
    });
  }

  // Revenue this month
  if (data.closedRevenueThisMonth > 0) {
    insights.push({
      insight: `Receita fechada este mês: R$${data.closedRevenueThisMonth.toLocaleString('pt-BR')} (${data.salesTrend[data.salesTrend.length - 1]?.count || 0} negócios).`,
      impact: 'Alto',
      confidence: 100
    });
  }

  // Pipeline insight
  if (data.openSalesOpportunities.length > 0) {
    const totalPipelineValue = data.openSalesOpportunities.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    insights.push({
      insight: `Pipeline ativo: ${data.openSalesOpportunities.length} oportunidades totalizando R$${totalPipelineValue.toLocaleString('pt-BR')}.`,
      impact: 'Médio',
      confidence: 95
    });
  }

  // Conversion rate insight
  if (data.conversionRate > 0) {
    const conversionStatus = data.conversionRate >= 30 ? 'saudável' : data.conversionRate >= 20 ? 'adequada' : 'baixa';
    insights.push({
      insight: `Taxa de conversão ${conversionStatus}: ${data.conversionRate.toFixed(0)}% dos deals são convertidos.`,
      impact: data.conversionRate < 20 ? 'Alto' : 'Médio',
      confidence: 88
    });
  }

  // Top performer insight
  const topSeller = data.sellerStatsThisMonth[0];
  if (topSeller && topSeller.deals >= 1) {
    insights.push({
      insight: `${topSeller.name} lidera o mês com ${topSeller.deals} negócio${topSeller.deals > 1 ? 's' : ''} fechado${topSeller.deals > 1 ? 's' : ''} (R$${topSeller.revenue.toLocaleString('pt-BR')}).`,
      impact: 'Médio',
      confidence: 95
    });
  }

  return insights.slice(0, 5);
}
