import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForecastScenario, ForecastOpportunity } from '@/hooks/useForecastData';
import { CheckCircle2, XCircle, TrendingUp, Info, Eye, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ForecastScenarioDetails } from './ForecastScenarioDetails';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

interface ForecastScenariosCardProps {
  scenarios: ForecastScenario[];
  goal: number;
  opportunities?: ForecastOpportunity[];
  closedRevenue?: number;
}

const scenarioConfig = {
  pessimistic: {
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    gradientFrom: 'from-red-500/20',
    description: 'Somente receita fechada no período.',
    formula: 'Receita Fechada',
    v2Label: 'Fechado',
  },
  realistic: {
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
    gradientFrom: 'from-amber-500/20',
    description: 'Fechado + deals elegíveis ajustados por probabilidade, NRHS, tempo, atividade, próximo passo, estágio e risco.',
    formula: 'Engine V2 — pipeline ajustado',
    v2Label: 'Engine V2',
  },
  optimistic: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
    gradientFrom: 'from-emerald-500/20',
    description: 'Inclui deals com boa chance, mas com pendências operacionais.',
    formula: 'Engine V2 — cenário expandido',
    v2Label: 'Cenário expandido',
  },
  best_case: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    gradientFrom: 'from-blue-500/20',
    description: 'Teto comercial do pipeline (não é previsão).',
    formula: 'Receita Fechada + Todo Pipeline',
    v2Label: 'Teto comercial',
  },
};

// Mapping from hook names to config keys
const nameToConfigKey: Record<string, keyof typeof scenarioConfig> = {
  pessimistic: 'pessimistic',
  realistic: 'realistic', 
  optimistic: 'optimistic',
  best_case: 'best_case',
  pessimista: 'pessimistic',
  realista: 'realistic',
  otimista: 'optimistic',
};

export function ForecastScenariosCard({ 
  scenarios, 
  goal, 
  opportunities = [],
  closedRevenue = 0,
}: ForecastScenariosCardProps) {
  const [selectedScenario, setSelectedScenario] = useState<ForecastScenario | null>(null);
  const maxValue = Math.max(...scenarios.map(s => s.value), goal);
  const { enabled: v2Enabled } = useFeatureFlag('forecast_v2_engine_enabled');

  return (
    <>
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
                    Clique em "Ver deals" para ver quais oportunidades compõem cada cenário.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {scenarios.map((scenario, index) => {
            const configKey = nameToConfigKey[scenario.name] || 'realistic';
            const config = scenarioConfig[configKey];
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
                          {v2Enabled ? config.v2Label : `${scenario.probability}%`}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-medium">{config.formula}</p>
                        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
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
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {scenario.percentage.toFixed(0)}% da meta
                    </span>
                    {/* NRHS indicator */}
                    {scenario.nrhsAverage !== undefined && scenario.nrhsAverage > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className={cn(
                              'text-[9px] px-1 py-0 h-4',
                              scenario.nrhsAverage >= 75 ? 'border-emerald-500/50 text-emerald-500' :
                              scenario.nrhsAverage >= 60 ? 'border-amber-500/50 text-amber-500' :
                              'border-red-500/50 text-red-500'
                            )}>
                              <Shield className="h-2.5 w-2.5 mr-0.5" />
                              {scenario.nrhsAverage.toFixed(0)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            NRHS médio deste cenário
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {/* Ver deals button */}
                    {opportunities.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedScenario(scenario)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {scenario.dealCount || 0} deals
                      </Button>
                    )}
                  </div>
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
              <span className="text-emerald-500 font-medium">●</span> Otimista: Weighted × 1.2 &nbsp;
              <span className="text-blue-500 font-medium">●</span> Melhor Caso: Todo pipeline
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              🛡️ Valores ajustados por NRHS. Deals com NRHS &lt; 40 excluídos do forecast.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      {selectedScenario && (
        <ForecastScenarioDetails
          isOpen={!!selectedScenario}
          onClose={() => setSelectedScenario(null)}
          scenarioName={selectedScenario.name}
          scenarioLabel={selectedScenario.label}
          scenarioColor={scenarioConfig[nameToConfigKey[selectedScenario.name] || 'realistic'].bgColor}
          dealIds={selectedScenario.dealIds || []}
          opportunities={opportunities}
          closedRevenue={closedRevenue}
        />
      )}
    </>
  );
}
