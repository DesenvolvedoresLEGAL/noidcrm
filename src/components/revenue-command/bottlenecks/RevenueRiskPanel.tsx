import { ShieldAlert, Timer, Gauge } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RevenueSectionCard } from '../RevenueSectionCard';
import type {
  RevenueRiskItem,
  SpeedMetric,
} from '@/hooks/revenue-command/useRevenueBottlenecks';

function fmtBRL(v: number) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function RevenueRiskPanel({
  risks,
  speedMetrics,
  loading,
}: {
  risks: RevenueRiskItem[];
  speedMetrics: SpeedMetric[];
  loading?: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RevenueSectionCard
        title="Receita em risco"
        description="Quanto dinheiro está parado no funil."
        icon={ShieldAlert}
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            {risks.map((r) => (
              <Card key={r.id} className="border-dashed">
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-sm font-medium">{r.label}</p>
                    {r.helper && (
                      <p className="text-xs text-muted-foreground">{r.helper}</p>
                    )}
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {r.available ? fmtBRL(r.value) : '—'}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </RevenueSectionCard>

      <RevenueSectionCard
        title="Gargalos de velocidade"
        description="Tempo médio entre etapas críticas."
        icon={Timer}
      >
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {speedMetrics.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{m.label}</p>
                  {m.helper && (
                    <p className="text-xs text-muted-foreground">{m.helper}</p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {!m.available
                    ? '—'
                    : m.days != null
                      ? `${m.days.toFixed(1)} d`
                      : m.hours != null
                        ? `${m.hours.toFixed(0)} h`
                        : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-2 text-[11px] text-muted-foreground">
          <Gauge className="mr-1 inline h-3 w-3" />
          Métricas de entrega e liquidação serão habilitadas em sprint futura.
        </p>
      </RevenueSectionCard>
    </div>
  );
}
