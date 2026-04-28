import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle } from 'lucide-react';
import { useCloserDashboardData } from '@/hooks/dashboard/useCloserDashboardData';
import { CloserPeriodFilter } from './CloserPeriodFilter';
import { CloserKpiGrid } from './CloserKpiGrid';
import { CentralDoDiaSection } from './CentralDoDiaSection';
import { CloserRiskDealsList } from './CloserRiskDealsList';
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

      {unavailableWidgets.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Algumas métricas ainda não possuem fonte confiável no schema atual: {unavailableWidgets.join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      <CentralDoDiaSection
        central={data.central_do_dia}
        agenda={data.lists.today_agenda ?? []}
        overdue={data.lists.overdue_followups ?? []}
        proposalsAction={data.lists.proposals_action_required ?? []}
        nextActions={data.lists.next_actions ?? []}
      />

      <CloserKpiGrid kpis={data.kpis} availability={data.availability} />

      <CloserRiskDealsList deals={data.lists.risk_deals ?? []} />

      {isEmpty && <CloserDashboardEmptyState />}
    </div>
  );
}
