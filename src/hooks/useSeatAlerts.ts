import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SeatAlert {
  id: string;
  type: 'upsell' | 'churn_risk' | 'expansion_candidate' | 'contraction_warning' | 'seat_limit';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  organization_id: string;
  organization_name: string;
  metrics: {
    active_seats?: number;
    max_users?: number;
    seats_usage_percent?: number;
    mrr?: number;
    delta_mrr?: number;
    consecutive_contractions?: number;
  };
  action: string;
  created_at: string;
}

export function useSeatAlerts() {
  return useQuery({
    queryKey: ['seat-alerts'],
    queryFn: async (): Promise<SeatAlert[]> => {
      const alerts: SeatAlert[] = [];
      const now = new Date();

      // 1. Upsell Opportunities - orgs near seat limit (>80%)
      const { data: nearLimitOrgs } = await supabase
        .from('organizations')
        .select('id, name, active_seats, max_users, calculated_mrr, current_plan_id')
        .not('max_users', 'is', null)
        .gt('active_seats', 0)
        .not('current_plan_id', 'in', '("internal_full","freemium")');

      (nearLimitOrgs || []).forEach(org => {
        if (!org.max_users || !org.active_seats) return;
        const usagePercent = (org.active_seats / org.max_users) * 100;
        
        if (usagePercent >= 90) {
          alerts.push({
            id: `upsell-${org.id}`,
            type: 'upsell',
            severity: 'success',
            title: 'Oportunidade de Upsell - Limite Atingido',
            description: `${org.name} está usando ${usagePercent.toFixed(0)}% dos seats disponíveis`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              active_seats: org.active_seats,
              max_users: org.max_users,
              seats_usage_percent: usagePercent,
              mrr: Number(org.calculated_mrr) || 0,
            },
            action: 'Propor upgrade de plano',
            created_at: now.toISOString(),
          });
        } else if (usagePercent >= 80) {
          alerts.push({
            id: `seat-limit-${org.id}`,
            type: 'seat_limit',
            severity: 'warning',
            title: 'Próximo do Limite de Seats',
            description: `${org.name} está em ${usagePercent.toFixed(0)}% da capacidade`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              active_seats: org.active_seats,
              max_users: org.max_users,
              seats_usage_percent: usagePercent,
              mrr: Number(org.calculated_mrr) || 0,
            },
            action: 'Monitorar e preparar proposta',
            created_at: now.toISOString(),
          });
        }
      });

      // 2. Churn Risk - consecutive seat removals
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const { data: recentContractions } = await supabase
        .from('seat_events')
        .select('organization_id, delta_mrr, created_at')
        .eq('event_type', 'seat_removed')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Group by org and count consecutive contractions
      const contractionsByOrg: Record<string, { count: number; totalDelta: number }> = {};
      (recentContractions || []).forEach(event => {
        if (!event.organization_id) return;
        if (!contractionsByOrg[event.organization_id]) {
          contractionsByOrg[event.organization_id] = { count: 0, totalDelta: 0 };
        }
        contractionsByOrg[event.organization_id].count++;
        contractionsByOrg[event.organization_id].totalDelta += Math.abs(Number(event.delta_mrr) || 0);
      });

      // Get org names for those with multiple contractions
      const churnRiskOrgIds = Object.entries(contractionsByOrg)
        .filter(([_, data]) => data.count >= 2)
        .map(([id]) => id);

      if (churnRiskOrgIds.length > 0) {
        const { data: churnRiskOrgs } = await supabase
          .from('organizations')
          .select('id, name, calculated_mrr')
          .in('id', churnRiskOrgIds);

        (churnRiskOrgs || []).forEach(org => {
          const data = contractionsByOrg[org.id];
          alerts.push({
            id: `churn-risk-${org.id}`,
            type: 'churn_risk',
            severity: 'critical',
            title: 'Risco de Churn - Remoções Consecutivas',
            description: `${org.name} removeu ${data.count} seats nos últimos 30 dias`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              mrr: Number(org.calculated_mrr) || 0,
              delta_mrr: -data.totalDelta,
              consecutive_contractions: data.count,
            },
            action: 'Contato urgente do CS',
            created_at: now.toISOString(),
          });
        });
      }

      // 3. Expansion Candidates - high activity but low seat usage
      const { data: lowUsageOrgs } = await supabase
        .from('organizations')
        .select('id, name, active_seats, max_users, calculated_mrr')
        .not('max_users', 'is', null)
        .gt('active_seats', 0);

      // Get activity counts for these orgs
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const { data: activities } = await supabase
        .from('activities')
        .select('organization_id')
        .gte('created_at', sevenDaysAgo.toISOString());

      const activityByOrg: Record<string, number> = {};
      (activities || []).forEach(a => {
        if (a.organization_id) {
          activityByOrg[a.organization_id] = (activityByOrg[a.organization_id] || 0) + 1;
        }
      });

      (lowUsageOrgs || []).forEach(org => {
        if (!org.max_users || !org.active_seats) return;
        const usagePercent = (org.active_seats / org.max_users) * 100;
        const activityCount = activityByOrg[org.id] || 0;
        
        // Low seat usage but high activity = expansion candidate
        if (usagePercent < 50 && activityCount > 20) {
          alerts.push({
            id: `expansion-${org.id}`,
            type: 'expansion_candidate',
            severity: 'info',
            title: 'Candidato a Expansão',
            description: `${org.name} tem alta atividade (${activityCount} ações/semana) mas usa apenas ${usagePercent.toFixed(0)}% dos seats`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              active_seats: org.active_seats,
              max_users: org.max_users,
              seats_usage_percent: usagePercent,
              mrr: Number(org.calculated_mrr) || 0,
            },
            action: 'Oferecer mais seats',
            created_at: now.toISOString(),
          });
        }
      });

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
