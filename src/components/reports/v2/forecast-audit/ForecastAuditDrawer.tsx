/**
 * Sprint F2.1 — Drawer de auditoria do Forecast.
 * Mostra de onde sai cada número, deals incluídos, excluídos e penalizados.
 */
import { useEffect, useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, RefreshCcw, Sparkles } from 'lucide-react';
import { useForecastAuditRun, type ForecastAuditRunResult } from '@/hooks/useForecastAuditRun';
import { useForecastAuditItems, type ForecastAuditItem } from '@/hooks/useForecastAuditItems';
import { formatCurrency, formatPct } from '@/lib/reports/formatReportNumbers';

const PENALTY_LABELS: Record<string, string> = {
  // legacy
  slipping_close_date: 'Close date vencida',
  no_recent_activity: 'Sem atividade recente (14d)',
  no_next_step: 'Sem próximo passo definido',
  missing_close_date: 'Close date não preenchida',
  // V2 engine
  stale_activity: 'Atividade parada (>14 dias)',
  missing_next_step: 'Sem próximo passo definido',
  expired_close_date: 'Close date vencida',
  high_risk: 'Risco alto',
  critical_risk: 'Risco crítico',
  end_of_month_restriction: 'Restrição de fim de mês',
  close_date_outside_period: 'Close date fora do período',
  low_nrhs: 'NRHS baixo (40-59)',
  weak_stage: 'Estágio fraco',
};

const EXCLUSION_LABELS: Record<string, string> = {
  // legacy
  no_value: 'Sem valor preenchido',
  no_probability: 'Sem probabilidade',
  low_nrhs: 'NRHS abaixo de 40',
  lost: 'Oportunidade perdida',
  // V2 engine
  lost_opportunity: 'Oportunidade perdida',
  missing_deal_value: 'Valor não preenchido',
  zero_probability: 'Probabilidade zero',
  nrhs_below_40: 'NRHS abaixo de 40',
  missing_close_date: 'Close date não preenchida',
};

const BUCKET_LABELS: Record<ForecastAuditItem['forecast_bucket'], string> = {
  closed: 'Receita fechada',
  commit: 'Commit',
  best_case: 'Best case',
  realistic: 'Realista',
  optimistic: 'Otimista',
  pipeline_only: 'Apenas pipeline',
  excluded: 'Excluído',
  slipping: 'Escorregando',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  pipelineId: string | null | undefined;
  periodStart: string;
  periodEnd: string;
  sellerId?: string | null;
}

export function ForecastAuditDrawer({
  open, onOpenChange, organizationId, pipelineId, periodStart, periodEnd, sellerId,
}: Props) {
  const { run, runId, isLoading, error, runCalculation } = useForecastAuditRun({
    organizationId, pipelineId, periodStart, periodEnd, sellerId,
  });
  const { data: items = [] } = useForecastAuditItems(runId);

  // Auto-trigger quando abrir
  useEffect(() => {
    if (open && organizationId && !run && !isLoading) {
      runCalculation().catch(() => {/* exibido no Alert */});
    }
  }, [open, organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const buckets = useMemo(() => {
    const acc: Record<string, { count: number; sum: number }> = {};
    for (const it of items) {
      const k = it.forecast_bucket;
      acc[k] = acc[k] ?? { count: 0, sum: 0 };
      acc[k].count += 1;
      acc[k].sum += k === 'closed' ? Number(it.deal_value) : Number(it.adjusted_value);
    }
    return acc;
  }, [items]);

  const topPenalties = useMemo(() => topReasons(items.flatMap(i => i.penalty_reasons), PENALTY_LABELS), [items]);
  const topExclusions = useMemo(() => topReasons(items.flatMap(i => i.exclusion_reasons), EXCLUSION_LABELS), [items]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auditoria do Forecast
          </SheetTitle>
          <SheetDescription>
            Veja exatamente de onde saem os números: oportunidades usadas, excluídas, penalizadas e a fórmula de cada cenário.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Não foi possível calcular</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs">{error.message}</p>
                  <Button size="sm" variant="outline" onClick={() => runCalculation()}>
                    <RefreshCcw className="h-3 w-3 mr-1" /> Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isLoading && !run && (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            )}

            {run && (
              <>
                <RunSummary run={run} periodStart={periodStart} periodEnd={periodEnd} />
                <FormulaSection version={run.calculation_version} />
                <ConfidenceReasonsSection reasons={run.confidence_reasons ?? []} />
                <BucketsSection buckets={buckets} />
                <ReasonsSection title="Top motivos de penalização" reasons={topPenalties} emptyHint="Nenhuma penalização aplicada." />
                <ReasonsSection title="Top motivos de exclusão" reasons={topExclusions} emptyHint="Nenhuma exclusão aplicada." />
                <DealsList items={items} />
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function topReasons(all: string[], labels: Record<string, string>) {
  const counts: Record<string, number> = {};
  for (const r of all) counts[r] = (counts[r] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count, label: labels[key] ?? key }));
}

function RunSummary({ run, periodStart, periodEnd }: { run: ForecastAuditRunResult; periodStart: string; periodEnd: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span>Resumo do cálculo</span>
          {run.calculation_version && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {run.calculation_version}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Período: <strong className="text-foreground">{periodStart} → {periodEnd}</strong>
          {typeof run.days_remaining === 'number' && (
            <> · <strong className="text-foreground">{run.days_remaining}</strong> dias restantes</>
          )}
          {run.is_end_of_month_restricted && (
            <Badge variant="destructive" className="ml-2 text-[10px]">Fim de período</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Receita fechada" value={formatCurrency(run.total_closed)} />
          <Metric label="Commit" value={formatCurrency(run.total_commit)} />
          <Metric label="Realista" value={formatCurrency(run.scenario_realistic)} />
          <Metric label="Otimista" value={formatCurrency(run.scenario_optimistic)} />
          <Metric label="Best case" value={formatCurrency(run.total_best_case)} />
          <Metric label="Confiança" value={formatPct(run.forecast_confidence)} />
          <Metric label="NRHS médio" value={`${Math.round(run.nrhs_avg)}`} />
          <Metric label="Qualidade dos dados" value={formatPct(run.data_quality_score)} />
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-2 text-xs">
          <CountChip label="Deals" value={run.deals_count} />
          <CountChip label="Incluídos" value={run.included_deals_count} tone="success" />
          <CountChip label="Excluídos" value={run.excluded_deals_count} tone="muted" />
          <CountChip label="Em risco" value={run.risk_deals_count} tone="warning" />
          <CountChip label="Slipping" value={run.slipping_deals_count} tone="warning" />
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceReasonsSection({ reasons }: { reasons: string[] }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Por que essa confiança?</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FormulaSection({ version }: { version?: string }) {
  const isV2 = version === 'forecast_v2_engine_1';
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Fórmula oficial</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs text-muted-foreground">
        {isV2 ? (
          <>
            <div className="font-mono text-[11px] rounded bg-muted/40 p-2 leading-relaxed">
              adjusted_value = deal_value × adjusted_probability × nrhs_factor × time_factor × activity_factor × next_step_factor × stage_factor × risk_factor
            </div>
            <div className="pt-2">
              <div>• <strong>Pessimista</strong>: somente receita fechada no período</div>
              <div>• <strong>Realista</strong>: fechado + Σ adjusted_value (commit + realistic)</div>
              <div>• <strong>Otimista</strong>: fechado + Σ adjusted_value (commit + realistic + optimistic)</div>
              <div>• <strong>Best case</strong>: teto comercial — não é previsão</div>
            </div>
            <div className="pt-1">adjusted_probability = manual × 0,6 + estágio × 0,4 (ou o que existir)</div>
          </>
        ) : (
          <>
            <div>• <strong>Pessimista</strong>: Fechado + 70% do Commit</div>
            <div>• <strong>Realista</strong>: Fechado + Commit + 50% do Realista</div>
            <div>• <strong>Otimista</strong>: Fechado + Commit + Realista + 50% do Otimista</div>
            <div>• <strong>Best case</strong>: Fechado + Commit + Realista + Otimista (todos ponderados por probabilidade ajustada)</div>
            <div className="pt-2">
              Probabilidade ajustada = prob × NRHS_factor × time_factor × activity_factor.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BucketsSection({ buckets }: { buckets: Record<string, { count: number; sum: number }> }) {
  const order: ForecastAuditItem['forecast_bucket'][] = [
    'closed','commit','realistic','optimistic','pipeline_only','excluded',
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Por bucket</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {order.map(k => {
          const v = buckets[k];
          if (!v) return null;
          return (
            <div key={k} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{BUCKET_LABELS[k]}</Badge>
                <span className="text-xs text-muted-foreground">{v.count} deals</span>
              </div>
              <span className="font-mono text-sm">{formatCurrency(v.sum)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ReasonsSection({
  title, reasons, emptyHint,
}: { title: string; reasons: { key: string; count: number; label: string }[]; emptyHint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {reasons.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-1.5">
            {reasons.map(r => (
              <li key={r.key} className="flex items-center justify-between text-sm">
                <span>{r.label}</span>
                <Badge variant="secondary">{r.count}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DealsList({ items }: { items: ForecastAuditItem[] }) {
  const top = items.slice(0, 20);
  if (!top.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Top oportunidades ({top.length} de {items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.map(it => (
          <div key={it.id} className="flex items-start justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{it.deal_name ?? '—'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {it.company_name ?? '—'} · NRHS {it.nrhs_score ?? '—'} · prob {it.adjusted_probability != null ? Math.round(Number(it.adjusted_probability)) + '%' : '—'}
              </p>
              {(it.exclusion_reasons.length > 0 || it.penalty_reasons.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {it.exclusion_reasons.map(r => (
                    <Badge key={'e'+r} variant="destructive" className="text-[10px]">{EXCLUSION_LABELS[r] ?? r}</Badge>
                  ))}
                  {it.penalty_reasons.map(r => (
                    <Badge key={'p'+r} variant="outline" className="text-[10px]">{PENALTY_LABELS[r] ?? r}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm">{formatCurrency(it.adjusted_value)}</p>
              <Badge variant="outline" className="text-[10px] mt-0.5">{BUCKET_LABELS[it.forecast_bucket]}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CountChip({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'muted' }) {
  const cls =
    tone === 'success' ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
    : tone === 'warning' ? 'border-amber-500/30 text-amber-700 dark:text-amber-400'
    : tone === 'muted' ? 'border-border text-muted-foreground'
    : 'border-border';
  return (
    <div className={`rounded-md border ${cls} px-2 py-1.5 text-center`}>
      <div className="text-base font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase">{label}</div>
    </div>
  );
}
