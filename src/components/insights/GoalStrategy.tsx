import { useEffect, useState } from 'react';
import { Target, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Progress } from '@/components/ui/progress';
import { getGoalStrategy, GoalStrategyData } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function GoalStrategy() {
  const [data, setData] = useState<GoalStrategyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGoalStrategy().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const progressPercentage = (data.closedToDate / data.monthGoal) * 100;

  return (
    <InsightCard
      title="Estratégia para Atingir Meta"
      description="Plano de ação personalizado para o mês"
      icon={Target}
      iconColor="text-amber-500"
    >
      <div className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Meta do mês</span>
            <span className="font-semibold">
              R$ {data.monthGoal.toLocaleString('pt-BR')}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progressPercentage.toFixed(0)}% alcançado
            </span>
            <span className={data.onTrack ? 'text-green-500' : 'text-amber-500'}>
              {data.onTrack ? '✓ No caminho certo' : '⚠ Precisa acelerar'}
            </span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              Fechado
            </div>
            <div className="text-2xl font-bold text-green-600">
              R$ {(data.closedToDate / 1000).toFixed(0)}k
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Faltam
            </div>
            <div className="text-2xl font-bold text-amber-600">
              R$ {(data.remaining / 1000).toFixed(0)}k
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Meta diária
            </div>
            <div className="text-2xl font-bold text-primary">
              R$ {(data.dailyGoalNeeded / 1000).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Recomendações
          </h4>
          <ul className="space-y-2">
            {data.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <span className="text-primary font-semibold mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Days Remaining */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Dias úteis restantes</div>
              <div className="text-3xl font-bold text-amber-600">{data.businessDaysLeft}</div>
            </div>
            <Calendar className="h-12 w-12 text-amber-500/30" />
          </div>
        </div>
      </div>
    </InsightCard>
  );
}
