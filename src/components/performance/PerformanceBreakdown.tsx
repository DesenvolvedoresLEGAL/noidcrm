import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreBreakdown } from '@/services/performance/performanceScores';

interface PerformanceBreakdownProps {
  breakdowns: ScoreBreakdown[];
}

export function PerformanceBreakdown({ breakdowns }: PerformanceBreakdownProps) {
  const increases = breakdowns.filter(b => b.trend === 'up' && b.trendValue > 0);
  const decreases = breakdowns.filter(b => b.trend === 'down' && b.trendValue > 0);
  const stable = breakdowns.filter(b => b.trend === 'stable' || b.trendValue === 0);
  
  const getImprovementSuggestions = (breakdowns: ScoreBreakdown[]) => {
    const suggestions: string[] = [];
    
    breakdowns.forEach(b => {
      if (b.value !== null && b.value < 65) {
        switch (b.score) {
          case 'CS':
            suggestions.push('Complete mais sessões de roleplay para melhorar seu CS');
            break;
          case 'BS':
            suggestions.push('Aumente sua frequência de atividades diárias para melhorar o BS');
            break;
          case 'DS':
            suggestions.push('Foque em reduzir o aging das oportunidades para melhorar o DS');
            break;
          case 'RAS':
            suggestions.push('Trabalhe nos scores individuais para melhorar seu RAS geral');
            break;
        }
      }
    });
    
    return suggestions.length > 0 ? suggestions : ['Continue mantendo seu bom desempenho!'];
  };
  
  const suggestions = getImprovementSuggestions(breakdowns);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* What increased */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-600">
            <TrendingUp className="h-4 w-4" />
            O que aumentou
          </CardTitle>
        </CardHeader>
        <CardContent>
          {increases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aumento recente</p>
          ) : (
            <div className="space-y-2">
              {increases.map(item => (
                <div key={item.score} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    +{item.trendValue.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* What decreased */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600">
            <TrendingDown className="h-4 w-4" />
            O que diminuiu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {decreases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma queda recente</p>
          ) : (
            <div className="space-y-2">
              {decreases.map(item => (
                <div key={item.score} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                    -{item.trendValue.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* How to improve */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
            <Lightbulb className="h-4 w-4" />
            Como melhorar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {suggestion}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
