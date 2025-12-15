import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ForecastScenario } from '@/hooks/useForecastData';
import { CheckCircle2, XCircle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForecastScenariosCardProps {
  scenarios: ForecastScenario[];
  goal: number;
}

const scenarioConfig = {
  pessimistic: {
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    gradientFrom: 'from-red-500/20',
    description: 'Cenário conservador: apenas deals com ≥80% de probabilidade de fechamento',
  },
  realistic: {
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    gradientFrom: 'from-amber-500/20',
    description: 'Cenário mais provável: pipeline ponderado por probabilidade de cada deal',
  },
  optimistic: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    gradientFrom: 'from-emerald-500/20',
    description: 'Cenário otimista: deals com ≥40% de probabilidade',
  },
  best_case: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    gradientFrom: 'from-blue-500/20',
    description: 'Melhor cenário: se todos os deals do pipeline fecharem',
  },
};

export function ForecastScenariosCard({ scenarios, goal }: ForecastScenariosCardProps) {
  const maxValue = Math.max(...scenarios.map(s => s.value), goal);

  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-muted/50 to-transparent">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Cenários de Forecast
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">
                  Os cenários são calculados com base na probabilidade de fechamento dos deals no pipeline.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-2">
        {scenarios.map((scenario, index) => {
          const config = scenarioConfig[scenario.name as keyof typeof scenarioConfig];
          const progressWidth = maxValue > 0 ? (scenario.value / maxValue) * 100 : 0;
          const goalPosition = maxValue > 0 ? (goal / maxValue) * 100 : 0;

          return (
            <motion.div
              key={scenario.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-2 cursor-help">
                      <div className={cn('w-2 h-2 rounded-full', config.bgColor)} />
                      <span className={cn('text-sm font-semibold', config.color)}>
                        {scenario.label}
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted/50 rounded">
                        {scenario.probability}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs">{config.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    {formatCurrencyFull(scenario.value)}
                  </span>
                  {scenario.meetsGoal ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
              </div>

              {/* Progress bar with goal marker */}
              <div className="relative h-3 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressWidth}%` }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.6, ease: 'easeOut' }}
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full',
                    config.bgColor,
                    'opacity-80'
                  )}
                />
                {/* Goal marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/70 z-10"
                  style={{ left: `${Math.min(goalPosition, 100)}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground/70" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {scenario.percentage.toFixed(0)}% da meta
                </span>
                {!scenario.meetsGoal && scenario.gap > 0 && (
                  <span className="text-red-400 font-medium">
                    Faltam {formatCurrencyFull(scenario.gap)}
                  </span>
                )}
                {scenario.meetsGoal && scenario.gap < 0 && (
                  <span className="text-emerald-500 font-medium">
                    +{formatCurrencyFull(Math.abs(scenario.gap))} acima
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Legend */}
        <div className="pt-4 mt-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="text-red-500 font-medium">●</span> Pessimista: Deals ≥80% prob &nbsp;
            <span className="text-amber-500 font-medium">●</span> Realista: Weighted pipeline &nbsp;
            <span className="text-emerald-500 font-medium">●</span> Otimista: Deals ≥40% prob &nbsp;
            <span className="text-blue-500 font-medium">●</span> Melhor Caso: Todo pipeline
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
