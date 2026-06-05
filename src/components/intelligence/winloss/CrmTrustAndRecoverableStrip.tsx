// Sprint WL-UI-02 — Strip executivo: CRM Trust + Receita Recuperável + Perda por Falha Comercial.
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Recycle, Sparkles } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';
import { SHORT_RECOMMENDATIONS, type CommercialFailureSummary } from '@/lib/winloss/diagnosis';
import { CommercialFailureCard } from './CommercialFailureCard';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface Props {
  semantic: LossSemanticAggregates | undefined;
  commercialFailure?: CommercialFailureSummary;
  isLoading?: boolean;
  /** SSoT CRM Trust Score (motor determinístico WL-LOSS-04). Sobrescreve o legado de loss_semantic_analyses. */
  crmTrustScore?: number;
}

export function CrmTrustAndRecoverableStrip({ semantic, commercialFailure, isLoading, crmTrustScore }: Props) {
  if (isLoading || !semantic || semantic.total === 0) return null;

  // CRM Trust Score calculado pelo motor determinístico WL-LOSS-04.
  const trust = crmTrustScore ?? semantic.crmTrustScore;
  const trustTone =
    trust >= 80 ? 'text-emerald-600' : trust >= 60 ? 'text-yellow-600' : 'text-red-600';
  const trustBadge =
    trust >= 80 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' :
    trust >= 60 ? 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' :
                  'bg-red-500/15 text-red-600 border-red-500/30';

  const causeLabel = semantic.recoverableTopCause
    ? LOSS_CATEGORY_LABELS[semantic.recoverableTopCause] || semantic.recoverableTopCause
    : null;
  const recoverableAction = semantic.recoverableTopCause
    ? SHORT_RECOMMENDATIONS[semantic.recoverableTopCause] || SHORT_RECOMMENDATIONS.other
    : null;

  return (
    <div className="grid lg:grid-cols-3 sm:grid-cols-2 gap-3">
      {/* CRM Trust Score */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-semibold">CRM Trust Score</h4>
            </div>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${trustBadge}`}>
              {trust >= 80 ? 'Confiável' : trust >= 60 ? 'Atenção' : 'Frágil'}
            </Badge>
          </div>
          <div className={`text-3xl font-bold ${trustTone}`}>{trust}<span className="text-base text-muted-foreground"> /100</span></div>
          <Progress value={trust} className="h-1.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {semantic.qualityBuckets.weak + semantic.qualityBuckets.missing > 0
              ? `${Math.round(((semantic.qualityBuckets.weak + semantic.qualityBuckets.missing) / semantic.total) * 100)}% das perdas com diagnóstico inconsistente ou fraco. `
              : ''}
            Qualidade média {semantic.avgQuality}/100 · Gap {semantic.gapPct}% · Cobertura {semantic.coveragePct}%.
          </p>
        </CardContent>
      </Card>

      {/* Receita Recuperável — estado vazio inteligente quando 0 */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-emerald-500" />
            <h4 className="text-sm font-semibold">Receita Recuperável</h4>
          </div>

          {semantic.recoverableRevenue > 0 ? (
            <>
              <div className="text-3xl font-bold text-emerald-600">{fmtBRL(semantic.recoverableRevenue)}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {semantic.recoverableCount} {semantic.recoverableCount > 1 ? 'oportunidades recuperáveis' : 'oportunidade recuperável'}.
                {causeLabel && (
                  <> Principal causa: <span className="font-medium text-foreground">{causeLabel}</span>.</>
                )}
                {recoverableAction && (
                  <> Ação: <span className="font-medium text-foreground">{recoverableAction}</span></>
                )}
              </p>
            </>
          ) : (
            <div className="flex items-start gap-2 pt-1">
              <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nenhuma receita recuperável marcada no período.
                <br />
                <span className="text-foreground/80">Sugestão:</span> revise perdas com motivo Timing, Preço ou Concorrência para identificar oportunidades de reativação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perda por Falha Comercial */}
      <CommercialFailureCard summary={commercialFailure} />
    </div>
  );
}
