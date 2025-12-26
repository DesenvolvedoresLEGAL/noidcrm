import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { TrendingUp, TrendingDown, Lightbulb, Info, ChevronRight, Target, Activity, GraduationCap, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScoreExplainability {
  breakdown: Record<string, {
    value: number;
    weight: number;
    contribution: number;
    label?: string;
  }>;
  increased_by: string[];
  decreased_by: string[];
  how_to_improve: string[];
}

interface ScoreExplainabilityCardProps {
  scoreType: 'CS' | 'BS' | 'DS' | 'RAS';
  scoreValue: number | null;
  explainability: ScoreExplainability | null;
  previousValue?: number | null;
}

const scoreConfig = {
  CS: {
    label: 'Capacitação Score',
    icon: GraduationCap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  BS: {
    label: 'Behavior Score',
    icon: Activity,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10'
  },
  DS: {
    label: 'Deal Score',
    icon: Target,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  },
  RAS: {
    label: 'Rep Alignment Score',
    icon: Gauge,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10'
  }
};

export function ScoreExplainabilityCard({ scoreType, scoreValue, explainability, previousValue }: ScoreExplainabilityCardProps) {
  const config = scoreConfig[scoreType];
  const Icon = config.icon;
  
  const change = scoreValue && previousValue ? scoreValue - previousValue : 0;
  const changePercent = previousValue ? ((change / previousValue) * 100).toFixed(1) : '0';

  if (!explainability) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className={cn('h-4 w-4', config.color)} />
            {config.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Dados de explicabilidade não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const breakdownEntries = Object.entries(explainability.breakdown || {});
  const totalContribution = breakdownEntries.reduce((sum, [, item]) => sum + (item.contribution || 0), 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn('pb-3', config.bgColor)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', config.color)} />
            <span>{config.label}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold', config.color)}>
              {scoreValue?.toFixed(1) ?? 'N/A'}
            </span>
            {change !== 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  'text-xs',
                  change > 0 ? 'bg-green-500/10 text-green-600 border-green-500/30' : 'bg-red-500/10 text-red-600 border-red-500/30'
                )}
              >
                {change > 0 ? '+' : ''}{change.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        <Accordion type="single" collapsible className="w-full">
          {/* Breakdown Section */}
          <AccordionItem value="breakdown" className="border-b-0">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                Composição do Score
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {breakdownEntries.map(([key, item]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label || key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {(item.value * 100).toFixed(0)}% × {(item.weight * 100).toFixed(0)}%
                        </span>
                        <span className="font-medium">{item.contribution.toFixed(1)} pts</span>
                      </div>
                    </div>
                    <Progress 
                      value={(item.contribution / Math.max(totalContribution, 1)) * 100} 
                      className="h-1.5"
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* What Increased */}
          {explainability.increased_by?.length > 0 && (
            <AccordionItem value="increased" className="border-b-0">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  O que aumentou ({explainability.increased_by.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-2">
                  {explainability.increased_by.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* What Decreased */}
          {explainability.decreased_by?.length > 0 && (
            <AccordionItem value="decreased" className="border-b-0">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <TrendingDown className="h-4 w-4" />
                  O que diminuiu ({explainability.decreased_by.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-2">
                  {explainability.decreased_by.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* How to Improve */}
          {explainability.how_to_improve?.length > 0 && (
            <AccordionItem value="improve" className="border-b-0">
              <AccordionTrigger className="py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Lightbulb className="h-4 w-4" />
                  Como melhorar ({explainability.how_to_improve.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-2">
                  {explainability.how_to_improve.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm bg-primary/5 p-2 rounded-lg">
                      <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
