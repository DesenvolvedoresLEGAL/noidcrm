import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TeamKPIs } from '@/hooks/useTeamDashboard';
import { Users, DollarSign, TrendingUp, CheckCircle, Target, Activity } from 'lucide-react';
import { formatCurrencyFull } from '@/lib/i18n';

interface TeamKPIsCardProps {
  kpis: TeamKPIs;
}

export function TeamKPIsCard({ kpis }: TeamKPIsCardProps) {

  const metrics = [
    {
      label: 'Membros',
      value: kpis.total_members,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Oportunidades',
      value: kpis.total_opportunities,
      icon: Target,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Pipeline',
      value: formatCurrencyFull(kpis.total_pipeline_value),
      icon: DollarSign,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Valor Ganho',
      value: formatCurrencyFull(kpis.total_won_value),
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Taxa Conversão',
      value: `${kpis.avg_conversion_rate.toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      label: 'Atividades Pendentes',
      value: kpis.total_activities_pending,
      icon: Activity,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="hover:shadow-card-hover transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
                <p className="text-lg font-bold truncate">{metric.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
