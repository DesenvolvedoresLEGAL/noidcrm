import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, AlertTriangle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UseQualificationScoreReturn } from '@/hooks/useOpportunityQualificationScore';

interface Props {
  score: UseQualificationScoreReturn;
  /** When true, shows the "Faltam X itens" warning ribbon. */
  showHandoffHint?: boolean;
}

export function QualificationScoreCard({ score, showHandoffHint = true }: Props) {
  const [open, setOpen] = useState(false);

  if (score.isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 animate-pulse rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  const pct = Math.max(0, Math.min(100, score.total));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                Score de Qualificação
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

        {showHandoffHint && !score.canMoveToSales && score.blockers.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Faltam {score.blockers.length} item(ns) e/ou score mínimo para
              liberar Vendas.
            </span>
          </div>
        )}

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
            Detalhamento
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
