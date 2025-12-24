import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SeatAlert {
  id: string;
  type: 'expansion' | 'churn_risk' | 'high_growth' | 'contraction_warning' | 'new_revenue';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  organization_id: string;
  organization_name: string;
  metrics: {
    active_seats?: number;
    mrr?: number;
    delta_mrr?: number;
    consecutive_changes?: number;
    growth_rate?: number;
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
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. Recent Expansions (New Revenue) - seats added in last 7 days
      const { data: recentExpansions } = await supabase
        .from('seat_events')
        .select('organization_id, delta_mrr, created_at')
        .eq('event_type', 'seat_added')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Group expansions by org
      const expansionsByOrg: Record<string, { count: number; totalDelta: number }> = {};
      (recentExpansions || []).forEach(event => {
        if (!event.organization_id) return;
        if (!expansionsByOrg[event.organization_id]) {
          expansionsByOrg[event.organization_id] = { count: 0, totalDelta: 0 };
        }
        expansionsByOrg[event.organization_id].count++;
        expansionsByOrg[event.organization_id].totalDelta += Number(event.delta_mrr) || 0;
      });

      // Get org names for expansions
      const expansionOrgIds = Object.keys(expansionsByOrg);
      if (expansionOrgIds.length > 0) {
        const { data: expansionOrgs } = await supabase
          .from('organizations')
          .select('id, name, calculated_mrr, active_seats')
          .in('id', expansionOrgIds);

        (expansionOrgs || []).forEach(org => {
          const data = expansionsByOrg[org.id];
          if (data.count >= 3) {
            alerts.push({
              id: `high-growth-${org.id}`,
              type: 'high_growth',
              severity: 'success',
              title: 'Alto Crescimento',
              description: `${org.name} adicionou ${data.count} seats esta semana (+${formatCurrency(data.totalDelta)}/mês)`,
              organization_id: org.id,
              organization_name: org.name,
              metrics: {
                active_seats: Number(org.active_seats) || 0,
                mrr: Number(org.calculated_mrr) || 0,
                delta_mrr: data.totalDelta,
                consecutive_changes: data.count,
              },
              action: 'Enviar agradecimento e oferecer suporte',
              created_at: now.toISOString(),
            });
          } else if (data.count >= 1) {
            alerts.push({
              id: `new-revenue-${org.id}`,
              type: 'new_revenue',
              severity: 'info',
              title: 'Nova Receita',
              description: `${org.name} adicionou ${data.count} seat(s) (+${formatCurrency(data.totalDelta)}/mês)`,
              organization_id: org.id,
              organization_name: org.name,
              metrics: {
                active_seats: Number(org.active_seats) || 0,
                mrr: Number(org.calculated_mrr) || 0,
                delta_mrr: data.totalDelta,
              },
              action: 'Monitorar expansão contínua',
              created_at: now.toISOString(),
            });
          }
        });
      }

      // 2. Churn Risk - consecutive seat removals in last 30 days
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

      // Get org names for those with contractions
      const churnRiskOrgIds = Object.entries(contractionsByOrg)
        .filter(([_, data]) => data.count >= 2)
        .map(([id]) => id);

      if (churnRiskOrgIds.length > 0) {
        const { data: churnRiskOrgs } = await supabase
          .from('organizations')
          .select('id, name, calculated_mrr, active_seats')
          .in('id', churnRiskOrgIds);

        (churnRiskOrgs || []).forEach(org => {
          const data = contractionsByOrg[org.id];
          const activeSeats = Number(org.active_seats) || 0;
          
          // Critical if org has few seats left or many contractions
          const isCritical = activeSeats <= 2 || data.count >= 4;
          
          alerts.push({
            id: `churn-risk-${org.id}`,
            type: 'churn_risk',
            severity: isCritical ? 'critical' : 'warning',
            title: isCritical ? 'Risco Alto de Churn' : 'Contração Detectada',
            description: `${org.name} removeu ${data.count} seats nos últimos 30 dias (-${formatCurrency(data.totalDelta)}/mês)`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              active_seats: activeSeats,
              mrr: Number(org.calculated_mrr) || 0,
              delta_mrr: -data.totalDelta,
              consecutive_changes: data.count,
            },
            action: isCritical ? 'Contato urgente do CS' : 'Agendar reunião de feedback',
            created_at: now.toISOString(),
          });
        });
      }

      // 3. Contraction Warning - single contractions (less severe)
      const singleContractionOrgIds = Object.entries(contractionsByOrg)
        .filter(([_, data]) => data.count === 1)
        .map(([id]) => id);

      if (singleContractionOrgIds.length > 0) {
        const { data: warningOrgs } = await supabase
          .from('organizations')
          .select('id, name, calculated_mrr, active_seats')
          .in('id', singleContractionOrgIds);

        (warningOrgs || []).forEach(org => {
          const data = contractionsByOrg[org.id];
          alerts.push({
            id: `contraction-warning-${org.id}`,
            type: 'contraction_warning',
            severity: 'info',
            title: 'Contração Recente',
            description: `${org.name} removeu 1 seat (-${formatCurrency(data.totalDelta)}/mês)`,
            organization_id: org.id,
            organization_name: org.name,
            metrics: {
              active_seats: Number(org.active_seats) || 0,
              mrr: Number(org.calculated_mrr) || 0,
              delta_mrr: -data.totalDelta,
            },
            action: 'Monitorar próximos movimentos',
            created_at: now.toISOString(),
          });
        });
      }

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
