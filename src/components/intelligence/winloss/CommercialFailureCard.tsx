// Sprint WL-UI-02 — Card compacto: receita perdida por falha comercial/processual.
// Mapeamento local (frontend) — categorias: timing, sales_process, internal, operational.
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertOctagon } from 'lucide-react';
import type { CommercialFailureSummary } from '@/lib/winloss/diagnosis';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface Props {
  summary: CommercialFailureSummary | undefined;
}

export function CommercialFailureCard({ summary }: Props) {
  if (!summary || !summary.available) return null;

  const tone =
    summary.pctOfLostValue >= 50
      ? 'text-red-600'
      : summary.pctOfLostValue >= 30
        ? 'text-amber-600'
        : 'text-foreground';

  const pctBadge =
    summary.pctOfLostValue >= 50
      ? 'bg-red-500/15 text-red-600 border-red-500/30'
      : summary.pctOfLostValue >= 30
        ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-500" />
            <h4 className="text-sm font-semibold">Perda por Falha Comercial</h4>
          </div>
          {summary.commercialCount > 0 && (
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${pctBadge}`}>
              {summary.pctOfLostValue}% do perdido
            </Badge>
          )}
        </div>

        {summary.commercialCount === 0 ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nenhuma perda atribuída a falha comercial no período. As perdas registradas têm causas externas (preço, fit, concorrência).
          </p>
        ) : (
          <>
            <div className={`text-3xl font-bold ${tone}`}>{fmtBRL(summary.commercialLostValue)}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {summary.commercialCount} {summary.commercialCount === 1 ? 'deal perdido' : 'deals perdidos'} por causa interna.
              {summary.topCategoryLabel && (
                <>
                  {' '}Principal causa: <span className="font-medium text-foreground">{summary.topCategoryLabel}</span>.
                </>
              )}
              {summary.topAction && (
                <>
                  {' '}Ação: <span className="font-medium text-foreground">{summary.topAction}</span>
                </>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
