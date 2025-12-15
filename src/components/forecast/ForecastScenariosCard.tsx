import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ForecastScenario } from '@/hooks/useForecastData';
import { CheckCircle2, XCircle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';

interface ForecastScenariosCardProps {
  scenarios: ForecastScenario[];
  goal: number;
}


export function ForecastScenariosCard({ scenarios, goal }: ForecastScenariosCardProps) {
  const scenarioColors = {
    pessimistic: 'bg-red-500',
    realistic: 'bg-yellow-500',
    optimistic: 'bg-green-500',
    best_case: 'bg-blue-500',
  };

  const scenarioTextColors = {
    pessimistic: 'text-red-500',
    realistic: 'text-yellow-500',
    optimistic: 'text-green-500',
    best_case: 'text-blue-500',
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Cenários de Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scenarios.map((scenario) => (
          <div key={scenario.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', scenarioTextColors[scenario.name as keyof typeof scenarioTextColors])}>
                  {scenario.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({scenario.probability}% prob)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatCurrencyFull(scenario.value)}</span>
                {scenario.meetsGoal ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            
            <div className="relative">
              <Progress 
                value={Math.min(scenario.percentage, 100)} 
                className="h-2"
              />
              {/* Goal marker */}
              <div 
                className="absolute top-0 h-2 w-0.5 bg-foreground/50"
                style={{ left: '100%', transform: 'translateX(-1px)' }}
              />
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{scenario.percentage.toFixed(0)}% da meta</span>
              {!scenario.meetsGoal && scenario.gap > 0 && (
                <span className="text-red-500">
                  Gap: {formatCurrencyFull(scenario.gap)}
                </span>
              )}
              {scenario.meetsGoal && scenario.gap < 0 && (
                <span className="text-green-500">
                  +{formatCurrencyFull(Math.abs(scenario.gap))} acima
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Pessimista:</strong> Deals ≥80% prob |{' '}
            <strong>Realista:</strong> Weighted pipeline |{' '}
            <strong>Otimista:</strong> Deals ≥50% prob |{' '}
            <strong>Melhor Caso:</strong> Todo pipeline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
