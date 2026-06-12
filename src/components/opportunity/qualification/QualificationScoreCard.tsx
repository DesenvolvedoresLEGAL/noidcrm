import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Target,
  Lightbulb,
  ShieldCheck,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseQualificationScoreReturn } from '@/hooks/useOpportunityQualificationScore';
import { getQualificationRecommendation } from '@/lib/qualification/qualificationRecommendation';

interface Props {
  score: UseQualificationScoreReturn;
  /** Reserved for backwards compat; the new card always surfaces status. */
  showHandoffHint?: boolean;
}

export function QualificationScoreCard({ score }: Props) {
  const [open, setOpen] = useState(false);

  if (score.isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-32 animate-pulse rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  const pct = Math.max(0, Math.min(100, score.total));
  const completed = useMemo(
    () => score.breakdown.filter((b) => b.got === b.max && b.max > 0),
    [score.breakdown]
  );
  const pendingFields = score.blockers;
  const recommendation = useMemo(
    () => getQualificationRecommendation(score),
    [score]
  );
  const canMove = score.canMoveToSales;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                Qualificação Comercial
              </h3>
              <p className="text-xs text-muted-foreground">
                Baseado no Checklist Obrigatório
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-2xl font-bold leading-none tabular-nums">
                {score.total}
                <span className="text-sm font-normal text-muted-foreground">
                  /100
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn('text-[11px] border', score.classification.colorClass)}
            >
              {score.classification.label}
            </Badge>
          </div>
        </div>

        <Progress value={pct} className="h-2" />

        {/* Status */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium',
            canMove
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
          )}
        >
          {canMove ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Ban className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            Status:{' '}
            {canMove ? 'Pronto para Vendas' : 'Não pode ir para Vendas'}
          </span>
        </div>

        {/* Completos / Pendentes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Completos ({completed.length})</span>
            </div>
            {completed.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum critério completo ainda.</p>
            ) : (
              <ul className="space-y-1">
                {completed.map((c) => (
                  <li key={c.key} className="text-xs flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Pendentes ({pendingFields.length})</span>
            </div>
            {pendingFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Checklist completo.</p>
            ) : (
              <ul className="space-y-1">
                {pendingFields.map((p) => (
                  <li key={p} className="text-xs flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate">{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recomendação */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Ação recomendada
              </p>
              <p className="text-xs font-medium text-foreground mt-0.5">
                {recommendation.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {recommendation.description}
              </p>
            </div>
          </div>
        </div>

        {/* Detalhamento (collapse) */}
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setOpen((s) => !s)}
          >
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Ver pontuação detalhada
          </Button>

          {open && (
            <ul className="mt-2 space-y-1.5">
              {score.breakdown.map((b) => {
                const ratio = b.max > 0 ? b.got / b.max : 0;
                return (
                  <li
                    key={b.key}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-muted-foreground">
                      {b.label}
                    </span>
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        ratio >= 1
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : ratio > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {b.got}/{b.max}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
