import { ArrowRight, Frown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type { LossReasonItem } from '@/hooks/revenue-command/useRevenueBottlenecks';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function LossReasonsRanking({
  reasons,
  loading,
}: {
  reasons: LossReasonItem[];
  loading?: boolean;
}) {
  return (
    <RevenueSectionCard
      title="Motivos de perda (Top 10)"
      description="Por que o cliente disse não (fonte: Win/Loss)."
      icon={Frown}
      actions={
        <Link
          to="/app/intelligence/winloss"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir Win/Loss <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : reasons.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum motivo de perda registrado no período.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-left font-medium">Motivo</th>
              <th className="py-2 text-right font-medium">Qtd</th>
              <th className="py-2 text-right font-medium">%</th>
              <th className="py-2 text-right font-medium">Receita perdida</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.reason} className="border-b last:border-0">
                <td className="py-2">{r.reason}</td>
                <td className="py-2 text-right tabular-nums">{r.count}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {r.pct.toFixed(0)}%
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {r.lostValue > 0 ? fmtBRL(r.lostValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RevenueSectionCard>
  );
}
