import { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, AlertCircle, Flame } from 'lucide-react';
import { InsightCard } from './InsightCard';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getPredictiveAnalysis, PredictiveData } from '@/services/crm/insights';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export function PredictiveAnalysis() {
  const [data, setData] = useState<PredictiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPredictiveAnalysis().then(result => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? 'text-green-500' : data.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <InsightCard
      title="Análise Preditiva do Funil"
      description="Probabilidade baseada em IA e histórico"
      icon={Brain}
      iconColor="text-purple-500"
    >
      <div className="space-y-6">
        {/* Main Probability */}
        <div className="text-center p-6 rounded-lg bg-gradient-to-br from-purple-500/10 to-blue-500/10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <span className="text-sm font-medium text-muted-foreground">
              Chance de Bater Meta
            </span>
          </div>
          <div className="text-5xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            {data.goalAchievementProbability}%
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={data.goalAchievementProbability} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Baixa</span>
            <span>Alta</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-500">Em Risco</span>
            </div>
            <div className="text-2xl font-bold">{data.opportunitiesAtRisk}</div>
            <div className="text-xs text-muted-foreground">oportunidades</div>
          </div>

          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-500">Quentes</span>
            </div>
            <div className="text-2xl font-bold">{data.hotOpportunities}</div>
            <div className="text-xs text-muted-foreground">oportunidades</div>
          </div>
        </div>

        {/* Suggested Actions */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            Ações Recomendadas pela IA
          </h4>
          <ul className="space-y-2">
            {data.suggestedActions.map((action, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <Badge variant="outline" className="mt-0.5">
                  {idx + 1}
                </Badge>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </InsightCard>
  );
}
