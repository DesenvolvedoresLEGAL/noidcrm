// Sprint WL-LOSSES-01 — Aba Losses do Win/Loss Hub.
// Análise dedicada de negócios perdidos: motivos, falha comercial, recuperáveis,
// gap humano × IA, funil, time-to-loss, voz do cliente e recomendações
// determinísticas. Sem IA efêmera. Reaproveita useWinLossData + useLossSemantic
// + diagnosis helpers. Accountability vem de loss_reasons.loss_accountability
// (oficial, banco) — nunca hardcoded no frontend.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingDown, DollarSign, AlertOctagon, ShieldCheck, Recycle, Crown,
  AlertTriangle, Layers, Clock, GitCompareArrows, MessageSquareQuote,
  Lightbulb, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { WinLossDataResult, TimeframePreset, DateRange } from '@/hooks/useWinLossData';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';
import {
  buildCommercialFailureSummary,
  aggregateLossesByCategory,
  buildMonthSignals,
  getShortRecommendation,
  getCategoryLabel,
  type LossAccountability,
} from '@/lib/winloss/diagnosis';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';

// ── Labels executivos de accountability (mapeamento de display) ───────
const ACCOUNTABILITY_LABELS: Record<LossAccountability, string> = {
  commercial: 'Comercial',
  client: 'Cliente',
  operations: 'Operações',
  market: 'Mercado',
  unknown: 'Não classificado',
};

const ACCOUNTABILITY_TONE: Record<LossAccountability, string> = {
  commercial: 'bg-red-500/15 text-red-600 border-red-500/30',
  client: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  operations: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  market: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  semantic: LossSemanticAggregates | undefined;
  timeframe: TimeframePreset;
  dateRange: DateRange;
  organizationId: string;
}

export function WinLossLossesTab({
  data, isLoading, semantic, timeframe, dateRange, organizationId,
}: Props) {
  const losses = data?.losses || [];

  // ── Agregados derivados ────────────────────────────────────────────
  const commercialFailure = useMemo(
    () => (data ? buildCommercialFailureSummary(data) : undefined),
    [data],
  );

  const categoryAgg = useMemo(
    () => aggregateLossesByCategory(losses, dateRange),
    [losses, dateRange],
  );

  // Top motivos específicos (nome do motivo) com accountability + tendência prévia.
  const topReasons = useMemo(() => buildTopReasons(losses, dateRange), [losses, dateRange]);

  // Perdas por etapa — buscar nomes dos stages a partir dos opportunity.stage_id.
  // Fazemos uma query leve isolada para não tocar em useWinLossData.
  const stageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of losses) {
      const sid = (l.opportunity as any)?.stage_id;
      if (sid) ids.add(sid);
    }
    return [...ids];
  }, [losses]);

  const { data: stageNameMap } = useQuery({
    queryKey: ['winloss-losses-stage-names', organizationId, stageIds.sort().join(',')],
    enabled: !!organizationId && stageIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: stages } = await (supabase as any)
        .from('pipeline_stages')
        .select('id, name')
        .in('id', stageIds);
      const map = new Map<string, string>();
      stages?.forEach((s: any) => map.set(s.id, s.name));
      return map;
    },
  });

  const stageBreakdown = useMemo(
    () => buildStageBreakdown(losses, stageNameMap),
    [losses, stageNameMap],
  );

  // Voz do cliente (lossFeedbacks já preparado pelo hook, limitamos a 5 e a 160c).
  const lossSnippets = useMemo(() => {
    return (data?.lossFeedbacks || [])
      .filter((f) => f.feedback && f.feedback.trim().length > 0)
      .slice(0, 5)
      .map((f) => ({
        ...f,
        snippet: f.feedback.length > 160 ? f.feedback.slice(0, 157) + '…' : f.feedback,
      }));
  }, [data?.lossFeedbacks]);

  // Recomendações determinísticas para reduzir perdas.
  const playbooks = useMemo(
    () => buildLossPlaybooks(categoryAgg, commercialFailure, semantic),
    [categoryAgg, commercialFailure, semantic],
  );

  // Sinais recentes vs tendência (dependendo do período).
  const showShortSignals = timeframe === 'today' || timeframe === '7d' || timeframe === '15d';
  const monthSignals = useMemo(
    () => (data ? buildMonthSignals(data, dateRange) : []),
    [data, dateRange],
  );

  // Tendência mensal dos top motivos (categorias) — só em períodos longos.
  const reasonTrend = useMemo(() => buildReasonTrend(losses), [losses]);

  // ── Loading / Empty ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-40 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-64 rounded-lg border bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!data || losses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum negócio perdido no período selecionado.
        </CardContent>
      </Card>
    );
  }

  // KPIs principais
  const lostCount = losses.length;
  const lostValue = data.lostValue;
  const principalReason = topReasons[0];
  const commercialPctOfLost = commercialFailure?.pctOfLostValue ?? 0;
  const recoverableValue = semantic?.recoverableRevenue ?? 0;
  const recoverableCount = semantic?.recoverableCount ?? 0;
  const crmTrust = semantic?.crmTrustScore ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-red-600" />
          <h2 className="text-xl font-semibold">Losses</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Entenda por que os negócios são perdidos, quanto isso custa e quais vazamentos precisam ser corrigidos.
        </p>
      </div>

      {/* 2. KPIs de Perda */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={TrendingDown} label="Total de perdas" value={lostCount.toString()} />
        <KpiCard icon={DollarSign} label="Valor perdido" value={fmtBRL(lostValue)} tone="loss" />
        <KpiCard
          icon={Crown}
          label="Principal motivo"
          value={principalReason?.reason || '—'}
          small
        />
        <KpiCard
          icon={AlertOctagon}
          label="Falha comercial"
          value={commercialFailure?.commercialCount
            ? `${fmtBRL(commercialFailure.commercialLostValue)}`
            : 'R$ 0'}
          subtitle={commercialFailure?.commercialCount
            ? `${commercialPctOfLost}% do perdido`
            : 'Sem perdas comerciais'}
          tone="loss"
        />
        <KpiCard
          icon={Recycle}
          label="Receita recuperável"
          value={recoverableValue > 0 ? fmtBRL(recoverableValue) : 'R$ 0'}
          subtitle={recoverableCount > 0 ? `${recoverableCount} oport.` : 'Nenhuma marcada'}
          tone="positive"
        />
        <KpiCard
          icon={ShieldCheck}
          label="CRM Trust Score"
          value={`${crmTrust}/100`}
          subtitle={crmTrust >= 80 ? 'Confiável' : crmTrust >= 60 ? 'Atenção' : 'Frágil'}
          tone={crmTrust >= 80 ? 'positive' : crmTrust >= 60 ? 'warn' : 'loss'}
        />
      </div>

      {/* 3. Principal Vazamento por valor perdido */}
      {principalReason && (() => {
        const valuePct = lostValue > 0
          ? Math.round((principalReason.lostValue / lostValue) * 100)
          : 0;
        return (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Principal vazamento por valor perdido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight">{principalReason.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {principalReason.count} {principalReason.count === 1 ? 'perda' : 'perdas'} ·{' '}
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      {fmtBRL(principalReason.lostValue)} perdidos
                    </span>{' '}
                    · {valuePct}% do valor perdido
                  </p>
                </div>
                <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                  {valuePct}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground border-t border-red-500/20 pt-2 italic">
                Ação: {getShortRecommendation(principalReason.category)}
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* 4. Top Motivos de Perda */}
      {topReasons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4" /> Top motivos de perda
            </CardTitle>
            <CardDescription className="text-xs">
              Motivos ordenados por valor perdido, com frequência, categoria e responsabilidade da perda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Motivo</th>
                    <th className="text-left font-medium py-2 px-2">Categoria</th>
                    <th className="text-right font-medium py-2 px-2">Perdas</th>
                    <th className="text-right font-medium py-2 px-2">Valor perdido</th>
                    <th className="text-right font-medium py-2 px-2">Participação</th>
                    <th className="text-left font-medium py-2 px-2">Accountability</th>
                    <th className="text-right font-medium py-2 pl-2">Tendência</th>
                  </tr>
                </thead>
                <tbody>
                  {topReasons.slice(0, 10).map((r) => (
                    <tr key={r.reason} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 truncate max-w-[260px]">{r.reason}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{getCategoryLabel(r.category)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-red-700 dark:text-red-400 font-medium">
                        {fmtBRL(r.lostValue)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {r.pct}%
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[10px] ${ACCOUNTABILITY_TONE[r.accountability]}`}>
                          {ACCOUNTABILITY_LABELS[r.accountability]}
                        </Badge>
                      </td>
                      <td className="py-2 pl-2 text-right text-xs">
                        <TrendCell delta={r.trendPp} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Perda por Falha Comercial — breakdown */}
      {commercialFailure?.available && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <AlertOctagon className="h-4 w-4 text-red-600" /> Perda por Falha Comercial
            </CardTitle>
            <CardDescription className="text-xs">
              Perdas classificadas oficialmente como responsabilidade comercial (banco · loss_accountability).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commercialFailure.commercialCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma perda atribuída a falha comercial no período. As perdas registradas têm causas externas
                (cliente, mercado, operações).
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <PatternCell
                  label="Valor perdido (comercial)"
                  value={fmtBRL(commercialFailure.commercialLostValue)}
                  highlight="loss"
                />
                <PatternCell
                  label="Quantidade de perdas"
                  value={commercialFailure.commercialCount.toString()}
                />
                <PatternCell
                  label="% sobre valor perdido"
                  value={`${commercialFailure.pctOfLostValue}%`}
                />
                <PatternCell
                  label="Principal causa comercial"
                  value={commercialFailure.topCategoryLabel || '—'}
                />
                {commercialFailure.topAction && (
                  <div className="md:col-span-4 text-xs text-muted-foreground italic border-t pt-2">
                    Ação recomendada: <span className="text-foreground">{commercialFailure.topAction}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. Perdas Recuperáveis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Recycle className="h-4 w-4 text-emerald-600" /> Perdas recuperáveis
          </CardTitle>
          <CardDescription className="text-xs">
            Oportunidades marcadas como recuperáveis (humano ou IA) — candidatas a reativação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recoverableCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma perda recuperável marcada no período. Revise perdas de Timing, Preço e Concorrência para
              identificar oportunidades de reativação.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <PatternCell
                label="Quantidade recuperável"
                value={recoverableCount.toString()}
              />
              <PatternCell
                label="Receita recuperável"
                value={fmtBRL(recoverableValue)}
                highlight="positive"
              />
              <PatternCell
                label="Principal causa recuperável"
                value={semantic?.recoverableTopCause
                  ? (LOSS_CATEGORY_LABELS[semantic.recoverableTopCause] || semantic.recoverableTopCause)
                  : '—'}
              />
              {semantic?.recoverableTopCause && (
                <div className="md:col-span-3 text-xs text-muted-foreground italic border-t pt-2">
                  Próxima ação: {getShortRecommendation(semantic.recoverableTopCause)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Motivo Declarado vs Motivo Inferido pela IA */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <GitCompareArrows className="h-4 w-4 text-purple-600" /> Declarado × Inferido pela IA
          </CardTitle>
          <CardDescription className="text-xs">
            A IA compara o motivo registrado pelo time com o que detecta nas evidências. Nunca sobrescreve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!semantic || semantic.total === 0 || semantic.topGapPairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem volume suficiente de análise semântica para detectar gaps com confiança.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <Badge variant="outline" className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                  {Math.round((semantic.gapPct / 100) * semantic.total)} perdas com gap
                </Badge>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{semantic.gapPct}% das perdas com análise</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 pr-3">Declarado</th>
                      <th className="text-left font-medium py-2 px-2">Inferido pela IA</th>
                      <th className="text-right font-medium py-2 px-2">Perdas</th>
                      <th className="text-right font-medium py-2 pl-2">Valor perdido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semantic.topGapPairs.slice(0, 5).map((p, i) => (
                      <tr key={i} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-3">
                          {LOSS_CATEGORY_LABELS[p.declared] || p.declared}
                        </td>
                        <td className="py-2 px-2 font-medium">
                          {LOSS_CATEGORY_LABELS[p.inferred] || p.inferred}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{p.count}</td>
                        <td className="py-2 pl-2 text-right tabular-nums text-red-700 dark:text-red-400">
                          {fmtBRL(p.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Perdas por Etapa do Funil */}
      {stageBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Perdas por etapa do funil
            </CardTitle>
            <CardDescription className="text-xs">
              Onde os negócios morrem. Identifique gargalos no processo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Etapa</th>
                    <th className="text-right font-medium py-2 px-2">Perdas</th>
                    <th className="text-right font-medium py-2 px-2">Valor perdido</th>
                    <th className="text-right font-medium py-2 px-2">Ciclo médio</th>
                    <th className="text-left font-medium py-2 pl-2">Principal motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {stageBreakdown.map((s) => (
                    <tr key={s.stageId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 truncate max-w-[220px]">{s.stageName}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-red-700 dark:text-red-400 font-medium">
                        {fmtBRL(s.lostValue)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.avgCycle != null ? `${s.avgCycle}d` : '—'}
                      </td>
                      <td className="py-2 pl-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {s.topReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9. Time-to-Loss */}
      {data.timeToLossDistribution.some((b) => b.count > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Time-to-Loss
            </CardTitle>
            <CardDescription className="text-xs">
              Em qual semana de vida os negócios morrem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimeToLossBar data={data.timeToLossDistribution} />
          </CardContent>
        </Card>
      )}

      {/* 10. Tendência ou Sinais Recentes */}
      {showShortSignals ? (
        monthSignals.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Sinais recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {monthSignals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 mt-0.5">•</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      ) : (
        reasonTrend.months.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4" /> Tendência de motivos de perda
              </CardTitle>
              <CardDescription className="text-xs">
                Evolução dos principais motivos ao longo do tempo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                      <th className="text-left font-medium py-2 pr-3">Motivo</th>
                      {reasonTrend.months.map((m) => (
                        <th key={m} className="text-right font-medium py-2 px-2">{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reasonTrend.rows.map((row) => (
                      <tr key={row.category} className="border-b border-border/40 last:border-0">
                        <td className="py-2 pr-3 text-xs">{getCategoryLabel(row.category)}</td>
                        {reasonTrend.months.map((m) => (
                          <td key={m} className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                            {row.byMonth[m] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* 11. Voz do Cliente nas Perdas */}
      {lossSnippets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MessageSquareQuote className="h-4 w-4 text-red-600" /> Voz do cliente nas perdas
            </CardTitle>
            <CardDescription className="text-xs">
              Trechos curtos. Texto completo na aba Entrevistas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lossSnippets.map((f, i) => (
                <div
                  key={i}
                  className="rounded-md border border-red-500/20 bg-red-500/5 p-3"
                >
                  <p className="text-sm italic">"{f.snippet}"</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5 flex-wrap">
                    {f.lossReason && <span>Motivo: {f.lossReason}</span>}
                    {f.competitor && (
                      <>
                        <span>·</span>
                        <span>vs {f.competitor}</span>
                      </>
                    )}
                    {f.value > 0 && (
                      <>
                        <span>·</span>
                        <span>{fmtBRL(f.value)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 12. Ações para Reduzir Perdas */}
      {playbooks.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-red-600" /> Ações para reduzir perdas
            </CardTitle>
            <CardDescription className="text-xs">
              Recomendações determinísticas derivadas dos dados do período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {playbooks.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Lightbulb className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* CRM Trust visual (compact) */}
      {semantic && semantic.total > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold">CRM Trust Score</h4>
              </div>
              <span className="text-xs text-muted-foreground">
                Qualidade {semantic.avgQuality}/100 · Cobertura {semantic.coveragePct}% · Gap {semantic.gapPct}%
              </span>
            </div>
            <Progress value={crmTrust} className="h-1.5" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
interface KpiCardProps {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  small?: boolean;
  tone?: 'loss' | 'positive' | 'warn';
}
function KpiCard({ icon: Icon, label, value, subtitle, small, tone }: KpiCardProps) {
  const toneClass =
    tone === 'loss' ? 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400' :
    tone === 'positive' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' :
    tone === 'warn' ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400' :
    '';
  return (
    <div className={`rounded-lg border p-3 ${toneClass || 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 font-bold tabular-nums ${small ? 'text-sm' : 'text-lg'} truncate`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      )}
    </div>
  );
}

function PatternCell({
  label, value, highlight,
}: { label: string; value: string; highlight?: 'loss' | 'positive' }) {
  const tone =
    highlight === 'loss' ? 'text-red-700 dark:text-red-400' :
    highlight === 'positive' ? 'text-emerald-700 dark:text-emerald-400' :
    '';
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium mt-1 truncate ${tone}`}>{value}</p>
    </div>
  );
}

function TrendCell({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-muted-foreground">—</span>;
  if (delta === 0) return <span className="text-muted-foreground">0pp</span>;
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600">
        <ArrowUp className="h-3 w-3" />
        {delta}pp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-emerald-600">
      <ArrowDown className="h-3 w-3" />
      {Math.abs(delta)}pp
    </span>
  );
}

function TimeToLossBar({ data }: { data: Array<{ week: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => {
        const h = Math.round((d.count / max) * 100);
        return (
          <div key={d.week} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-red-500/40 hover:bg-red-500/60 transition-colors min-h-[2px]"
              style={{ height: `${h}%` }}
              title={`${d.week}: ${d.count}`}
            />
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.week}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Aggregation helpers ──────────────────────────────────────────────
interface TopReasonRow {
  reason: string;
  category: string;
  count: number;
  lostValue: number;
  pct: number;
  accountability: LossAccountability;
  trendPp: number | null;
}

function buildTopReasons(
  losses: WinLossDataResult['losses'],
  dateRange: DateRange,
): TopReasonRow[] {
  if (losses.length === 0) return [];

  // Janela anterior de mesma duração
  const durationMs = dateRange.to.getTime() - dateRange.from.getTime();
  const prevFrom = new Date(dateRange.from.getTime() - durationMs);
  const prevTo = dateRange.from;

  const map = new Map<string, { count: number; lostValue: number; category: string; accountability: LossAccountability }>();
  let total = 0;
  let prevTotal = 0;
  const prevCounts = new Map<string, number>();

  for (const l of losses) {
    const reason = (l.reason as any)?.name || 'Não informado';
    const category = (l.reason as any)?.category || 'other';
    const accountability =
      ((l.reason as any)?.loss_accountability as LossAccountability | undefined) || 'unknown';
    const e = map.get(reason) || { count: 0, lostValue: 0, category, accountability };
    e.count++;
    e.lostValue += Number(l.final_value) || 0;
    map.set(reason, e);
    total++;

    const closedAt = (l.opportunity?.closed_at || l.opportunity?.updated_at) as string | undefined;
    if (closedAt) {
      const t = new Date(closedAt).getTime();
      if (t >= prevFrom.getTime() && t < prevTo.getTime()) {
        prevCounts.set(reason, (prevCounts.get(reason) || 0) + 1);
        prevTotal++;
      }
    }
  }

  return [...map.entries()]
    .map(([reason, e]) => {
      const pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
      let trendPp: number | null = null;
      if (prevTotal > 0) {
        const prevPct = Math.round(((prevCounts.get(reason) || 0) / prevTotal) * 100);
        trendPp = pct - prevPct;
      }
      return {
        reason,
        category: e.category,
        count: e.count,
        lostValue: e.lostValue,
        pct,
        accountability: e.accountability,
        trendPp,
      };
    })
    .sort((a, b) => b.lostValue - a.lostValue || b.count - a.count);
}

interface StageRow {
  stageId: string;
  stageName: string;
  count: number;
  lostValue: number;
  avgCycle: number | null;
  topReason: string | null;
}

function buildStageBreakdown(
  losses: WinLossDataResult['losses'],
  stageNameMap: Map<string, string> | undefined,
): StageRow[] {
  if (!stageNameMap || stageNameMap.size === 0) return [];
  const map = new Map<string, { count: number; lostValue: number; cycles: number[]; reasons: Map<string, number> }>();
  for (const l of losses) {
    const sid = (l.opportunity as any)?.stage_id;
    if (!sid) continue;
    const e = map.get(sid) || { count: 0, lostValue: 0, cycles: [], reasons: new Map() };
    e.count++;
    e.lostValue += Number(l.final_value) || 0;
    if (l.sales_cycle_days > 0) e.cycles.push(l.sales_cycle_days);
    const reason = (l.reason as any)?.name || 'Não informado';
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    map.set(sid, e);
  }
  return [...map.entries()]
    .map(([sid, e]) => ({
      stageId: sid,
      stageName: stageNameMap.get(sid) || 'Etapa desconhecida',
      count: e.count,
      lostValue: e.lostValue,
      avgCycle: e.cycles.length > 0
        ? Math.round(e.cycles.reduce((s, c) => s + c, 0) / e.cycles.length)
        : null,
      topReason: [...e.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))
    .sort((a, b) => b.lostValue - a.lostValue);
}

interface ReasonTrend {
  months: string[];
  rows: Array<{ category: string; byMonth: Record<string, number> }>;
}

function buildReasonTrend(losses: WinLossDataResult['losses']): ReasonTrend {
  if (losses.length === 0) return { months: [], rows: [] };
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const matrix = new Map<string, Map<string, number>>(); // category -> month -> count
  const monthSet = new Set<string>();
  for (const l of losses) {
    const cat = (l.reason as any)?.category || 'other';
    const closeRaw = (l.opportunity?.closed_at || l.opportunity?.updated_at || l.opportunity?.created_at) as
      | string | undefined;
    if (!closeRaw) continue;
    const d = new Date(closeRaw);
    const key = `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    monthSet.add(key);
    const row = matrix.get(cat) || new Map<string, number>();
    row.set(key, (row.get(key) || 0) + 1);
    matrix.set(cat, row);
  }
  const months = [...monthSet]; // chronological-ish (insertion order)
  // Pegar top 5 categorias por total
  const totals = [...matrix.entries()].map(([cat, row]) => ({
    cat, total: [...row.values()].reduce((s, v) => s + v, 0),
  })).sort((a, b) => b.total - a.total).slice(0, 5);
  const rows = totals.map(({ cat }) => ({
    category: cat,
    byMonth: Object.fromEntries(matrix.get(cat) || new Map()),
  }));
  return { months, rows };
}

function buildLossPlaybooks(
  categories: ReturnType<typeof aggregateLossesByCategory>,
  commercialFailure: ReturnType<typeof buildCommercialFailureSummary> | undefined,
  semantic: LossSemanticAggregates | undefined,
): string[] {
  const out: string[] = [];
  const top3 = categories.slice(0, 3).map((c) => c.category);

  if (top3.includes('timing')) {
    out.push('Criar alerta de cadência para oportunidades sem interação há mais de 7 dias.');
  }
  if (top3.includes('competition')) {
    out.push('Reforçar battlecards para os concorrentes que mais aparecem nas perdas.');
  }
  if (top3.includes('price')) {
    out.push('Revisar política de desconto e faixas aprovadas — Preço / Valor está entre os principais motivos.');
  }
  if (top3.includes('no_fit')) {
    out.push('Refinar ICP e qualificação no topo do funil para reduzir deals fora do perfil.');
  }
  if (top3.includes('internal')) {
    out.push('Auditar propostas com erro interno antes do envio (checklist de pré-envio).');
  }
  if (top3.includes('sales_process')) {
    out.push('Reforçar treinamento de processo comercial e SLA de follow-up.');
  }
  if (top3.includes('operational')) {
    out.push('Acionar CS/Operações para reduzir atritos pós-venda mencionados pelo cliente.');
  }

  if (commercialFailure?.commercialCount && commercialFailure.pctOfLostValue >= 25) {
    out.push(`Falha comercial representa ${commercialFailure.pctOfLostValue}% do valor perdido — promover review semanal de pipeline ativo.`);
  }

  if (semantic && semantic.total > 0 && semantic.crmTrustScore < 60) {
    out.push('Tornar obrigatório o preenchimento de diagnóstico de perda — CRM Trust Score abaixo do ideal.');
  }

  if (semantic && semantic.gapPct >= 25) {
    out.push('Auditar perdas com gap entre motivo declarado e inferido — calibrar diagnóstico do time comercial.');
  }

  return out.slice(0, 6);
}
