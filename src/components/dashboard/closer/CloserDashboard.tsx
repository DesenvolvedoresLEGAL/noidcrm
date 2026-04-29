import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, AlertTriangle, ShieldAlert, RefreshCw } from 'lucide-react';
import { useCloserDashboardData } from '@/hooks/dashboard/useCloserDashboardData';
import { CloserPeriodFilter } from './CloserPeriodFilter';
import { CloserKpiGrid } from './CloserKpiGrid';
import { CentralDoDiaSection } from './CentralDoDiaSection';
import { CloserPaceSection } from './CloserPaceSection';
import { CloserRiskDealsList } from './CloserRiskDealsList';
import { CloserTopActions } from './CloserTopActions';
import { CloserProposalsActionGroup } from './CloserProposalsActionGroup';
import { CloserActivitiesGroup } from './CloserActivitiesGroup';
import { CloserDashboardSkeleton } from './CloserDashboardSkeleton';
import { CloserDashboardErrorState } from './CloserDashboardErrorState';
import { CloserNotACloserState } from './CloserNotACloserState';
import { CloserDashboardEmptyState } from './CloserDashboardEmptyState';
import { CloserDashboardFeedbackCard } from './CloserDashboardFeedbackCard';
import { useEffect, useRef } from 'react';

interface Props {
  tenantId: string;
  targetUserId: string;
  mode?: 'preview' | 'runtime';
  onDataReady?: (loadMs: number) => void;
  onPaceReady?: (loadMs: number) => void;
}

export function CloserDashboard({ tenantId, targetUserId, mode = 'preview', onDataReady, onPaceReady }: Props) {
  const {
    data, isLoading, isFetching, error, period, setPeriod, unavailableWidgets, isEmpty, refetch,
  } = useCloserDashboardData({ tenantId, userId: targetUserId });

  const startRef = useRef<number>(performance.now());
  const dataReportedRef = useRef(false);

  useEffect(() => {
    if (!dataReportedRef.current && data) {
      dataReportedRef.current = true;
      const ms = Math.round(performance.now() - startRef.current);
      onDataReady?.(ms);
      onPaceReady?.(ms);
    }
  }, [data, onDataReady, onPaceReady]);

  if (isLoading) return <CloserDashboardSkeleton />;
  if (error) return <CloserDashboardErrorState message={(error as Error).message} />;
  if (!data) return <CloserDashboardEmptyState />;
  if (data.error === 'not_a_closer') return <CloserNotACloserState />;

  const lists = data.lists;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Dashboard Comercial</h3>
          <p className="text-sm text-muted-foreground">
            Central diária de vendas, propostas, follow ups, pace e oportunidades em risco.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CloserPeriodFilter value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Atualiza dados comerciais sem sair da tela."
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {mode === 'preview' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este dashboard usa dados reais do CRM, mas ainda está em modo preview. O dashboard
            principal do usuário continua inalterado.
          </AlertDescription>
        </Alert>
      )}

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
            Parte dos dados não carregou. O restante do dashboard continua disponível.
            <span className="block text-xs text-muted-foreground mt-1">
              Sem fonte: {unavailableWidgets.join(', ')}.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Central do Dia */}
      <CentralDoDiaSection central={data.central_do_dia} />

      {/* 2. Pace Diário */}
      <CloserPaceSection pace={data.pace} />

      {/* 3. Top 10 ações */}
      <CloserTopActions actions={lists.top_actions_today ?? []} />

      {/* 4. Propostas que exigem ação */}
      <CloserProposalsActionGroup
        expiringToday={lists.proposals_expiring_today ?? []}
        expiring48h={lists.proposals_expiring_48h ?? []}
        expired={lists.proposals_expired ?? []}
        viewedNoFollowup={lists.proposals_viewed_no_followup ?? []}
      />

      {/* 5. Follow ups e atividades */}
      <CloserActivitiesGroup
        todayAgenda={lists.today_agenda ?? []}
        overdueFollowups={lists.overdue_followups ?? []}
        withoutNextActivity={lists.opportunities_without_next_activity ?? []}
      />

      {/* 6. Deals em risco */}
      <CloserRiskDealsList deals={lists.risk_deals ?? []} />

      {/* 7. KPIs comerciais */}
      <CloserKpiGrid kpis={data.kpis} availability={data.availability} />

      {/* Oportunidades paradas (lista complementar) */}
      {(lists.stalled_opportunities?.length ?? 0) > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <CloserRiskDealsList deals={lists.stalled_opportunities ?? []} />
        </div>
      )}

      {isEmpty && <CloserDashboardEmptyState />}

      {mode === 'runtime' && <CloserDashboardFeedbackCard tenantId={tenantId} />}
    </div>
  );
}
