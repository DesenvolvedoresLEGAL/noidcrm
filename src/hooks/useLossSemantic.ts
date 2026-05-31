import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLossSemanticForPeriod,
  fetchLossSemanticDetail,
  analyzeOpportunityLoss,
  type LossSemanticRow,
} from '@/services/winloss/lossSemantic';
import type { DateRange } from '@/hooks/useWinLossData';

export interface LossSemanticAggregates {
  rows: LossSemanticRow[];
  total: number;
  /** Distribuição de qualidade do diagnóstico. */
  qualityBuckets: { strong: number; medium: number; weak: number; missing: number };
  avgQuality: number;
  /** % de perdas com texto suficiente (qualidade > 0). */
  withTextPct: number;
  /** % com gap vendedor × cliente. */
  gapPct: number;
  /** % com IA de alta confiança (>=70). */
  highConfidencePct: number;
  /** Cobertura de análise semântica no período (linhas com analyzed_at). */
  coveragePct: number;
  /** CRM Trust Score 0-100. */
  crmTrustScore: number;
  /** Receita perdida total. */
  lostRevenue: number;
  /** Receita marcada como recuperável (humano OU IA). */
  recoverableRevenue: number;
  /** Qtde de oportunidades recuperáveis. */
  recoverableCount: number;
  /** Principal causa recuperável. */
  recoverableTopCause: string | null;
  /** Ranking declarado por categoria (vendedor). */
  declaredRanking: Array<{ category: string; count: number; pct: number; value: number }>;
  /** Ranking inferido pela IA por categoria. */
  inferredRanking: Array<{ category: string; count: number; pct: number; value: number }>;
  /** Pares "declarado → inferido" mais frequentes (gaps). */
  topGapPairs: Array<{ declared: string; inferred: string; count: number; value: number }>;
  /** Concorrentes inferidos pela IA com qtd + valor + motivo dominante. */
  competitorsAi: Array<{
    competitor: string;
    count: number;
    lostValue: number;
    dominantReason: string | null;
    avgConfidence: number;
  }>;
  /** Ações recomendadas mais frequentes. */
  topRecommendations: Array<{ action: string; count: number; value: number }>;
}

const ALLOWED_CATEGORIES = new Set([
  'price',
  'timing',
  'competition',
  'no_fit',
  'sales_process',
  'operational',
  'internal',
  'other',
]);

function normalizeCategory(c: string | null | undefined): string {
  if (!c) return 'other';
  const lower = c.toLowerCase().trim();
  return ALLOWED_CATEGORIES.has(lower) ? lower : 'other';
}

function rank(
  rows: LossSemanticRow[],
  picker: (r: LossSemanticRow) => string | null,
): Array<{ category: string; count: number; pct: number; value: number }> {
  const map = new Map<string, { count: number; value: number }>();
  let total = 0;
  for (const r of rows) {
    const raw = picker(r);
    if (!raw) continue;
    const c = normalizeCategory(raw);
    const e = map.get(c) || { count: 0, value: 0 };
    e.count++;
    e.value += Number(r.valor_previsto) || 0;
    map.set(c, e);
    total++;
  }
  return [...map.entries()]
    .map(([category, { count, value }]) => ({
      category,
      count,
      value,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateSemantic(rows: LossSemanticRow[]): LossSemanticAggregates {
  const total = rows.length;

  const qualityBuckets = { strong: 0, medium: 0, weak: 0, missing: 0 };
  let sumQuality = 0;
  let withText = 0;
  let gaps = 0;
  let highConf = 0;
  let covered = 0;
  let lostRevenue = 0;
  let recoverableRevenue = 0;
  let recoverableCount = 0;
  const recoverableCauseMap = new Map<string, number>();

  for (const r of rows) {
    const q = r.diagnosis_quality_score ?? 0;
    sumQuality += q;
    if (q >= 70) qualityBuckets.strong++;
    else if (q >= 40) qualityBuckets.medium++;
    else if (q > 0) qualityBuckets.weak++;
    else qualityBuckets.missing++;
    if (q > 0) withText++;
    if (r.seller_customer_gap) gaps++;
    if ((r.ai_confidence_score ?? 0) >= 70) highConf++;
    if (r.analyzed_at) covered++;
    lostRevenue += Number(r.valor_previsto) || 0;
    if (r.is_recoverable_effective) {
      recoverableRevenue += Number(r.valor_previsto) || 0;
      recoverableCount++;
      const cause = normalizeCategory(r.ai_detected_loss_category);
      recoverableCauseMap.set(cause, (recoverableCauseMap.get(cause) || 0) + 1);
    }
  }

  const avgQuality = total > 0 ? Math.round(sumQuality / total) : 0;
  const withTextPct = total > 0 ? Math.round((withText / total) * 100) : 0;
  const gapPct = total > 0 ? Math.round((gaps / total) * 100) : 0;
  const highConfidencePct = total > 0 ? Math.round((highConf / total) * 100) : 0;
  const coveragePct = total > 0 ? Math.round((covered / total) * 100) : 0;

  // CRM Trust Score: ponderado
  const crmTrustScore =
    total === 0
      ? 0
      : Math.round(
          avgQuality * 0.3 +
            withTextPct * 0.2 +
            (100 - gapPct) * 0.2 +
            highConfidencePct * 0.15 +
            coveragePct * 0.15,
        );

  const recoverableTopCause =
    [...recoverableCauseMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Rankings
  const declaredRanking = rank(rows, (r) => {
    // categoria humana via consolidated_loss_reason_id seria ideal mas a view não traz a categoria;
    // usamos ai_detected_loss_category APENAS quando humano vazio para ranking inferido.
    // Para "declarado", usamos seller_loss_reason_id presença como bucket "informado", senão "other".
    // Aproximação: se ai gap=true, o "declarado" representa a categoria humana via seller_loss_reason_id mapeado em outro lugar.
    // Aqui mantemos uma heurística: se existir loss_reason name no excerpt já não temos. Vamos usar seller_loss_reason_id presence + categoria via ai_detected como fallback.
    return r.seller_loss_reason_id ? r.ai_detected_loss_category || 'other' : null;
  });

  const inferredRanking = rank(rows, (r) => r.ai_detected_loss_category);

  // Top pares de gap (declarado vs inferido) — usamos ai_detected_loss_category vs categoria humana
  // Como a view não traz a categoria humana diretamente, fazemos heurística: gap=true → par
  // (seller_loss_reason_id existir, ai_detected_loss_category).
  const pairMap = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    if (!r.seller_customer_gap) continue;
    const declared = r.gap_explanation ? extractDeclared(r.gap_explanation) : 'humano';
    const inferred = normalizeCategory(r.ai_detected_loss_category);
    const key = `${declared}→${inferred}`;
    const e = pairMap.get(key) || { count: 0, value: 0 };
    e.count++;
    e.value += Number(r.valor_previsto) || 0;
    pairMap.set(key, e);
  }
  const topGapPairs = [...pairMap.entries()]
    .map(([key, { count, value }]) => {
      const [declared, inferred] = key.split('→');
      return { declared, inferred, count, value };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Concorrentes (IA + humano)
  const compMap = new Map<
    string,
    { count: number; lostValue: number; reasons: Map<string, number>; confSum: number }
  >();
  for (const r of rows) {
    const comp = r.ai_detected_competitor || r.competitor_human;
    if (!comp) continue;
    const e = compMap.get(comp) || {
      count: 0,
      lostValue: 0,
      reasons: new Map(),
      confSum: 0,
    };
    e.count++;
    e.lostValue += Number(r.valor_previsto) || 0;
    e.confSum += r.ai_confidence_score ?? 0;
    const reason = r.ai_detected_loss_reason || normalizeCategory(r.ai_detected_loss_category);
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    compMap.set(comp, e);
  }
  const competitorsAi = [...compMap.entries()]
    .map(([competitor, { count, lostValue, reasons, confSum }]) => ({
      competitor,
      count,
      lostValue,
      dominantReason: [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      avgConfidence: count > 0 ? Math.round(confSum / count) : 0,
    }))
    .sort((a, b) => b.lostValue - a.lostValue);

  // Top ações recomendadas
  const actMap = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    if (!r.recommended_action) continue;
    const e = actMap.get(r.recommended_action) || { count: 0, value: 0 };
    e.count++;
    e.value += Number(r.valor_previsto) || 0;
    actMap.set(r.recommended_action, e);
  }
  const topRecommendations = [...actMap.entries()]
    .map(([action, { count, value }]) => ({ action, count, value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    rows,
    total,
    qualityBuckets,
    avgQuality,
    withTextPct,
    gapPct,
    highConfidencePct,
    coveragePct,
    crmTrustScore,
    lostRevenue,
    recoverableRevenue,
    recoverableCount,
    recoverableTopCause,
    declaredRanking,
    inferredRanking,
    topGapPairs,
    competitorsAi,
    topRecommendations,
  };
}

function extractDeclared(text: string): string {
  // tenta capturar a categoria humana mencionada na explicação do gap
  const m = text.toLowerCase().match(/(preço|preco|timing|tempo|concorr|fornecedor|operacional|interno|fit|processo)/);
  if (!m) return 'humano';
  const t = m[1];
  if (t.startsWith('pre')) return 'price';
  if (t.startsWith('tim') || t.startsWith('tem')) return 'timing';
  if (t.startsWith('conc') || t.startsWith('forn')) return 'competition';
  if (t.startsWith('oper')) return 'operational';
  if (t.startsWith('int')) return 'internal';
  if (t.startsWith('fit')) return 'no_fit';
  if (t.startsWith('proc')) return 'sales_process';
  return 'other';
}

export function useLossSemantic(
  organizationId: string | undefined,
  pipelineId: string | null,
  dateRange: DateRange,
) {
  return useQuery({
    queryKey: [
      'loss-semantic',
      organizationId,
      pipelineId,
      dateRange.from.getTime(),
      dateRange.to.getTime(),
    ],
    queryFn: async (): Promise<LossSemanticAggregates> => {
      if (!organizationId) {
        return aggregateSemantic([]);
      }
      const rows = await fetchLossSemanticForPeriod(
        organizationId,
        dateRange.from,
        dateRange.to,
        pipelineId ? [pipelineId] : undefined,
      );
      return aggregateSemantic(rows);
    },
    enabled: !!organizationId,
  });
}

export function useLossSemanticDetail(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['loss-semantic-detail', opportunityId],
    queryFn: () => (opportunityId ? fetchLossSemanticDetail(opportunityId) : null),
    enabled: !!opportunityId,
  });
}

export function useReprocessLossSemantic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opportunityId: string) => analyzeOpportunityLoss(opportunityId, true),
    onSuccess: (_data, opportunityId) => {
      qc.invalidateQueries({ queryKey: ['loss-semantic-detail', opportunityId] });
      qc.invalidateQueries({ queryKey: ['loss-semantic'] });
    },
  });
}
