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

export type SDRGoalSource =
  | 'ote_level_monthly_goal'
  | 'ote_custom_override'
  | 'sales_goals'
  | 'seller_targets_legacy'
  | null;

export interface SDRDashboardData {
  pace: PaceResult | null;
  hasGoal: boolean;
  goalSource: SDRGoalSource;
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

      const [
        oteConfigRes,
        salesGoalsRes,
        sellerTargetsRes,
        qualifiedMonthRes,
        qualifiedTodayRes,
        callsTodayRes,
        meetingsTodayRes,
        overdueRes,
        dueTodayRes,
        opportunitiesRes,
        stagesRes,
      ] = await Promise.all([
        // Fonte oficial da Meta Mensal — MESMA exibida em Configurações de Vendas > Vendedores.
        // Coluna "Meta Mensal" = custom_goal_override ?? ote_levels.monthly_goal (quando goal_type='leads').
        supabase
          .from('ote_seller_config')
          .select(`
            daily_leads_target,
            daily_calls_target,
            daily_sales_target,
            daily_revenue_target,
            custom_goal_override,
            effective_date,
            end_date,
            ote_level:ote_levels ( monthly_goal, goal_type, level_name )
          `)
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .lte('effective_date', todayDateStr)
          .or(`end_date.is.null,end_date.gte.${todayDateStr}`)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Override do gestor via sales_goals (maior precedência se preenchido para o período corrente).
        supabase
          .from('sales_goals')
          .select('target_deals, target_value, period_start, period_end, pipeline_id')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .lte('period_start', monthStartDate)
          .gte('period_end', monthStartDate)
          .maybeSingle(),
        // Fallback legado
        supabase
          .from('seller_targets')
          .select('daily_calls_target, daily_leads_target, daily_proposals_target, monthly_revenue_target')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .order('period_month', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Qualificados no mês (oficial — histórico imutável)
        supabase
          .from('opportunity_qualification_history')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('qualified_by_user_id', userId!)
          .gte('qualification_at', monthStart)
          .lte('qualification_at', monthEnd),
        supabase
          .from('opportunity_qualification_history')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('qualified_by_user_id', userId!)
          .gte('qualification_at', todayStart)
          .lte('qualification_at', todayEnd),
        supabase
          .from('activities')
          .select('id, status', { count: 'exact' })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('type', 'call')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        supabase
          .from('activities')
          .select('id, status', { count: 'exact' })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('type', 'meeting')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .lt('scheduled_date', todayStart),
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .gte('scheduled_date', todayStart)
          .lte('scheduled_date', todayEnd),
        // Plano de Ataque — ownership oficial = owner_user_id; só abertos do usuário logado.
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
        supabase
          .from('stages')
          .select('id, name')
          .eq('organization_id', orgId!),
      ]);

      // ============= RESOLUÇÃO DA META MENSAL =============
      // Prioridade:
      // 1) sales_goals.target_deals (override explícito do gestor para o período)
      // 2) ote_seller_config.custom_goal_override (override pontual no perfil do vendedor)
      // 3) ote_levels.monthly_goal (quando goal_type='leads' — mesma fonte da coluna "Meta Mensal")
      // 4) seller_targets legado (último recurso)
      // NÃO derivar meta mensal de daily_leads_target × dias úteis. daily_leads_target só
      // alimenta a "Meta do dia" do scoreboard.
      let monthlyTarget = 0;
      let dailyLeadsTarget = 0;
      let dailyCallsTarget = 0;
      let goalSource: SDRGoalSource = null;

      const oteCfg = oteConfigRes.data as any;
      const oteLevelGoalType: string | undefined = oteCfg?.ote_level?.goal_type;
      const oteLevelMonthlyGoal: number | undefined = oteCfg?.ote_level?.monthly_goal;
      const oteCustomOverride: number | undefined = oteCfg?.custom_goal_override;

      if (salesGoalsRes.data?.target_deals && salesGoalsRes.data.target_deals > 0) {
        monthlyTarget = salesGoalsRes.data.target_deals;
        goalSource = 'sales_goals';
      } else if (oteCustomOverride && oteCustomOverride > 0) {
        monthlyTarget = Number(oteCustomOverride);
        goalSource = 'ote_custom_override';
      } else if (oteLevelGoalType === 'leads' && oteLevelMonthlyGoal && oteLevelMonthlyGoal > 0) {
        monthlyTarget = Number(oteLevelMonthlyGoal);
        goalSource = 'ote_level_monthly_goal';
      } else if (sellerTargetsRes.data?.daily_leads_target && sellerTargetsRes.data.daily_leads_target > 0) {
        // Fallback legado: derivar pelo dia (só quando NENHUMA meta mensal oficial existir).
        const wd = countBusinessDays(
          new Date(today.getFullYear(), today.getMonth(), 1),
          new Date(today.getFullYear(), today.getMonth() + 1, 0),
        );
        monthlyTarget = sellerTargetsRes.data.daily_leads_target * wd;
        goalSource = 'seller_targets_legacy';
      }

      // Meta diária (scoreboard) — independente da meta mensal.
      dailyLeadsTarget =
        oteCfg?.daily_leads_target ??
        sellerTargetsRes.data?.daily_leads_target ??
        0;
      dailyCallsTarget =
        oteCfg?.daily_calls_target ??
        sellerTargetsRes.data?.daily_calls_target ??
        0;

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
        effectiveContacts: { target: 0, done: callsDone },
        qualifiedLeadsToday: { target: dailyLeadsTarget, done: qualifiedToday },
        meetings: { target: 0, done: meetingsDone },
        overdueActivities: overdueRes.count ?? 0,
        dueTodayActivities: dueTodayRes.count ?? 0,
      };

      // ============= PLANO DE ATAQUE =============
      const stagesMap = new Map<string, string>(
        ((stagesRes.data ?? []) as Array<{ id: string; name: string }>).map(s => [s.id, s.name]),
      );

      const opps = (opportunitiesRes.data ?? []) as Array<{
        id: string; title: string; stage_id: string | null; updated_at: string; created_at: string;
      }>;

      // Próxima atividade aberta por oportunidade (para detectar "sem próximo passo" e "atividade vencida").
      let nextActivityByOpp = new Map<string, { scheduled_date: string | null }>();
      if (opps.length > 0) {
        const oppIds = opps.map(o => o.id);
        const { data: nextActs } = await supabase
          .from('activities')
          .select('opportunity_id, scheduled_date, status')
          .in('opportunity_id', oppIds)
          .eq('owner_user_id', userId!)
          .eq('status', 'scheduled')
          .is('deleted_at', null)
          .order('scheduled_date', { ascending: true });
        for (const a of (nextActs ?? []) as Array<{ opportunity_id: string; scheduled_date: string | null }>) {
          if (!nextActivityByOpp.has(a.opportunity_id)) {
            nextActivityByOpp.set(a.opportunity_id, { scheduled_date: a.scheduled_date });
          }
        }
      }

      const now = Date.now();
      const attackPlan: AttackPlanItem[] = opps
        .map(o => {
          const updatedAt = new Date(o.updated_at).getTime();
          const days = Math.floor((now - updatedAt) / 86_400_000);
          const reasons: string[] = [];
          let score = 0;

          if (days >= 30) { reasons.push(`${days} dias sem atualização`); score += 60; }
          else if (days >= 14) { reasons.push(`${days} dias sem atualização`); score += 35; }
          else if (days >= 7) { reasons.push(`${days} dias sem atualização`); score += 15; }

          const nextAct = nextActivityByOpp.get(o.id);
          if (!nextAct) {
            reasons.push('sem próximo passo');
            score += 30;
          } else if (nextAct.scheduled_date && new Date(nextAct.scheduled_date).getTime() < now) {
            reasons.push('atividade vencida');
            score += 40;
          }

          const stageName = o.stage_id ? stagesMap.get(o.stage_id) : undefined;

          let recommendedAction = 'Avançar próxima etapa';
          if (reasons.includes('atividade vencida')) recommendedAction = 'Concluir atividade vencida';
          else if (reasons.includes('sem próximo passo')) recommendedAction = 'Agendar próximo contato';
          else if (days >= 14) recommendedAction = 'Retomar contato hoje';

          return {
            id: o.id,
            opportunityId: o.id,
            name: o.title || 'Sem título',
            stage: stageName,
            daysWithoutUpdate: days,
            priorityScore: score,
            priorityReasons: reasons.length > 0 ? reasons : ['lead em acompanhamento'],
            recommendedAction,
            ctaHref: `/app/opportunities/${o.id}`,
          };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 6);

      return { pace, hasGoal, goalSource, dailyLeadsTarget, dailyCallsTarget, scoreboard, attackPlan };
    },
  });
}
