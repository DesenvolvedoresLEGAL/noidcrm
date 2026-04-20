import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ForecastKPIs, ForecastOpportunity } from '@/hooks/useForecastData';
import { useForecastAIInsights } from '@/hooks/useForecastAIInsights';
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, CheckCircle, Info, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface AIForecastInsightsPanelProps {
  kpis: ForecastKPIs;
  opportunities: ForecastOpportunity[];
  pipelineId?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Fallback determinístico (regras locais) — usado quando IA falha
function buildLocalInsights(kpis: ForecastKPIs, opportunities: ForecastOpportunity[]) {
  const positiveFactors: string[] = [];
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  const nrhsExcluded = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 40);
  const nrhsLow = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 60);
  const nrhsHigh = opportunities.filter(o => o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score >= 75);
  const withoutNextStep = opportunities.filter(o => !o.has_next_step);

  if (kpis.nrhsConfidence === 'high') {
    positiveFactors.push(`Confiança NRHS alta (${kpis.nrhsAverage?.toFixed(0) || 0}%) - forecast confiável`);
  }
  if (nrhsHigh.length > opportunities.length * 0.5 && opportunities.length > 0) {
    positiveFactors.push(`${Math.round(nrhsHigh.length / opportunities.length * 100)}% dos deals com NRHS ≥ 75`);
  }
  if (nrhsExcluded.length > 0) {
    const excludedValue = nrhsExcluded.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
    riskFactors.push(`${nrhsExcluded.length} deals (${formatCurrency(excludedValue)}) excluídos por NRHS < 40`);
  }
  if (nrhsLow.length > 0) {
    const lowNrhsInCommit = opportunities.filter(o =>
      o.category === 'commit' && o.nrhs_score !== null && o.nrhs_score !== undefined && o.nrhs_score < 60,
    );
    if (lowNrhsInCommit.length > 0) {
      riskFactors.push(`${lowNrhsInCommit.length} deals em Commit com NRHS < 60 - risco de inflação do forecast`);
    }
  }
  if (kpis.pipelineCoverage >= 3) {
    positiveFactors.push(`Pipeline coverage saudável (${kpis.pipelineCoverage.toFixed(1)}x)`);
  } else if (kpis.pipelineCoverage < 2) {
    riskFactors.push(`Pipeline coverage baixa (${kpis.pipelineCoverage.toFixed(1)}x)`);
    recommendations.push('Aumentar prospecção para atingir cobertura mínima de 3x');
  }
  if (kpis.winRate >= 30) positiveFactors.push(`Win rate acima da média (${kpis.winRate.toFixed(0)}%)`);
  else if (kpis.winRate < 20) riskFactors.push(`Win rate baixo (${kpis.winRate.toFixed(0)}%)`);

  const atRiskOpps = opportunities.filter(o => o.risk_level === 'high' || o.risk_level === 'critical');
  if (atRiskOpps.length > 0) {
    const v = atRiskOpps.reduce((s, o) => s + o.valor_previsto, 0);
    riskFactors.push(`${atRiskOpps.length} deals em risco (${formatCurrency(v)})`);
    recommendations.push(`Priorizar follow-up em ${atRiskOpps.length} deals estagnados`);
  }
  if (kpis.slippageCount > 0) {
    riskFactors.push(`${kpis.slippageCount} deals com close date vencida`);
    recommendations.push('Atualizar datas de fechamento ou revisar previsibilidade');
  }
  if (withoutNextStep.length > 0) {
    const v = withoutNextStep.reduce((s, o) => s + (o.valor_previsto || 0), 0);
    recommendations.push(`Ausência de próximo passo impacta ${formatCurrency(v)} do forecast`);
  }

  const confidenceScore = Math.round(
    (positiveFactors.length / (positiveFactors.length + riskFactors.length + 0.01)) * 100,
  );

  return { positiveFactors, riskFactors, recommendations, confidenceScore };
}

export function AIForecastInsightsPanel({ kpis, opportunities, pipelineId }: AIForecastInsightsPanelProps) {
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_user_organization_id').then(({ data }) => setOrgId(data as string | null));
  }, []);

  const { data, isLoading, isFetching, error, refetch } = useForecastAIInsights({
    organizationId: orgId,
    pipelineId,
    enabled: !!orgId,
  });

  // Fallback determinístico
  const local = buildLocalInsights(kpis, opportunities);
  const usingAI = !!data && !error;

  const positiveFactors = usingAI
    ? data!.factors.filter(f => f.type === 'positive').map(f => f.description)
    : local.positiveFactors;
  const riskFactors = usingAI
    ? data!.factors.filter(f => f.type === 'negative').map(f => f.description)
    : local.riskFactors;
  const recommendations = usingAI
    ? data!.recommendations.map(r => r.action)
    : local.recommendations;
  const confidenceScore = usingAI ? data!.confidence : local.confidenceScore;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-warning" />
            HUMANOID Forecast Intelligence
            {usingAI && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                IA
              </Badge>
            )}
            {!usingAI && !isLoading && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px]">
                      Local
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-xs">Análise determinística (fallback). IA indisponível no momento.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              'text-xs',
              confidenceScore >= 70 ? 'border-success text-success' :
              confidenceScore >= 40 ? 'border-warning text-warning' : 'border-destructive text-destructive',
            )}>
              Confiança: {confidenceScore}%
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-7 px-2"
              title="Regenerar análise"
            >
              <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && !data && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Analisando pipeline com IA...
          </div>
        )}

        {usingAI && data!.reasoning && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">{data!.reasoning}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Positive Factors */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-success">
              <TrendingUp className="h-4 w-4" />
              Fatores Positivos
            </h4>
            <div className="space-y-1.5">
              {positiveFactors.length > 0 ? (
                positiveFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
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
            <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
              <TrendingDown className="h-4 w-4" />
              Fatores de Risco
            </h4>
            <div className="space-y-1.5">
              {riskFactors.length > 0 ? (
                riskFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
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
            <h4 className="text-sm font-medium flex items-center gap-2 text-warning mb-2">
              <Lightbulb className="h-4 w-4" />
              Recomendações
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">
                      <strong>Próximo passo</strong> = atividade agendada (call, e-mail, reunião, follow-up)
                      com data futura e status pendente. Oportunidades sem próximo passo costumam estagnar.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <div className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-warning font-medium">{i + 1}.</span>
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
