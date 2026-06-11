import { useAutopilotKpis } from '@/hooks/intelligence/useAutopilot';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, CheckCircle2, Users, Sparkles, Coins, TrendingUp } from 'lucide-react';

export function AutopilotKpiBar() {
  const { data, isLoading } = useAutopilotKpis();
  const items = [
    { label: 'Execuções', value: data?.total_runs ?? 0, icon: Play },
    { label: 'Em execução', value: data?.running ?? 0, icon: Sparkles, accent: 'text-blue-600' },
    { label: 'Prospects processados', value: data?.total_processed ?? 0, icon: Users },
    { label: 'SDR Ready', value: data?.total_sdr_ready ?? 0, icon: CheckCircle2, accent: 'text-emerald-600' },
    { label: 'Créditos usados', value: data?.total_credits_used ?? 0, icon: Coins },
    { label: 'Aproveitamento', value: `${data?.avg_yield ?? 0}%`, icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{it.label}</p>
            <it.icon className={`h-4 w-4 ${it.accent ?? 'text-muted-foreground'}`} />
          </div>
          {isLoading ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold mt-1">{it.value}</p>}
        </Card>
      ))}
    </div>
  );
}
