/**
 * Sprint 2.7 — Tela V2: Forecast de Receita.
 * Cenários e atingimento vêm do edge function (não do frontend).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, Target, Activity, DollarSign, AlertCircle, Calculator,
} from 'lucide-react';
import { ForecastAuditDrawer } from './forecast-audit/ForecastAuditDrawer';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { useReportForecastV2 } from '@/hooks/useReportForecastV2';
import { buildReportV2RequestFromFilters } from '@/lib/reports/buildReportV2Request';
import { mapForecastV2 } from '@/lib/reports/mappers/mapForecastV2';
import { formatCurrency, formatPct } from '@/lib/reports/formatReportNumbers';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';
import { ReportMetaBar } from './shared/ReportMetaBar';
import { ReportWarningsPanel } from './shared/ReportWarningsPanel';
import { ReportLoadingState } from './shared/ReportLoadingState';
import { ReportErrorState } from './shared/ReportErrorState';
import { ReportEmptyState } from './shared/ReportEmptyState';


function ScenarioCard({
  label, value, tone, hint,
}: { label: string; value: string; tone: 'danger' | 'warning' | 'success' | 'primary'; hint?: string }) {
  const cls =
    tone === 'danger' ? 'border-destructive/30 bg-destructive/5'
    : tone === 'warning' ? 'border-amber-500/30 bg-amber-500/5'
    : tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/5'
    : 'border-primary/30 bg-primary/5';
  const valueCls =
    tone === 'danger' ? 'text-destructive'
    : tone === 'warning' ? 'text-amber-700 dark:text-amber-400'
    : tone === 'success' ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-primary';
  return (
    <Card className={cls}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueCls}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function RevenueForecastV2() {
  const { organization } = useCurrentUser();
  const { filters, effectiveDates } = useReportFiltersContext();
  const teamVisibility = useTeamVisibility();
  const [auditOpen, setAuditOpen] = useState(false);

  const request = useMemo(() => {
    if (!organization?.id || teamVisibility.loading) return undefined;
    return buildReportV2RequestFromFilters({
      organizationId: organization.id,
      filters,
      effectiveDates,
      teamVisibility: {
        enabled: !teamVisibility.canViewAll,
        visibleUserIds: teamVisibility.visibleUserIds,
      },
    });
  }, [organization?.id, filters, effectiveDates, teamVisibility]);

  const { data, meta, error, isLoading, refetch } = useReportForecastV2({
    organizationId: organization?.id,
    request,
  });

  if (isLoading || teamVisibility.loading) return <ReportLoadingState cardCount={4} />;
  if (error) return <ReportErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const view = mapForecastV2(data);
  if (!view) {
    return (
      <ReportEmptyState
        icon={TrendingUp}
        title="Sem dados de forecast"
        description="Verifique se há um pipeline marcado como principal e oportunidades em aberto."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <ReportMetaBar meta={meta} reportLabel="Forecast" />
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 gap-1.5"
          onClick={() => setAuditOpen(true)}
          title="Auditar de onde saem os números"
        >
          <Calculator className="h-3.5 w-3.5" />
          Ver cálculo
        </Button>
      </div>
      <ReportWarningsPanel confidence={meta?.confidence} />

      <ForecastAuditDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        organizationId={organization?.id}
        pipelineId={view.primaryPipelineId}
        periodStart={effectiveDates.startDate}
        periodEnd={effectiveDates.endDate}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" /> Receita fechada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(view.closedRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Activity className="h-4 w-4" /> Pipeline aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(view.openPipelineValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Pipeline ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(view.weightedPipelineValue)}</div>
            {view.reliabilityPct !== null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Confiabilidade: {formatPct(view.reliabilityPct)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" /> Meta mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view.hasGoal ? (
              <>
                <div className="text-2xl font-bold">{formatCurrency(view.monthlyGoal)}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Atingimento: <strong>{formatPct(view.attainmentPct)}</strong>
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Meta não configurada</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Cenários de receita</h3>
          <Badge variant="outline" className="text-xs">Calculado pelo backend V2</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <ScenarioCard label="Pessimista" value={formatCurrency(view.scenarios.pessimistic)} tone="danger" hint="Fechado + 50% do ponderado" />
          <ScenarioCard label="Realista" value={formatCurrency(view.scenarios.realistic)} tone="primary" hint="Fechado + ponderado" />
          <ScenarioCard label="Otimista" value={formatCurrency(view.scenarios.optimistic)} tone="warning" hint="Fechado + 150% do ponderado" />
          <ScenarioCard label="Best case" value={formatCurrency(view.scenarios.bestCase)} tone="success" hint="Fechado + pipeline aberto" />
        </div>
      </div>
    </div>
  );
}
