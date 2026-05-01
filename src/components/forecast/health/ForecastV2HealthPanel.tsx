import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, Activity, Calculator, Camera, Gauge, Lightbulb } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useForecastV2Health, useRecalculateForecast, useGenerateSnapshot, useCalculateAccuracy } from '@/hooks/forecast/useForecastV2Health';
import { CONSISTENCY_LABELS, HEALTH_LABELS, type DataConsistency, type HealthStatus } from '@/types/forecast-health';
import { cn } from '@/lib/utils';

interface Props {
  periodStart: Date;
  periodEnd: Date;
  pipelineId?: string;
}

function statusTone(s: HealthStatus): string {
  switch (s) {
    case 'healthy': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    case 'attention': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function fmtDt(d: string | null): string {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM HH:mm'); } catch { return '—'; }
}

export function ForecastV2HealthPanel({ periodStart, periodEnd, pipelineId }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const { isOwner } = useCurrentOrganization();
  const { isPlatformAdmin } = usePlatformAdmin();
  const isPrivileged = isAdmin || isManager;
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const periodStartStr = format(periodStart, 'yyyy-MM-dd');
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd');

  const { health, isLoading, error, refetch, isFetching } = useForecastV2Health({
    organizationId: orgId,
    pipelineId: pipelineId ?? null,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    enabled: isPrivileged && !!orgId,
  });

  const recalc = useRecalculateForecast();
  const snapshot = useGenerateSnapshot();
  const accuracy = useCalculateAccuracy();

  if (!isPrivileged) {
    return <p className="text-sm text-muted-foreground">Esta área é restrita a administradores e gestores.</p>;
  }
  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !health || health.status === 'forbidden') {
    return <p className="text-sm text-muted-foreground">Não foi possível carregar o health check agora.</p>;
  }

  const actionParams = { organizationId: orgId!, pipelineId: pipelineId ?? null, periodStart: periodStartStr, periodEnd: periodEndStr };
  const consistencyEntries = Object.entries(health.data_consistency) as [keyof DataConsistency, boolean][];

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card className={cn('border-2', statusTone(health.status))}>
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Gauge className="h-6 w-6" />
            <div>
              <div className="text-xs uppercase tracking-wide opacity-75">Forecast V2</div>
              <div className="text-lg font-semibold">{HEALTH_LABELS[health.status]}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {health.calculation_version && <Badge variant="outline" className="text-[10px]">{health.calculation_version}</Badge>}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isFetching && 'animate-spin')} /> Recarregar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature flag banner */}
      {!health.feature_flag_enabled && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Forecast Engine V2 está desligada para esta organização
            </div>
            <p className="text-muted-foreground">
              Para ativar, execute na configuração técnica:
            </p>
            <pre className="text-xs bg-background border rounded p-2 overflow-x-auto">
{`UPDATE feature_flags
SET enabled = true
WHERE organization_id = '${orgId}'
  AND flag_key = 'forecast_v2_engine_enabled';`}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Feature Flag" value={health.feature_flag_enabled ? 'Ativada' : 'Desativada'} ok={health.feature_flag_enabled} />
        <MetricCard label="Último Cálculo" value={fmtDt(health.latest_run_at)} ok={!!health.latest_run_at} />
        <MetricCard label="Último Snapshot" value={health.latest_snapshot_at ? format(new Date(health.latest_snapshot_at), 'dd/MM') : '—'} ok={!!health.latest_snapshot_at} />
        <MetricCard label="Snapshots no Período" value={String(health.snapshots_count)} ok={health.snapshots_count >= 5} />
        <MetricCard label="Acurácia" value={health.accuracy_score != null ? `${Math.round(health.accuracy_score)}%` : 'em formação'} ok={health.accuracy_ready} />
        <MetricCard label="Engine" value={health.calculation_version ?? '—'} ok={!!health.calculation_version} />
        <MetricCard label="Risk Center" value={health.risk_center_ready ? 'Pronto' : 'Aguardando'} ok={health.risk_center_ready} />
        <MetricCard label="AI Intelligence" value={health.intelligence_ready ? 'Pronto' : 'Aguardando'} ok={health.intelligence_ready} />
      </div>

      {/* Consistency checks */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium">Consistência dos dados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {consistencyEntries.map(([k, ok]) => (
              <div key={k} className="flex items-center gap-2">
                {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                <span className={ok ? '' : 'text-red-600 font-medium'}>{CONSISTENCY_LABELS[k]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Issues */}
      {(health.errors.length > 0 || health.warnings.length > 0 || health.recommendations.length > 0) && (
        <div className="grid md:grid-cols-3 gap-3">
          <IssuesList title="Erros" items={health.errors.map(e => e.message)} icon={XCircle} tone="critical" />
          <IssuesList title="Alertas" items={health.warnings.map(w => w.message)} icon={AlertTriangle} tone="attention" />
          <IssuesList title="Recomendações" items={health.recommendations} icon={Lightbulb} tone="healthy" />
        </div>
      )}

      {/* Admin actions */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" /> Ações administrativas</h3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => recalc.mutate(actionParams)} disabled={recalc.isPending}>
              <Calculator className={cn('h-3.5 w-3.5 mr-1', recalc.isPending && 'animate-spin')} /> Recalcular Forecast
            </Button>
            <Button size="sm" variant="outline" onClick={() => snapshot.mutate(actionParams)} disabled={snapshot.isPending}>
              <Camera className={cn('h-3.5 w-3.5 mr-1', snapshot.isPending && 'animate-spin')} /> Gerar Snapshot
            </Button>
            <Button size="sm" variant="outline" onClick={() => accuracy.mutate(actionParams)} disabled={accuracy.isPending}>
              <Gauge className={cn('h-3.5 w-3.5 mr-1', accuracy.isPending && 'animate-spin')} /> Calcular Acurácia
            </Button>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Health check em {health.performance.last_health_check_ms}ms · Run há {health.performance.latest_run_age_minutes ?? '—'} min · Snapshot há {health.performance.latest_snapshot_age_hours ?? '—'} h
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        </div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function IssuesList({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: any; tone: HealthStatus }) {
  return (
    <Card className={cn('border', statusTone(tone))}>
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4" /> {title} ({items.length})</div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item.</p>
        ) : (
          <ul className="text-xs space-y-1 list-disc list-inside">
            {items.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
