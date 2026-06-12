import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useApolloKpis } from '@/hooks/intelligence/useApolloInvisible';
import { Zap, UserCheck, Phone, CreditCard, Target, Activity } from 'lucide-react';

export function ApolloKpiBar() {
  const { data, isLoading } = useApolloKpis(30);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const items = [
    { label: 'Avaliadas', value: data.evaluated, icon: Activity },
    { label: 'Executado', value: data.executed, icon: Zap },
    { label: 'Decisores', value: data.decision_makers, icon: UserCheck },
    { label: 'Contatos revelados', value: data.contacts_revealed, icon: Phone },
    { label: 'Créditos usados', value: data.credits_used, icon: CreditCard },
    {
      label: 'Custo / decisor',
      value: data.cost_per_decision_maker ? data.cost_per_decision_maker.toFixed(1) : '—',
      icon: Target,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Apollo Performance · últimos 30d</h3>
        <span className="text-xs text-muted-foreground">
          Aproveitamento: <strong>{data.utilization_rate}%</strong>
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Card key={it.label} className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3 w-3" /> {it.label}
              </div>
              <div className="text-xl font-semibold mt-1">{it.value}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
