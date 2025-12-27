import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ForecastKPIs, ForecastOpportunity } from '@/hooks/useForecastData';
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIForecastInsightsPanelProps {
  kpis: ForecastKPIs;
  opportunities: ForecastOpportunity[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function AIForecastInsightsPanel({ kpis, opportunities }: AIForecastInsightsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generate insights based on data
  const positiveFactors: string[] = [];
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // NRHS-based insights
  const nrhsExcluded = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 40);
  const nrhsLow = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 60);
  const nrhsHigh = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score >= 75);
  const withoutNextStep = opportunities.filter(o => !o.has_next_step);
  
  // NRHS confidence analysis
  if (kpis.nrhsConfidence === 'high') {
    positiveFactors.push(`Confiança NRHS alta (${kpis.nrhsAverage?.toFixed(0) || 0}%) - forecast confiável`);
  }
  
  if (nrhsHigh.length > opportunities.length * 0.5 && opportunities.length > 0) {
    positiveFactors.push(`${Math.round(nrhsHigh.length / opportunities.length * 100)}% dos deals com NRHS ≥ 75 (alta confiabilidade)`);
  }

  // NRHS risk factors
  if (nrhsExcluded.length > 0) {
    const excludedValue = nrhsExcluded.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    riskFactors.push(`${nrhsExcluded.length} deals (${formatCurrency(excludedValue)}) excluídos do forecast por NRHS < 40`);
  }

  if (nrhsLow.length > 0) {
    const lowNrhsInCommit = opportunities.filter(o => 
      o.category === 'commit' && o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 60
    );
    if (lowNrhsInCommit.length > 0) {
      riskFactors.push(`${lowNrhsInCommit.length} deals em Commit com NRHS < 60 - risco de inflação do forecast`);
    }
  }

  if (kpis.nrhsAverage !== undefined && kpis.nrhsAverage < 65) {
    riskFactors.push(`NRHS médio baixo (${kpis.nrhsAverage.toFixed(0)}%) - forecast pode estar inflado`);
  }

  // Analyze pipeline coverage
  if (kpis.pipelineCoverage >= 3) {
    positiveFactors.push(`Pipeline coverage saudável (${kpis.pipelineCoverage.toFixed(1)}x)`);
  } else if (kpis.pipelineCoverage < 2) {
    riskFactors.push(`Pipeline coverage baixa (${kpis.pipelineCoverage.toFixed(1)}x) - risco de não bater meta`);
    recommendations.push('Aumentar prospecção para atingir cobertura mínima de 3x');
  }

  // Analyze win rate
  if (kpis.winRate >= 30) {
    positiveFactors.push(`Win rate acima da média (${kpis.winRate.toFixed(0)}%)`);
  } else if (kpis.winRate < 20) {
    riskFactors.push(`Win rate baixo (${kpis.winRate.toFixed(0)}%) - revisar processo de vendas`);
  }

  // Analyze at-risk deals
  const atRiskOpps = opportunities.filter(o => o.risk_level === 'high' || o.risk_level === 'critical');
  const atRiskValue = atRiskOpps.reduce((sum, o) => sum + o.valor_previsto, 0);
  if (atRiskOpps.length > 0) {
    riskFactors.push(`${atRiskOpps.length} deals em risco (${formatCurrency(atRiskValue)})`);
    recommendations.push(`Priorizar follow-up em ${atRiskOpps.length} deals estagnados`);
  }

  // Analyze hot deals
  const hotDeals = opportunities.filter(o => o.temperature === 'burning' || o.temperature === 'hot');
  if (hotDeals.length > 0) {
    positiveFactors.push(`${hotDeals.length} deals quentes prontos para fechar`);
  }

  // Analyze slippage
  if (kpis.slippageCount > 0) {
    riskFactors.push(`${kpis.slippageCount} deals com close date vencida`);
    recommendations.push('Atualizar datas de fechamento ou revisar previsibilidade');
  }

  // Analyze velocity
  const requiredVelocity = (kpis.goal - kpis.closedRevenue) / Math.max(kpis.daysRemaining, 1);
  if (kpis.velocityPerDay >= requiredVelocity) {
    positiveFactors.push('Velocidade de vendas no ritmo necessário');
  } else {
    riskFactors.push(`Velocidade atual (${formatCurrency(kpis.velocityPerDay)}/dia) abaixo do necessário (${formatCurrency(requiredVelocity)}/dia)`);
  }

  // Commit vs goal analysis
  if (kpis.commitPercentage >= 100) {
    positiveFactors.push('Commit já cobre 100% da meta');
  } else if (kpis.commitPercentage < 80) {
    riskFactors.push(`Commit cobre apenas ${kpis.commitPercentage.toFixed(0)}% da meta`);
  }

  // NRHS-based recommendations
  if (withoutNextStep.length > 0) {
    const impactValue = withoutNextStep.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    recommendations.push(`Ausência de próximo passo impacta ${formatCurrency(impactValue)} do forecast`);
  }

  if (nrhsExcluded.length > 0) {
    recommendations.push(`Corrigir higiene de ${nrhsExcluded.length} deals para incluí-los no forecast`);
  }

  // Add general recommendations
  if (recommendations.length === 0) {
    if (kpis.closedPercentage < 50 && kpis.daysRemaining < 15) {
      recommendations.push('Acelerar fechamentos - menos de 15 dias restantes');
    }
    if (kpis.avgDealSize > 0 && opportunities.length > 0) {
      recommendations.push(`Ticket médio: ${formatCurrency(kpis.avgDealSize)} - considere upsell em deals existentes`);
    }
  }

  const confidenceScore = Math.round(
    (positiveFactors.length / (positiveFactors.length + riskFactors.length + 0.01)) * 100
  );

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            HUMANOID Forecast Intelligence
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              'text-xs',
              confidenceScore >= 70 ? 'border-green-500 text-green-500' :
              confidenceScore >= 40 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'
            )}>
              Confiança: {confidenceScore}%
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAnalyzing(true)}
              disabled={isAnalyzing}
              className="h-7 px-2"
            >
              <RefreshCw className={cn('h-3 w-3', isAnalyzing && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Positive Factors */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-500">
              <TrendingUp className="h-4 w-4" />
              Fatores Positivos
            </h4>
            <div className="space-y-1.5">
              {positiveFactors.length > 0 ? (
                positiveFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{factor}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum fator positivo identificado</p>
              )}
            </div>
          </div>

          {/* Risk Factors */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-red-500">
              <TrendingDown className="h-4 w-4" />
              Fatores de Risco
            </h4>
            <div className="space-y-1.5">
              {riskFactors.length > 0 ? (
                riskFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{factor}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum fator de risco identificado</p>
              )}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium flex items-center gap-2 text-yellow-500 mb-2">
              <Lightbulb className="h-4 w-4" />
              Recomendações
            </h4>
            <div className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-yellow-500 font-medium">{i + 1}.</span>
                  <span className="text-muted-foreground">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
