// Sprint WL-LOSSES-01 — Aba Losses do Win/Loss Hub.
// Análise dedicada de negócios perdidos: motivos, falha comercial, recuperáveis,
// gap humano × IA, funil, time-to-loss, voz do cliente e recomendações
// determinísticas. Sem IA efêmera. Reaproveita useWinLossData + useLossSemantic
// + diagnosis helpers. Accountability vem de loss_reasons.loss_accountability
// (oficial, banco) — nunca hardcoded no frontend.
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  TrendingDown, DollarSign, AlertOctagon, ShieldCheck, Recycle, Crown,
  AlertTriangle, Layers, Clock, GitCompareArrows, MessageSquareQuote,
  Lightbulb, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { WinLossDataResult, TimeframePreset, DateRange } from '@/hooks/useWinLossData';
import { LossOriginBreakdownBlock } from '../LossOriginBreakdownBlock';
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

  // Perdas por etapa — agora vem do hook (snapshot histórico em closed_at, fallback = stage atual).
  const lostStageBreakdown = data?.lostStageBreakdown || [];

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
  // CRM Trust Score calculado pelo motor determinístico WL-LOSS-04.
  const playbooks = useMemo(
    () => buildLossPlaybooks(categoryAgg, commercialFailure, semantic, data?.crmTrustDeterministic.score),
    [categoryAgg, commercialFailure, semantic, data?.crmTrustDeterministic.score],
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
  // CRM Trust Score determinístico (Sprint WL-LOSS-04) — calculado a partir do
  // preenchimento real (opportunities.loss_reason_id + loss_comment).
  // O score semântico (AI) fica como referência adicional quando disponível.
  const crmTrust = data.crmTrustDeterministic.score;
  const crmTrustBucket = data.crmTrustDeterministic.bucket;
  const declaredVsInferred = data.declaredVsInferred;

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
          subtitle={crmTrustBucket === 'confiável' ? 'Confiável' : crmTrustBucket === 'atenção' ? 'Atenção' : 'Frágil'}
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
          ) : recoverableValue === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Existem perdas marcadas como recuperáveis, mas sem valor recuperável estimado.
              </p>
              <p className="text-xs text-muted-foreground italic">
                Próxima ação: revise o valor das oportunidades recuperáveis para priorizar reativação.
              </p>
              <div className="text-xs text-muted-foreground border-t pt-2">
                {recoverableCount} {recoverableCount === 1 ? 'oportunidade' : 'oportunidades'} sem valor estimado.
              </div>
            </div>
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

      {/* 7. Perdas por Etapa do Pipeline (Sprint WL-LOSS-04)
           Espelha o bloco de Wins. Snapshot da etapa em closed_at via
           opportunity_stage_history; fallback = stage atual. */}
      <LostByStageCard rows={lostStageBreakdown} />

      {/* 7b. Perdas por Canal de Origem (Sprint WL-LOSSES-06) */}
      <LossOriginBreakdownBlock data={data} />

      {/* 8. Motivo Declarado x Motivo Inferido (Sprint WL-LOSS-04 — determinístico)
           Antes dependia exclusivamente de loss_semantic_analyses (IA). Agora usa
           inferência por palavras-chave sobre opportunities.loss_comment vs
           opportunities.loss_reason_id.category. IA fica como camada extra. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <GitCompareArrows className="h-4 w-4 text-purple-600" /> Motivo Declarado x Motivo Inferido
          </CardTitle>
          <CardDescription className="text-xs">
            Compara o motivo registrado pelo time com o tema dominante na descrição. Análise determinística — nunca sobrescreve o motivo humano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!declaredVsInferred.hasMinimumVolume ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Volume insuficiente para análise semântica.
              </p>
              <p className="text-[11px] text-muted-foreground">
                {declaredVsInferred.analyzed} perda(s) com motivo + descrição ≥ 30 caracteres no período. Mínimo: 5.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <Badge variant="outline" className="bg-purple-500/15 text-purple-600 border-purple-500/30">
                  {declaredVsInferred.analyzed} analisadas
                </Badge>
                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
                  {declaredVsInferred.coherent} coerentes
                </Badge>
                <Badge variant="outline" className="bg-red-500/15 text-red-700 border-red-500/30">
                  {declaredVsInferred.divergent} divergentes
                </Badge>
                {declaredVsInferred.inconclusive > 0 && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                    {declaredVsInferred.inconclusive} inconclusivas
                  </Badge>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Taxa de divergência: <span className="font-semibold text-foreground">{declaredVsInferred.divergenceRate}%</span>
                </span>
              </div>
              {declaredVsInferred.pairs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma divergência relevante detectada. Motivos declarados estão alinhados às descrições.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                        <th className="text-left font-medium py-2 pr-3">Declarado</th>
                        <th className="text-left font-medium py-2 px-2">Inferido pela descrição</th>
                        <th className="text-right font-medium py-2 px-2">Perdas</th>
                        <th className="text-right font-medium py-2 pl-2">Valor perdido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaredVsInferred.pairs.map((p, i) => (
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
              )}
            </div>
          )}
        </CardContent>
      </Card>


      {/* 9. Onde os Negócios Morrem — Curva de Mortalidade Comercial */}
      <LossMortalityBlock mortality={data.lossMortality} />


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

function LossMortalityBlock({ mortality }: { mortality: WinLossDataResult['lossMortality'] }) {
  const { buckets, totalLosses, peak, avgDays, p90Days } = mortality;
  const hasData = totalLosses >= 3 && peak != null;

  const insight = (() => {
    if (!peak) return null;
    if (peak.key === '0-3' || peak.key === '4-7') {
      return 'As perdas estão concentradas no início do ciclo. Revise qualificação, velocidade de resposta e primeira abordagem.';
    }
    if (peak.key === '8-14' || peak.key === '15-30') {
      return 'As perdas estão concentradas no meio do ciclo. Revise follow-up, proposta, objeções e comparação com concorrentes.';
    }
    return 'As perdas estão concentradas em ciclos longos. Revise estagnação, governança de follow-up e critérios de prioridade.';
  })();

  const maxCount = Math.max(1, ...buckets.map(b => b.count));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> Onde os Negócios Morrem
        </CardTitle>
        <CardDescription className="text-xs">
          Em que fase do ciclo comercial as perdas se concentram.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="space-y-1 py-2">
            <p className="text-sm text-muted-foreground">
              Sem dados suficientes para identificar o momento da perda.
            </p>
            <p className="text-xs text-muted-foreground">
              Use períodos maiores ou registre datas de perda com consistência para calcular a curva de mortalidade comercial.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mini KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MortalityKpi label="Pico de mortalidade" value={peak.label} />
              <MortalityKpi label="Perdas no pico" value={`${peak.count} ${peak.count === 1 ? 'perda' : 'perdas'}`} />
              <MortalityKpi label="Tempo médio até perda" value={avgDays != null ? `${avgDays} ${avgDays === 1 ? 'dia' : 'dias'}` : '—'} />
              <MortalityKpi label="90% das perdas até" value={p90Days != null ? `${p90Days} ${p90Days === 1 ? 'dia' : 'dias'}` : '—'} />
            </div>

            {/* Faixas */}
            <div className="space-y-1.5">
              {buckets.map(b => {
                const w = Math.round((b.count / maxCount) * 100);
                const isPeak = peak && b.key === peak.key;
                return (
                  <div key={b.key} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs">
                    <span className={`tabular-nums ${isPeak ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {b.label}
                    </span>
                    <div className="h-3 rounded bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full rounded ${isPeak ? 'bg-red-500/70' : 'bg-red-500/35'}`}
                        style={{ width: `${Math.max(b.count > 0 ? 4 : 0, w)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground whitespace-nowrap">
                      {b.count} · {b.pct}%{b.lostValue > 0 ? ` · ${fmtBRL(b.lostValue)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {insight && (
              <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-red-500/40 pl-2">
                <span className="font-medium text-foreground">{peak.pct}% das perdas</span> acontecem em <span className="font-medium text-foreground">{peak.label.toLowerCase()}</span>. {insight}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MortalityKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
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

// Sprint WL-LOSS-04 — Card "Perdas por Etapa do Pipeline" (espelha Wins).
function LostByStageCard({ rows }: { rows: import('@/hooks/useWinLossData').LostStageRow[] }) {
  const hasData = rows && rows.length > 0;
  const totalCount = hasData ? rows.reduce((s, r) => s + r.count, 0) : 0;
  const totalFallback = hasData ? rows.reduce((s, r) => s + r.fallbackCount, 0) : 0;
  const fallbackRatio = totalCount > 0 ? Math.round((totalFallback / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Layers className="h-4 w-4" /> Perdas por Etapa do Pipeline
        </CardTitle>
        <CardDescription className="text-xs">
          As perdas são atribuídas à última etapa antes da marcação como perdida.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Não há perdas no período para detalhar por etapa.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Etapa</th>
                    <th className="text-right font-medium py-2 px-2">Perdas</th>
                    <th className="text-right font-medium py-2 px-2">Valor Perdido</th>
                    <th className="text-right font-medium py-2 px-2">Ticket Médio</th>
                    <th className="text-right font-medium py-2 px-2">Ciclo Médio</th>
                    <th className="text-left font-medium py-2 pl-3">Principal Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.stageId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{r.stageName}</span>
                          {r.fallbackCount > 0 && r.fallbackCount === r.count && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                              etapa atual
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-red-700 dark:text-red-400 font-medium">
                        {fmtBRL(r.lostValue)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtBRL(r.avgTicket)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {r.avgCycle > 0 ? `${r.avgCycle}d` : '—'}
                      </td>
                      <td className="py-2 pl-3 text-xs text-muted-foreground truncate max-w-[220px]">
                        {r.topReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fallbackRatio >= 30 && (
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                {fallbackRatio}% das perdas não possuem histórico de etapa — usando etapa atual como fallback.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
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
  // CRM Trust Score calculado pelo motor determinístico WL-LOSS-04 (SSoT oficial).
  crmTrustScore?: number,
): string[] {
  const out: string[] = [];

  if (commercialFailure?.commercialCount && commercialFailure.pctOfLostValue >= 25) {
    out.push(`Falha comercial representa ${commercialFailure.pctOfLostValue}% do valor perdido — promover review semanal de pipeline ativo.`);
  }

  const topByValue = [...categories].sort((a, b) => (b.lostValue ?? 0) - (a.lostValue ?? 0))[0];
  if (topByValue) {
    const topMap: Record<string, string> = {
      timing: 'Criar alerta de cadência para oportunidades sem interação há mais de 7 dias.',
      no_fit: 'Refinar ICP e qualificação no topo do funil para reduzir deals fora do perfil.',
      internal: 'Auditar propostas com erro interno antes do envio (checklist de pré-envio).',
      sales_process: 'Reforçar treinamento de processo comercial e SLA de follow-up.',
      operational: 'Acionar CS/Operações para reduzir atritos pós-venda mencionados pelo cliente.',
    };
    const action = topMap[topByValue.category];
    if (action && !out.some((o) => o === action)) {
      out.push(action);
    }
  }

  const top3 = categories.slice(0, 3).map((c) => c.category);
  if (top3.includes('competition')) {
    out.push('Reforçar battlecards para os concorrentes que mais aparecem nas perdas.');
  }

  if (top3.includes('price')) {
    out.push('Revisar política de desconto e faixas aprovadas — Preço / Valor está entre os principais motivos.');
  }

  // 5. Trust score baixo — usa SSoT determinístico (WL-LOSS-04), fallback no legado semântico.
  const trust = crmTrustScore ?? (semantic && semantic.total > 0 ? semantic.crmTrustScore : undefined);
  if (trust !== undefined && trust < 60) {
    out.push('Tornar obrigatório o preenchimento de diagnóstico de perda — CRM Trust Score abaixo do ideal.');
  }

  return out.slice(0, 5);
}
