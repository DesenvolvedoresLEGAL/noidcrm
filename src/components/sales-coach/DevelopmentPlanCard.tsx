import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { CoachInsights } from '@/services/sales-coach/coach';

interface DevelopmentPlanCardProps {
  insights: CoachInsights;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'alta':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'média':
      return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'baixa':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function DevelopmentPlanCard({ insights }: DevelopmentPlanCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Plano de Desenvolvimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly Goals */}
        <div>
          <h4 className="text-sm font-medium mb-3">Metas da Semana</h4>
          <div className="space-y-2">
            {insights.weeklyGoals.map((goal, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{goal.goal}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {goal.metric}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${getPriorityColor(goal.priority)}`}>
                  {goal.priority}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Predicted Progress */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Previsão de Progresso
          </h4>
          <p className="text-sm text-muted-foreground">
            {insights.predictedProgress}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
