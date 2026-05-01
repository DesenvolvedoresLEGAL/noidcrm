import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Camera, History, RefreshCw, Sparkles, AlertTriangle, Activity } from 'lucide-react';
import { useForecastSnapshots, useCreateForecastSnapshot } from '@/hooks/forecast/useForecastSnapshots';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRole } from '@/hooks/useUserRole';

interface ForecastSnapshotHistoryProps {
  pipelineId?: string | null;
  sellerId?: string | null;
}

function currentMonthRangeBR(): { start: string; end: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = fmt.format(new Date()); // YYYY-MM-DD
  const [y, m] = today.split('-').map(Number);
  const start = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function formatBRL(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

export function ForecastSnapshotHistory({ pipelineId, sellerId }: ForecastSnapshotHistoryProps) {
  const { data: currentUser } = useCurrentUser();
  const { isAdmin, isManager } = useUserRole();

  const organizationId = currentUser?.organization?.id ?? null;
  const range = useMemo(() => currentMonthRangeBR(), []);

  const { snapshots, latestSnapshot, hasEnoughHistory, isLoading, refetch } = useForecastSnapshots({
    organizationId,
    pipelineId: pipelineId ?? null,
    periodStart: range.start,
    periodEnd: range.end,
    sellerId: sellerId ?? null,
    enabled: !!organizationId,
  });

  const createSnapshot = useCreateForecastSnapshot();

  const canManage = isAdmin || isManager;

  const handleGenerateNow = () => {
    if (!organizationId || !pipelineId) return;
    createSnapshot.mutate(
      {
        organizationId,
        pipelineId,
        periodStart: range.start,
        periodEnd: range.end,
        sellerId: sellerId ?? null,
      },
      { onSuccess: () => refetch() },
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Estado 0: sem snapshots
  if (snapshots.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Acurácia em formação
            </CardTitle>
            {canManage && pipelineId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateNow}
                disabled={createSnapshot.isPending}
              >
                {createSnapshot.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                )}
                Gerar snapshot agora
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Forecast começou a registrar snapshots diários. Assim que houver histórico suficiente,
            esta aba mostrará erro médio, tendência e comparação entre previsão e realizado.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Snapshots encontrados</div>
              <div className="text-2xl font-semibold">0</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <Badge variant="outline">Aguardando primeira execução</Badge>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Próxima coleta</div>
              <div className="text-sm font-medium">23h50 (BRT)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado 1-4: histórico em formação
  if (!hasEnoughHistory) {
    const first = snapshots[0];
    const last = latestSnapshot!;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" /> Histórico em formação
            </CardTitle>
            {canManage && pipelineId && (
              <Button size="sm" variant="outline" onClick={handleGenerateNow} disabled={createSnapshot.isPending}>
                {createSnapshot.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                )}
                Gerar snapshot agora
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Já existem snapshots registrados, mas ainda não há volume suficiente para medir acurácia com segurança.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Snapshots" value={String(snapshots.length)} />
            <Stat label="Primeiro" value={formatDate(first.snapshot_date)} />
            <Stat label="Último" value={formatDate(last.snapshot_date)} />
            <Stat label="Realista" value={formatBRL(last.scenario_realistic)} />
            <Stat label="Fechado" value={formatBRL(last.closed_amount)} />
            <Stat label="Confiança" value={`${Math.round((last.forecast_confidence || 0))}%`} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado >=5: cards + gráfico + tabela
  const last = latestSnapshot!;
  const gap = (last.monthly_goal || 0) - (last.closed_amount || 0);

  const chartData = snapshots.map((s) => ({
    date: formatDate(s.snapshot_date),
    realista: Number(s.scenario_realistic || 0),
    fechado: Number(s.closed_amount || 0),
    meta: Number(s.monthly_goal || 0),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Forecast — Histórico Diário
            </CardTitle>
            {canManage && pipelineId && (
              <Button size="sm" variant="outline" onClick={handleGenerateNow} disabled={createSnapshot.isPending}>
                {createSnapshot.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                )}
                Gerar snapshot agora
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Realista (último)" value={formatBRL(last.scenario_realistic)} />
            <Stat label="Fechado atual" value={formatBRL(last.closed_amount)} />
            <Stat label="Gap vs Meta" value={formatBRL(gap)} highlight={gap > 0 ? 'warning' : 'success'} />
            <Stat label="Confiança" value={`${Math.round(last.forecast_confidence || 0)}%`} />
            <Stat label="Em risco" value={String(last.risk_deals_count || 0)} icon={AlertTriangle} />
            <Stat label="Sem atividade" value={String(last.no_recent_activity_count || 0)} />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip
                  formatter={(value: any) => formatBRL(Number(value))}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="realista" name="Realista" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fechado" name="Fechado" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="meta" name="Meta" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Snapshots por dia</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Realista</th>
                <th className="py-2 pr-3">Otimista</th>
                <th className="py-2 pr-3">Fechado Final</th>
                <th className="py-2 pr-3">Erro R$</th>
                <th className="py-2 pr-3">Erro %</th>
                <th className="py-2 pr-3">Acurácia</th>
                <th className="py-2 pr-3">Bias</th>
                <th className="py-2 pr-3">Confiança</th>
                <th className="py-2 pr-3">Versão</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.slice().reverse().slice(0, 30).map((s) => {
                const actual = s.actual_closed_amount ?? s.closed_won_final_amount;
                const pending = actual == null;
                const biasMap: Record<string, string> = {
                  overestimating: 'Inflando',
                  underestimating: 'Subestimando',
                  balanced: 'Equilibrado',
                  unknown: '—',
                };
                return (
                  <tr key={s.snapshot_id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatDate(s.snapshot_date)}</td>
                    <td className="py-2 pr-3">{formatBRL(s.scenario_realistic)}</td>
                    <td className="py-2 pr-3">{formatBRL(s.scenario_optimistic)}</td>
                    <td className="py-2 pr-3">
                      {pending ? <span className="text-muted-foreground italic">Em cálculo</span> : formatBRL(actual)}
                    </td>
                    <td className="py-2 pr-3">
                      {s.realistic_error_amount != null ? formatBRL(s.realistic_error_amount) : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {s.realistic_error_percentage != null ? `${Number(s.realistic_error_percentage).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2 pr-3">
                      {s.accuracy_score != null ? `${Math.round(s.accuracy_score)}%` : '—'}
                    </td>
                    <td className="py-2 pr-3">{s.bias_direction ? biasMap[s.bias_direction] : '—'}</td>
                    <td className="py-2 pr-3">{Math.round(s.forecast_confidence || 0)}%</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{s.calculation_version ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <div
        className={
          'text-lg font-semibold ' +
          (highlight === 'warning' ? 'text-amber-500' : highlight === 'success' ? 'text-emerald-500' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}
