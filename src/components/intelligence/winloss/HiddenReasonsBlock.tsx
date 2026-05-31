import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EyeOff, ArrowRight } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const label = (c: string) => LOSS_CATEGORY_LABELS[c] || c;

interface Props {
  semantic: LossSemanticAggregates | undefined;
}

export function HiddenReasonsBlock({ semantic }: Props) {
  if (!semantic || semantic.total === 0) return null;
  const declared = semantic.declaredRanking.slice(0, 5);
  const inferred = semantic.inferredRanking.slice(0, 5);
  if (declared.length === 0 && inferred.length === 0) return null;

  // detecta principal divergência
  const topDeclared = declared[0]?.category;
  const topInferred = inferred[0]?.category;
  const hasDivergence = topDeclared && topInferred && topDeclared !== topInferred;

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Motivos Ocultos</h3>
          </div>
          {hasDivergence ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-600 border-amber-500/30">
              Divergência detectada
            </Badge>
          ) : null}
        </div>

        {hasDivergence ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            O CRM aponta <span className="font-medium">{label(topDeclared)}</span> como principal motivo, mas a IA identificou <span className="font-medium">{label(topInferred)}</span> como causa real dominante. Confira abaixo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Motivos declarados e inferidos pela IA estão alinhados.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Declarado pelo time</h4>
            <ul className="space-y-1">
              {declared.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sem dados.</li>
              ) : declared.map((d) => (
                <li key={d.category} className="flex items-center justify-between text-xs">
                  <span>{label(d.category)}</span>
                  <span className="text-muted-foreground">{d.pct}% · {fmtBRL(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Inferido pela IA
            </h4>
            <ul className="space-y-1">
              {inferred.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sem dados.</li>
              ) : inferred.map((d) => (
                <li key={d.category} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{label(d.category)}</span>
                  <span className="text-muted-foreground">{d.pct}% · {fmtBRL(d.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
