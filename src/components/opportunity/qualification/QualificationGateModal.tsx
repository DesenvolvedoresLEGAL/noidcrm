import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import {
  useActiveQualificationFramework,
  useQualificationFrameworkBundle,
} from '@/hooks/useQualificationFramework';
import type { QualificationScoreResult } from '@/lib/qualification/qualificationScore';
import { getQualificationRecommendation } from '@/lib/qualification/qualificationRecommendation';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full score result (preferred). Falls back to legacy `score` + `blockers`. */
  result?: QualificationScoreResult;
  /** @deprecated use `result.total` */
  score?: number;
  /** @deprecated use `result.blockers` */
  blockers?: string[];
}

export function QualificationGateModal({
  open,
  onOpenChange,
  result,
  score,
  blockers,
}: Props) {
  const { data: activeFw } = useActiveQualificationFramework();
  const { data: bundle } = useQualificationFrameworkBundle(activeFw?.id);

  // Effective values — full result takes precedence; legacy props are fallback.
  const effectiveScore = result?.total ?? score ?? 0;
  const effectiveBlockers = result?.blockers ?? blockers ?? [];
  const classification = result?.classification;
  const breakdown = result?.breakdown ?? [];

  // Pull the minimum score and messaging from the active framework when present.
  // Defaults preserve historical LEGAL behaviour as a safe fallback.
  const minScore = activeFw?.minimum_score_to_advance ?? 75;
  const frameworkName = activeFw?.name ?? 'régua de qualificação';
  const blockingRule = bundle?.blockingRules?.find(
    (r) => r.action_key === 'move_to_sales' && r.is_active
  );
  const titleText = blockingRule?.block_message_title
    ?? 'Lead ainda não pode ir para Vendas';
  const bodyText = blockingRule?.block_message_body
    ?? `Este lead ainda não atingiu a régua mínima da ${frameworkName}. Para passar para Vendas, ele precisa ter score mínimo de ${minScore} pontos e checklist obrigatório completo.`;

  const scoreBelow = effectiveScore < minScore;

  // Compute recommendation when we have the full result; harmless no-op otherwise.
  const recommendation = result ? getQualificationRecommendation(result) : null;

  // Pending criteria = breakdown items that haven't reached their max points.
  const pendingCriteria = breakdown.filter((b) => b.got < b.max);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{bodyText}</p>

          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Score atual
              </span>
              <span
                className={
                  scoreBelow
                    ? 'text-sm font-bold text-amber-600 dark:text-amber-400'
                    : 'text-sm font-bold text-emerald-600 dark:text-emerald-400'
                }
              >
                {effectiveScore}/100
              </span>
            </div>

            {classification && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Classificação
                </span>
                <Badge variant="outline" className={classification.colorClass}>
                  {classification.label}
                </Badge>
              </div>
            )}

            {pendingCriteria.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  Critérios pendentes
                </p>
                <ul className="space-y-1">
                  {pendingCriteria.map((c) => (
                    <li
                      key={c.key}
                      className="text-xs text-foreground/90 flex items-start justify-between gap-2"
                    >
                      <span className="flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{c.label}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {c.got}/{c.max}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {effectiveBlockers.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  Campos pendentes
                </p>
                <ul className="space-y-1">
                  {effectiveBlockers.map((b) => (
                    <li
                      key={b}
                      className="text-xs text-foreground/90 flex items-start gap-1.5"
                    >
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {recommendation && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex gap-2">
              <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {recommendation.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {recommendation.description}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Voltar para qualificação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
