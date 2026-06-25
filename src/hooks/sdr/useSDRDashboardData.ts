import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { calculatePace, countBusinessDays, type PaceResult } from '@/lib/sdr/pace';

export interface SDRScoreboard {
  calls: { target: number; done: number };
  effectiveContacts: { target: number; done: number };
  qualifiedLeadsToday: { target: number; done: number };
  meetings: { target: number; done: number };
  overdueActivities: number;
  dueTodayActivities: number;
}

export interface AttackPlanItem {
  id: string;
  opportunityId: string;
  name: string;
  stage?: string;
  daysWithoutUpdate: number;
  priorityScore: number;
  priorityReasons: string[];
  recommendedAction: string;
  ctaHref: string;
}

export interface SDRDashboardData {
  pace: PaceResult | null;
  hasGoal: boolean;
  goalSource: 'ote_seller_config' | 'sales_goals' | 'seller_targets' | null;
  dailyLeadsTarget: number;
  dailyCallsTarget: number;
  scoreboard: SDRScoreboard;
  attackPlan: AttackPlanItem[];
}

function startOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function endOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
}
function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function useSDRDashboardData() {
  const { user, organization } = useCurrentUser();
  const userId = user?.id;
  const orgId = organization?.id;

  return useQuery<SDRDashboardData>({
    queryKey: ['sdr-dashboard-data', userId, orgId],
    enabled: !!userId && !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
      const today = new Date();
      const todayDateStr = today.toISOString().slice(0, 10);
      const monthStart = startOfMonthISO();
      const monthEnd = endOfMonthISO();
      const todayStart = startOfTodayISO();
      const todayEnd = endOfTodayISO();
      const monthStartDate = monthStart.slice(0, 10);
      const monthEndDate = monthEnd.slice(0, 10);

      const [
        oteConfigRes,
        salesGoalsRes,
        sellerTargetsRes,
        salesConfigRes,
        qualifiedMonthRes,
        qualifiedTodayRes,
        callsTodayRes,
        meetingsTodayRes,
        overdueRes,
        dueTodayRes,
        opportunitiesRes,
      ] = await Promise.all([
        // Fonte oficial de meta de pré-vendas (mesma exibida em Configurações de Vendas > Vendedores)
        supabase
          .from('ote_seller_config')
          .select('daily_leads_target, daily_calls_target, daily_sales_target, daily_revenue_target, effective_date, end_date')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .lte('effective_date', todayDateStr)
          .or(`end_date.is.null,end_date.gte.${todayDateStr}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Fallback: meta mensal em sales_goals (se gestor optou por sobrescrever)
        supabase
          .from('sales_goals')
          .select('target_deals, target_value, period_start, period_end, pipeline_id')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .lte('period_start', monthStartDate)
          .gte('period_end', monthStartDate)
          .maybeSingle(),
        // Fallback histórico
        supabase
          .from('seller_targets')
          .select('daily_calls_target, daily_leads_target, daily_proposals_target')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .order('period_month', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Dias úteis configurados pela operação
        supabase
          .from('sales_config')
          .select('working_days_per_month')
          .eq('organization_id', orgId!)
          .maybeSingle(),
        // Qualified leads no mês (oficial)
        supabase
          .from('opportunity_qualification_history')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('qualified_by_user_id', userId!)
          .gte('qualification_at', monthStart)
          .lte('qualification_at', monthEnd),
        // Qualified leads hoje
        supabase
          .from('opportunity_qualification_history')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('qualified_by_user_id', userId!)
          .gte('qualification_at', todayStart)
          .lte('qualification_at', todayEnd),
        // Ligações hoje (programadas + concluídas)
        supabase
          .from('activities')
          .select('id, status', { count: 'exact' })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('type', 'call')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        // Reuniões hoje
        supabase
          .from('activities')
          .select('id, status', { count: 'exact' })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('type', 'meeting')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        // Atividades atrasadas
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .lt('scheduled_date', todayStart),
        // Atividades vencendo hoje
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        // Plano de Ataque — APENAS oportunidades em aberto sob responsabilidade do usuário logado.
        // Ownership oficial = opportunities.owner_user_id (mesmo campo do pipeline/atividades).
        // Sem fallback global: se owner_user_id != usuário, não entra na lista.
        supabase
          .from('opportunities')
          .select('id, title, stage_id, updated_at, created_at, status')
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('status', 'open')
          .is('deleted_at', null)
          .is('closed_at', null)
          .order('updated_at', { ascending: true })
          .limit(30),
      ]);

      // Resolução de meta — prioridade: sales_goals (override do gestor) > ote_seller_config > seller_targets legado
      const businessDaysTotal = countBusinessDays(
        new Date(today.getFullYear(), today.getMonth(), 1),
        new Date(today.getFullYear(), today.getMonth() + 1, 0),
      );
      const workingDays = salesConfigRes.data?.working_days_per_month ?? businessDaysTotal;

      let monthlyTarget = 0;
      let dailyLeadsTarget = 0;
      let dailyCallsTarget = 0;
      let goalSource: SDRDashboardData['goalSource'] = null;

      if (salesGoalsRes.data?.target_deals && salesGoalsRes.data.target_deals > 0) {
        monthlyTarget = salesGoalsRes.data.target_deals;
        dailyLeadsTarget = Math.ceil(monthlyTarget / Math.max(workingDays, 1));
        goalSource = 'sales_goals';
      } else if (oteConfigRes.data?.daily_leads_target && oteConfigRes.data.daily_leads_target > 0) {
        dailyLeadsTarget = oteConfigRes.data.daily_leads_target;
        dailyCallsTarget = oteConfigRes.data.daily_calls_target ?? 0;
        monthlyTarget = dailyLeadsTarget * workingDays;
        goalSource = 'ote_seller_config';
      } else if (sellerTargetsRes.data?.daily_leads_target && sellerTargetsRes.data.daily_leads_target > 0) {
        dailyLeadsTarget = sellerTargetsRes.data.daily_leads_target;
        dailyCallsTarget = sellerTargetsRes.data.daily_calls_target ?? 0;
        monthlyTarget = dailyLeadsTarget * workingDays;
        goalSource = 'seller_targets';
      }

      if (!dailyCallsTarget) {
        dailyCallsTarget =
          oteConfigRes.data?.daily_calls_target ??
          sellerTargetsRes.data?.daily_calls_target ??
          0;
      }

      const qualifiedMonth = qualifiedMonthRes.count ?? 0;
      const qualifiedToday = qualifiedTodayRes.count ?? 0;
      const hasGoal = monthlyTarget > 0;
      const pace = hasGoal ? calculatePace({ monthlyTarget, qualifiedMonth }) : null;

      const callsData = (callsTodayRes.data ?? []) as Array<{ status: string }>;
      const meetingsData = (meetingsTodayRes.data ?? []) as Array<{ status: string }>;
      const callsDone = callsData.filter(a => a.status === 'completed').length;
      const meetingsDone = meetingsData.filter(a => a.status === 'completed').length;

      const scoreboard: SDRScoreboard = {
        calls: { target: dailyCallsTarget, done: callsData.length },
        // Proxy de contato efetivo = ligação concluída (sem campo de outcome no schema atual)
        effectiveContacts: { target: 0, done: callsDone },
        qualifiedLeadsToday: { target: dailyLeadsTarget, done: qualifiedToday },
        meetings: { target: 0, done: meetingsDone },
        overdueActivities: overdueRes.count ?? 0,
        dueTodayActivities: dueTodayRes.count ?? 0,
      };

      // Plano de Ataque: ranqueia top 5 entre as oportunidades já filtradas por ownership.
      const now = Date.now();
      const opps = (opportunitiesRes.data ?? []) as Array<{
        id: string; title: string; stage_id: string | null; updated_at: string;
      }>;
      const attackPlan: AttackPlanItem[] = opps
        .map(o => {
          const updatedAt = new Date(o.updated_at).getTime();
          const days = Math.floor((now - updatedAt) / 86_400_000);
          const reasons: string[] = [];
          let score = 0;
          if (days >= 30) { reasons.push(`${days} dias sem atualização`); score += 40; }
          else if (days >= 14) { reasons.push(`${days} dias sem atualização`); score += 25; }
          else if (days >= 7) { reasons.push(`${days} dias sem atualização`); score += 10; }
          if (days <= 3) { reasons.push('atualizado recentemente'); score += 5; }
          return {
            id: o.id,
            opportunityId: o.id,
            name: o.title || 'Sem título',
            stage: o.stage_id ?? undefined,
            daysWithoutUpdate: days,
            priorityScore: score,
            priorityReasons: reasons,
            recommendedAction: days >= 14 ? 'Retomar contato hoje' : 'Avançar próxima etapa',
            ctaHref: `/app/opportunities/${o.id}`,
          };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 5);

      return { pace, hasGoal, goalSource, dailyLeadsTarget, dailyCallsTarget, scoreboard, attackPlan };
    },
  });
}
