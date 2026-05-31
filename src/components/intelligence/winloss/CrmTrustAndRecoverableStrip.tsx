import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Recycle } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';
import { RECOMMENDATIONS } from '@/lib/winloss/diagnosis';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface Props {
  semantic: LossSemanticAggregates | undefined;
  isLoading?: boolean;
}

export function CrmTrustAndRecoverableStrip({ semantic, isLoading }: Props) {
  if (isLoading || !semantic || semantic.total === 0) return null;

  const trust = semantic.crmTrustScore;
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
    ? RECOMMENDATIONS[semantic.recoverableTopCause] || RECOMMENDATIONS.other
    : null;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
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

      <Card>
        <CardContent className="pt-4 pb-4 space-y-2">
          <div className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-emerald-500" />
            <h4 className="text-sm font-semibold">Receita Recuperável</h4>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{fmtBRL(semantic.recoverableRevenue)}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {semantic.recoverableCount > 0 ? (
              <>
                {semantic.recoverableCount} oportunidade{semantic.recoverableCount > 1 ? 's' : ''} recuperáve{semantic.recoverableCount > 1 ? 'is' : 'l'} detectada{semantic.recoverableCount > 1 ? 's' : ''}.
                {causeLabel ? <> Principal causa: <span className="font-medium">{causeLabel}</span>.</> : null}
                {recoverableAction ? <> {recoverableAction}</> : null}
              </>
            ) : (
              <>Nenhuma oportunidade marcada como recuperável no período.</>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
