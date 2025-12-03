import { Card, CardContent } from '@/components/ui/card';
import { Target, Flame, Star, Trophy } from 'lucide-react';
import { useRoleplayStats } from '@/hooks/useRoleplayStats';

interface SalesCoachKPIsProps {
  sellerId: string;
  stats: {
    totalSessions: number;
    averageScore: number;
    passRate: number;
  };
}

export function SalesCoachKPIs({ sellerId, stats }: SalesCoachKPIsProps) {
  const { todayTrainings, currentStreak, overallAverage } = useRoleplayStats(sellerId);

  const kpis = [
    {
      icon: Target,
      label: 'Treinos Hoje',
      value: todayTrainings,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      icon: Flame,
      label: 'Dias de Streak',
      value: currentStreak,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: Star,
      label: 'Média Geral',
      value: overallAverage?.toFixed(1) || stats.averageScore?.toFixed(1) || '-',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: Trophy,
      label: 'Taxa de Aprovação',
      value: `${stats.passRate?.toFixed(0) || 0}%`,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${kpi.bgColor}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
