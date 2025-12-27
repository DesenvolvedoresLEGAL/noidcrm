import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Shield, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OpportunityRiskAnalysisProps {
  riskAnalysis: {
    high: number;
    medium: number;
    low: number;
    highRiskValue: number;
  };
  isLoading: boolean;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function OpportunityRiskAnalysis({ riskAnalysis, isLoading }: OpportunityRiskAnalysisProps) {
  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
  }

  const total = riskAnalysis.high + riskAnalysis.medium + riskAnalysis.low;
  const highPercent = total > 0 ? Math.round((riskAnalysis.high / total) * 100) : 0;

  const riskLevels = [
    { level: 'Alto', count: riskAnalysis.high, color: 'bg-red-500', textColor: 'text-red-600', description: 'Risk Score ≥ 70' },
    { level: 'Médio', count: riskAnalysis.medium, color: 'bg-yellow-500', textColor: 'text-yellow-600', description: 'Risk Score 40-69' },
    { level: 'Baixo', count: riskAnalysis.low, color: 'bg-green-500', textColor: 'text-green-600', description: 'Risk Score < 40' },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Análise de Risco
          <Tooltip>
            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Distribuição de oportunidades por nível de risco. Risk Score combina fatores como tempo parado, falta de atividade e atraso em etapas.</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Bar */}
        <div className="h-4 rounded-full overflow-hidden bg-muted flex">
          {riskLevels.map((level) => {
            const percent = total > 0 ? (level.count / total) * 100 : 0;
            if (percent === 0) return null;
            return (
              <div key={level.level} className={cn(level.color)} style={{ width: `${percent}%` }} />
            );
          })}
        </div>

        {/* Risk Levels */}
        <div className="space-y-3">
          {riskLevels.map((level) => (
            <div key={level.level} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className={cn("h-3 w-3 rounded-full", level.color)} />
                <div>
                  <div className="font-medium">{level.level}</div>
                  <div className="text-xs text-muted-foreground">{level.description}</div>
                </div>
              </div>
              <Badge variant="outline" className={cn("font-mono", level.textColor)}>
                {level.count} opps
              </Badge>
            </div>
          ))}
        </div>

        {/* Summary */}
        {riskAnalysis.high > 0 && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-700">Atenção Requerida</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {highPercent}% do pipeline está em alto risco, representando {formatCurrency(riskAnalysis.highRiskValue)} em valor.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
