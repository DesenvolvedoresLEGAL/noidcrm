import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useHypotheses } from '@/hooks/experiments/useExperiments';
import { FlaskConical, Trophy, Activity, CheckCircle2 } from 'lucide-react';

export function ExperimentImpactSummary() {
  const { data } = useHypotheses();

  const stats = useMemo(() => {
    const list = data ?? [];
    const running = list.filter((h) => h.status === 'running').length;
    const completed = list.filter((h) => h.status === 'completed').length;
    const promoted7d = list.filter((h) => {
      if (h.status !== 'promoted' || !h.promoted_at) return false;
      return Date.now() - new Date(h.promoted_at).getTime() < 7 * 86_400_000;
    }).length;
    const pending = list.filter((h) => h.status === 'pending').length;
    return { running, completed, promoted7d, pending };
  }, [data]);

  const cards = [
    { label: 'Em andamento', value: stats.running, icon: Activity, color: 'text-blue-600' },
    { label: 'Aguardando aprovação', value: stats.pending, icon: FlaskConical, color: 'text-amber-600' },
    { label: 'Vencedores identificados', value: stats.completed, icon: CheckCircle2, color: 'text-violet-600' },
    { label: 'Promovidos (7d)', value: stats.promoted7d, icon: Trophy, color: 'text-emerald-600' },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <c.icon className={`h-5 w-5 ${c.color}`} />
            <div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-semibold">{c.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
