import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows } from 'lucide-react';
import { LOSS_CATEGORY_LABELS } from '@/utils/category-labels';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const label = (c: string) => LOSS_CATEGORY_LABELS[c] || c;

interface Props {
  semantic: LossSemanticAggregates | undefined;
}

export function SellerCustomerGapBlock({ semantic }: Props) {
  if (!semantic || semantic.total === 0) return null;
  const gapCount = Math.round((semantic.gapPct * semantic.total) / 100);
  if (gapCount === 0 && semantic.topGapPairs.length === 0) return null;
  const totalValue = semantic.topGapPairs.reduce((s, p) => s + p.value, 0);

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Gap Vendedor × Cliente</h3>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-600 border-amber-500/30">
            {semantic.gapPct}% com divergência
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {gapCount} perda{gapCount > 1 ? 's' : ''} com divergência entre motivo informado e motivo real provável
          {totalValue > 0 ? <> · {fmtBRL(totalValue)} associados</> : null}.
        </p>

        {semantic.topGapPairs.length > 0 ? (
          <ul className="space-y-1.5">
            {semantic.topGapPairs.map((p, i) => (
              <li key={i} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate">
                  <span className="text-muted-foreground">{label(p.declared)}</span>
                  <span className="text-amber-500 mx-1.5">→</span>
                  <span className="font-medium">{label(p.inferred)}</span>
                </span>
                <span className="text-muted-foreground whitespace-nowrap">{p.count} · {fmtBRL(p.value)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
