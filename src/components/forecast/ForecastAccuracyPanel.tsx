import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  AlertCircle,
  Calculator,
  Gauge,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  Trophy,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecastSnapshots } from '@/hooks/forecast/useForecastSnapshots';
import { useForecastAccuracy } from '@/hooks/forecast/useForecastAccuracy';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { toast } from '@/hooks/use-toast';
import {
  BIAS_LABELS,
  TREND_LABELS,
  type ForecastBias,
  type ForecastTrend,
} from '@/types/forecast-accuracy';

interface Props {
  pipelineId?: string | null;
  sellerId?: string | null;
}

function currentMonthRangeBR() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = fmt.format(new Date());
  const [y, m] = today.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, today };
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

function biasTone(b: ForecastBias) {
  if (b === 'overestimating') return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  if (b === 'underestimating') return 'bg-sky-500/15 text-sky-600 border-sky-500/30';
  if (b === 'balanced') return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
  return 'bg-muted text-muted-foreground';
}

function trendIcon(t: ForecastTrend) {
  if (t === 'improving') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (t === 'worsening') return <TrendingDown className="h-4 w-4 text-rose-500" />;
  if (t === 'stable') return <Minus className="h-4 w-4 text-sky-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function accuracyTone(score: number) {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-sky-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-rose-600';
}

export function ForecastAccuracyPanel({ pipelineId, sellerId }: Props) {
  const { data: currentUser } = useCurrentUser();
  const { isAdmin, isManager } = useUserRole();
  const { isOwner } = useCurrentOrganization();
  const { isPlatformAdmin } = usePlatformAdmin();
  const organizationId = currentUser?.organization?.id ?? null;
  const range = useMemo(() => currentMonthRangeBR(), []);
  const isPartial = range.end > range.today;

  const { snapshots } = useForecastSnapshots({
    organizationId,
    pipelineId: pipelineId ?? null,
    periodStart: range.start,
    periodEnd: range.end,
    sellerId: sellerId ?? null,
    enabled: !!organizationId,
  });

  const { accuracy, sellerAccuracy, isLoading, error, calculateAccuracy } =
    useForecastAccuracy({
      organizationId,
      pipelineId: pipelineId ?? null,
      periodStart: range.start,
      periodEnd: range.end,
      sellerId: sellerId ?? null,
      enabled: !!organizationId,
    });

  const canManage = isAdmin || isManager || isOwner || isPlatformAdmin;
  const snapshotCount = snapshots.length;

  const handleRecalc = async () => {
    try {
      await calculateAccuracy();
      toast({ title: 'Acurácia recalculada', description: 'Snapshots e métricas atualizados.' });
    } catch (e: any) {
      toast({
        title: 'Falha ao calcular acurácia',
        description: e?.message ?? 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acurácia indisponível</AlertTitle>
        <AlertDescription className="text-xs">
          Continuamos exibindo o histórico abaixo. Detalhe: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  // Estado <5 snapshots
  if (snapshotCount < 5) {
    const last = snapshots[snapshots.length - 1];
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Acurácia em formação
            </CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecalc}
                disabled={isLoading}
              >
                <Calculator className="h-3.5 w-3.5 mr-1.5" />
                Calcular acurácia agora
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O sistema já está coletando snapshots, mas precisa de pelo menos 5 registros para
            medir tendência com segurança.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Snapshots" value={String(snapshotCount)} />
            <Stat label="Último realista" value={fmtBRL(last?.scenario_realistic ?? null)} />
            <Stat
              label="Fechado atual"
              value={fmtBRL(accuracy?.actual_closed_amount ?? last?.closed_amount ?? null)}
            />
            <Stat
              label="Versão da engine"
              value={accuracy?.calculation_version ?? 'forecast_v2_engine_1'}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado >=5
  const a = accuracy!;
  const best = a.best_snapshot as any;
  const worst = a.worst_snapshot as any;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4" /> Acurácia do Forecast
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {a.calculation_version}
                </Badge>
                {isPartial && (
                  <Badge variant="secondary" className="text-[10px]">
                    Parcial — mês em andamento
                  </Badge>
                )}
              </div>
            </div>
            {canManage && (
              <Button size="sm" variant="outline" onClick={handleRecalc} disabled={isLoading}>
                <Calculator className="h-3.5 w-3.5 mr-1.5" />
                Calcular acurácia agora
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Acurácia Geral</div>
              <div className={cn('text-2xl font-semibold tabular-nums', accuracyTone(a.accuracy_score))}>
                {a.accuracy_score.toFixed(0)}%
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Erro Médio</div>
              <div className="text-2xl font-semibold tabular-nums">
                {a.avg_error_percentage.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">{fmtBRL(a.avg_error_amount)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" /> Tendência
              </div>
              <div className="text-sm font-semibold flex items-center gap-1.5 mt-1">
                {trendIcon(a.forecast_trend)}
                {TREND_LABELS[a.forecast_trend]}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Bias</div>
              <Badge variant="outline" className={cn('mt-1', biasTone(a.bias_direction))}>
                {BIAS_LABELS[a.bias_direction]}
              </Badge>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Trophy className="h-3 w-3 text-emerald-500" /> Melhor Previsão
              </div>
              <div className="text-sm font-semibold mt-1">{fmtDate(best?.snapshot_date)}</div>
              <div className="text-[10px] text-muted-foreground">
                Erro {best?.realistic_error_percentage != null
                  ? `${Number(best.realistic_error_percentage).toFixed(1)}%`
                  : '—'}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-rose-500" /> Pior Previsão
              </div>
              <div className="text-sm font-semibold mt-1">{fmtDate(worst?.snapshot_date)}</div>
              <div className="text-[10px] text-muted-foreground">
                Erro {worst?.realistic_error_percentage != null
                  ? `${Number(worst.realistic_error_percentage).toFixed(1)}%`
                  : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {sellerAccuracy.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Acurácia por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Snapshots</TableHead>
                  <TableHead className="text-right">Fechado Real</TableHead>
                  <TableHead className="text-right">Forecast Médio</TableHead>
                  <TableHead className="text-right">Último Forecast</TableHead>
                  <TableHead className="text-right">Erro Médio</TableHead>
                  <TableHead className="text-right">Acurácia</TableHead>
                  <TableHead>Bias</TableHead>
                  <TableHead>Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerAccuracy.map((s) => (
                  <TableRow key={s.seller_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.seller_name}</span>
                        {s.snapshots_count < 5 && (
                          <Badge variant="outline" className="text-[10px]">
                            Baixa amostra
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {s.snapshots_count}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {fmtBRL(s.actual_closed_amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtBRL(s.avg_realistic_forecast)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtBRL(s.last_realistic_forecast)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {s.avg_error_percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right text-sm font-semibold tabular-nums',
                        accuracyTone(s.accuracy_score)
                      )}
                    >
                      {s.accuracy_score.toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={biasTone(s.bias_direction)}>
                        {BIAS_LABELS[s.bias_direction]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        {trendIcon(s.forecast_trend)}
                        {TREND_LABELS[s.forecast_trend]}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums truncate">{value}</div>
    </div>
  );
}
