import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CloserRiskDeal } from '@/types/dashboard/closer';

function formatBRL(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}

export function CloserRiskDealsList({ deals }: { deals: CloserRiskDeal[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Deals em risco</CardTitle>
        <p className="text-xs text-muted-foreground">Oportunidades que podem escapar se ninguém agir.</p>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum deal em risco no momento.</p>
        ) : (
          <ul className="divide-y">
            {deals.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.nome_fantasia ?? d.razao_social ?? '—'} · {d.stage_name ?? '—'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatBRL(d.valor_previsto)}</p>
                  <Badge variant="outline" className="text-xs">{d.risk_reason}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
