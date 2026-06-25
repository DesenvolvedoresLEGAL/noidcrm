import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { calculatePace, type PaceResult } from '@/lib/sdr/pace';

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
      const monthStart = startOfMonthISO();
      const monthEnd = endOfMonthISO();
      const todayStart = startOfTodayISO();
      const todayEnd = endOfTodayISO();
      const monthStartDate = monthStart.slice(0, 10);

      const [
        goalRes,
        seller targetsRes,
        qualifiedMonthRes,
        qualifiedTodayRes,
        callsTodayRes,
        meetingsTodayRes,
        overdueRes,
        dueTodayRes,
        opportunitiesRes,
      ] = await Promise.all([
        // Meta mensal SDR — sales_goals pipeline qualification do mês corrente
        supabase
          .from('sales_goals')
          .select('target_deals, target_value, period_start, period_end, pipeline_id')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .lte('period_start', monthStartDate)
          .gte('period_end', monthStartDate)
          .maybeSingle(),
        // Fallback diário
        supabase
          .from('seller_targets')
          .select('daily_calls_target, daily_leads_target, daily_proposals_target')
          .eq('organization_id', orgId!)
          .eq('user_id', userId!)
          .order('period_month', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Qualified leads no mês
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
        // Ligações hoje
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
        // Plano de ataque — oportunidades abertas do usuário (top 30 p/ ranquear local)
        supabase
          .from('opportunities')
          .select('id, titulo, stage_id, updated_at, created_at, status')
          .eq('organization_id', orgId!)
          .eq('owner_user_id', userId!)
          .is('deleted_at', null)
          .is('closed_at', null)
          .order('updated_at', { ascending: true })
          .limit(30),
      ]);

      const monthlyTarget = goalRes.data?.target_deals ?? 0;
      const qualifiedMonth = qualifiedMonthRes.count ?? 0;
      const qualifiedToday = qualifiedTodayRes.count ?? 0;
      const hasGoal = monthlyTarget > 0;

      const pace = hasGoal ? calculatePace({ monthlyTarget, qualifiedMonth }) : null;

      const callsData = (callsTodayRes.data ?? []) as Array<{ status: string }>;
      const meetingsData = (meetingsTodayRes.data ?? []) as Array<{ status: string }>;
      const callsDone = callsData.filter(a => a.status === 'completed').length;
      const meetingsDone = meetingsData.filter(a => a.status === 'completed').length;

      const dailyLeadsTarget = sellerTargetsRes.data?.daily_leads_target ?? (pace?.requiredDailyPace ?? 0);
      const dailyCallsTarget = sellerTargetsRes.data?.daily_calls_target ?? 0;

      const scoreboard: SDRScoreboard = {
        calls: { target: dailyCallsTarget, done: callsDone },
        effectiveContacts: { target: 0, done: 0 },
        qualifiedLeadsToday: { target: dailyLeadsTarget, done: qualifiedToday },
        meetings: { target: 0, done: meetingsDone },
        overdueActivities: overdueRes.count ?? 0,
        dueTodayActivities: dueTodayRes.count ?? 0,
      };

      // Plano de Ataque: top 5 por priorityScore (dias parado + sem fechamento)
      const now = Date.now();
      const opps = (opportunitiesRes.data ?? []) as Array<{
        id: string; titulo: string; stage_id: string | null; updated_at: string;
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
            name: o.titulo || 'Sem título',
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

      return { pace, hasGoal, scoreboard, attackPlan };
    },
  });
}
