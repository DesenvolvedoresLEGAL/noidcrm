import { useOptimizationImpact } from '@/hooks/optimization/useOptimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Undo2, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export function ImpactSummaryCard() {
  const { data, isLoading } = useOptimizationImpact();

  const items = [
    { label: 'Aplicadas (7d)', value: data?.applied_last_7d ?? 0, icon: CheckCircle2, accent: 'text-emerald-600' },
    { label: 'Impacto estimado', value: (data?.impact_estimate_sum ?? 0).toFixed(1), icon: TrendingUp, accent: 'text-primary' },
    { label: 'Pendentes', value: data?.pending_count ?? 0, icon: Clock, accent: 'text-amber-600' },
    { label: 'Revertidas (7d)', value: data?.rolled_back_last_7d ?? 0, icon: Undo2, accent: 'text-muted-foreground' },
    { label: 'Falhas (7d)', value: data?.failed_last_7d ?? 0, icon: AlertCircle, accent: 'text-red-600' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impacto da otimização</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {items.map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={it.label} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className={`h-3.5 w-3.5 ${it.accent}`} /> {it.label}
                  </div>
                  <div className="text-2xl font-semibold">{it.value}</div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Métricas dos últimos 7 dias. Impacto estimado é a soma do campo de impacto das recomendações aplicadas.
        </p>
      </CardContent>
    </Card>
  );
}
