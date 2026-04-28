import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useCloserDashboardData } from '@/hooks/dashboard/useCloserDashboardData';
import { CloserPeriodFilter } from './CloserPeriodFilter';
import { CloserKpiGrid } from './CloserKpiGrid';
import { CentralDoDiaSection } from './CentralDoDiaSection';
import { CloserRiskDealsList } from './CloserRiskDealsList';
import { CloserSectionList } from './CloserSectionList';
import { CloserTopActions } from './CloserTopActions';
import { CloserDashboardSkeleton } from './CloserDashboardSkeleton';
import { CloserDashboardErrorState } from './CloserDashboardErrorState';
import { CloserNotACloserState } from './CloserNotACloserState';
import { CloserDashboardEmptyState } from './CloserDashboardEmptyState';

interface Props {
  tenantId: string;
  targetUserId: string;
}

export function CloserDashboard({ tenantId, targetUserId }: Props) {
  const {
    data, isLoading, error, period, setPeriod, unavailableWidgets, isEmpty,
  } = useCloserDashboardData({ tenantId, userId: targetUserId });

  if (isLoading) return <CloserDashboardSkeleton />;
  if (error) return <CloserDashboardErrorState message={(error as Error).message} />;
  if (!data) return <CloserDashboardEmptyState />;
  if (data.error === 'not_a_closer') return <CloserNotACloserState />;

  const lists = data.lists;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Dashboard Closer</h3>
          <p className="text-sm text-muted-foreground">
            Visão de fechamento, propostas, follow ups e risco comercial.
          </p>
        </div>
        <CloserPeriodFilter value={period} onChange={setPeriod} />
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Este dashboard usa dados reais do CRM, mas ainda está em modo preview. O dashboard
          principal do usuário continua inalterado.
        </AlertDescription>
      </Alert>

      {data.context.requires_review && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este usuário ainda está marcado para revisão. Valide a função antes de ativar o dashboard real.
          </AlertDescription>
        </Alert>
      )}

      {data.goal_warning && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>Aviso administrativo:</strong> {data.goal_warning.message}
          </AlertDescription>
        </Alert>
      )}

      {unavailableWidgets.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Algumas métricas ainda não possuem fonte confiável no schema atual: {unavailableWidgets.join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      <CentralDoDiaSection central={data.central_do_dia} />

      <CloserTopActions actions={lists.top_actions_today ?? []} />

      <div className="grid md:grid-cols-2 gap-4">
        <CloserSectionList
          title="Minha agenda de hoje"
          description="Atividades agendadas para hoje, ordenadas por horário."
          items={lists.today_agenda ?? []}
          emptyText="Nenhuma atividade agendada para hoje."
          showValue={false}
        />
        <CloserSectionList
          title="Follow ups vencidos"
          description="Atividades vencidas que precisam ser executadas."
          items={lists.overdue_followups ?? []}
          emptyText="Sem follow ups vencidos."
          showValue={false}
        />
        <CloserSectionList
          title="Propostas vencendo hoje"
          items={lists.proposals_expiring_today ?? []}
          emptyText="Nenhuma proposta com prazo final hoje."
        />
        <CloserSectionList
          title="Propostas vencendo em 48h"
          items={lists.proposals_expiring_48h ?? []}
          emptyText="Nenhuma proposta vencendo nas próximas 48h."
        />
        <CloserSectionList
          title="Propostas vencidas"
          items={lists.proposals_expired ?? []}
          emptyText="Nenhuma proposta vencida sem aceite."
        />
        <CloserSectionList
          title="Propostas visualizadas sem ação"
          description="Cliente abriu, ninguém deu sequência."
          items={lists.proposals_viewed_no_followup ?? []}
          emptyText="Todas as propostas visualizadas tiveram follow up."
        />
        <CloserSectionList
          title="Sem próxima atividade"
          items={lists.opportunities_without_next_activity ?? []}
          emptyText="Todas as oportunidades têm próxima atividade."
        />
        <CloserSectionList
          title="Oportunidades paradas"
          description="Mais de 7 dias na mesma etapa do funil."
          items={lists.stalled_opportunities ?? []}
          emptyText="Nenhuma oportunidade parada."
        />
      </div>

      <CloserKpiGrid kpis={data.kpis} availability={data.availability} />

      <CloserRiskDealsList deals={lists.risk_deals ?? []} />

      {isEmpty && <CloserDashboardEmptyState />}
    </div>
  );
}
