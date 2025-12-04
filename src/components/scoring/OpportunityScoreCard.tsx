import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScoreProgressBar } from './ScoreProgressBar';
import { ScoreHistoryModal } from './ScoreHistoryModal';
import { ScoreRecommendations } from './ScoreRecommendations';
import { RefreshCw, Gauge, TrendingUp, TrendingDown, Zap, AlertTriangle, Brain, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { scoreDeal, type DealScore } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';

interface OpportunityScoreCardProps {
  opportunityId?: string;
  opportunityName?: string;
  opportunityScore?: number | null;
  engagementScore?: number | null;
  velocityScore?: number | null;
  riskScore?: number | null;
  winProbabilityAi?: number | null;
  scoringFactors?: Record<string, any> | null;
  variant?: 'compact' | 'full' | 'badge';
  onRecalculate?: () => void;
  isRecalculating?: boolean;
  showRecommendations?: boolean;
  className?: string;
}

export function OpportunityScoreCard({
  opportunityId,
  opportunityName,
  opportunityScore,
  engagementScore,
  velocityScore,
  riskScore,
  winProbabilityAi,
  scoringFactors,
  variant = 'full',
  onRecalculate,
  isRecalculating,
  showRecommendations = false,
  className,
}: OpportunityScoreCardProps) {
  const [aiInsights, setAiInsights] = useState<DealScore | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const { toast } = useToast();

  const score = opportunityScore ?? 0;
  const engagement = engagementScore ?? 0;
  const velocity = velocityScore ?? 0;
  const risk = riskScore ?? 0;
  const winProb = winProbabilityAi ?? null;

  const handleLoadAiInsights = async () => {
    if (!opportunityId) return;
    
    if (aiInsights) {
      setShowAiPanel(!showAiPanel);
      return;
    }

    try {
      setLoadingAi(true);
      const result = await scoreDeal(opportunityId);
      setAiInsights(result);
      setShowAiPanel(true);
    } catch (error) {
      console.error('Error loading AI insights:', error);
      toast({
        title: 'Erro ao carregar insights',
        description: 'Não foi possível gerar os insights de IA.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAi(false);
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-emerald-500';
    if (value >= 60) return 'text-blue-500';
    if (value >= 40) return 'text-amber-500';
    if (value >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (value: number) => {
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-blue-500';
    if (value >= 40) return 'bg-amber-500';
    if (value >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRiskLevel = (value: number) => {
    if (value >= 70) return { label: 'Alto Risco', color: 'text-red-500' };
    if (value >= 40) return { label: 'Médio', color: 'text-amber-500' };
    return { label: 'Baixo', color: 'text-emerald-500' };
  };

  const getRiskBadge = (riskLevel: string) => {
    const variants = {
      low: 'bg-emerald-100 text-emerald-800',
      medium: 'bg-amber-100 text-amber-800',
      high: 'bg-red-100 text-red-800',
    };
    return variants[riskLevel as keyof typeof variants] || variants.medium;
  };

  // Badge variant - small circular with score
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1.5', className)}>
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold',
                  getScoreBg(score)
                )}
              >
                {score}
              </div>
              {risk >= 60 && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
              {winProb !== null && (
                <span className="text-[10px] text-muted-foreground">
                  {winProb}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-3">
            <div className="space-y-2 min-w-[160px]">
              <div className="font-semibold text-xs">Score: {score}/100</div>
              <div className="space-y-1.5">
                <ScoreProgressBar value={engagement} label="Engajamento" size="sm" />
                <ScoreProgressBar value={velocity} label="Velocidade" size="sm" />
                <ScoreProgressBar value={risk} label="Risco" size="sm" colorMode="inverse" />
              </div>
              {winProb !== null && (
                <div className="text-[10px] text-muted-foreground pt-1 border-t">
                  AI Win Probability: {winProb}%
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    const riskInfo = getRiskLevel(risk);
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm',
              getScoreBg(score)
            )}
          >
            {score}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Score</span>
              {winProb !== null && (
                <span className="text-primary font-medium">{winProb}% prob</span>
              )}
            </div>
            <div className="flex gap-1">
              <ScoreProgressBar value={engagement} size="sm" showValue={false} className="flex-1" />
              <ScoreProgressBar value={velocity} size="sm" showValue={false} className="flex-1" />
            </div>
            {risk >= 40 && (
              <div className={cn('flex items-center gap-1 text-[10px]', riskInfo.color)}>
                <AlertTriangle className="h-2.5 w-2.5" />
                <span>{riskInfo.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Insights Button - Compact */}
        {opportunityId && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs h-7"
            onClick={handleLoadAiInsights}
            disabled={loadingAi}
          >
            {loadingAi ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-primary" />
                {aiInsights ? (showAiPanel ? 'Ocultar' : 'Ver') : 'Ver'} Insights IA
                {aiInsights && (showAiPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
              </>
            )}
          </Button>
        )}

        {/* AI Insights Panel - Compact */}
        {showAiPanel && aiInsights && (
          <div className="space-y-2 pt-2 border-t animate-in slide-in-from-top-2 duration-200">
            {/* Risk Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Análise IA</span>
              <Badge className={getRiskBadge(aiInsights.risk_level)} variant="secondary">
                {aiInsights.risk_level === 'low' ? 'Baixo' : aiInsights.risk_level === 'medium' ? 'Médio' : 'Alto'}
              </Badge>
            </div>

            {/* Key Insights */}
            <div className="p-2 bg-primary/5 rounded-lg">
              <p className="text-[10px] leading-relaxed">{aiInsights.key_insights}</p>
            </div>

            {/* Positive Factors */}
            {aiInsights.factors.positive.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
                  <span className="text-[10px] font-medium">Positivos</span>
                </div>
                <ul className="space-y-1">
                  {aiInsights.factors.positive.slice(0, 3).map((factor, i) => (
                    <li key={i} className="text-[10px] text-emerald-700 flex items-start gap-1">
                      <span className="text-emerald-600 shrink-0">✓</span>
                      <span className="break-words">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Negative Factors */}
            {aiInsights.factors.negative.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown className="h-2.5 w-2.5 text-red-600" />
                  <span className="text-[10px] font-medium">Riscos</span>
                </div>
                <ul className="space-y-1">
                  {aiInsights.factors.negative.slice(0, 3).map((factor, i) => (
                    <li key={i} className="text-[10px] text-red-700 flex items-start gap-1">
                      <span className="text-red-600 shrink-0">✗</span>
                      <span className="break-words">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {aiInsights.recommendations.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Sparkles className="h-2.5 w-2.5 text-primary" />
                  <span className="text-[10px] font-medium">Recomendações</span>
                </div>
                <ul className="space-y-1">
                  {aiInsights.recommendations.slice(0, 2).map((rec, i) => (
                    <li key={i} className="text-[10px] flex items-start gap-1">
                      <span className="text-primary shrink-0">→</span>
                      <span className="break-words">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full variant
  const riskInfo = getRiskLevel(risk);

  return (
    <div className={cn('bg-card border rounded-lg p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Opportunity Score</span>
        </div>
        {onRecalculate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRecalculate}
            disabled={isRecalculating}
          >
            <RefreshCw className={cn('h-3 w-3', isRecalculating && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Main Score */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div
            className={cn(
              'h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg',
              getScoreBg(score)
            )}
          >
            {score}
          </div>
          {risk >= 60 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1">
          {winProb !== null && (
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-lg font-bold text-foreground">{winProb}%</span>
              <span className="text-[10px] text-muted-foreground">win prob (AI)</span>
            </div>
          )}
          <div className={cn('flex items-center gap-1 text-xs', riskInfo.color)}>
            <AlertTriangle className="h-3 w-3" />
            <span>Risco: {riskInfo.label}</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-blue-500" />
          <ScoreProgressBar value={engagement} label="Engajamento" size="md" className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-amber-500" />
          <ScoreProgressBar value={velocity} label="Velocidade" size="md" className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-red-500" />
          <ScoreProgressBar value={risk} label="Risco" size="md" colorMode="inverse" className="flex-1" />
        </div>
      </div>

      {/* AI Insights Button */}
      {opportunityId && (
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleLoadAiInsights}
            disabled={loadingAi}
          >
            {loadingAi ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {aiInsights ? (showAiPanel ? 'Ocultar' : 'Ver') : 'Ver'} Insights IA
                {aiInsights && (showAiPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
              </>
            )}
          </Button>
        </div>
      )}

      {/* AI Insights Panel */}
      {showAiPanel && aiInsights && (
        <div className="space-y-3 pt-2 border-t animate-in slide-in-from-top-2 duration-200">
          {/* Risk Badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Análise IA</span>
            <Badge className={getRiskBadge(aiInsights.risk_level)} variant="secondary">
              Risco: {aiInsights.risk_level === 'low' ? 'Baixo' : aiInsights.risk_level === 'medium' ? 'Médio' : 'Alto'}
            </Badge>
          </div>

          {/* Key Insights */}
          <div className="p-3 bg-primary/5 rounded-lg">
            <p className="text-xs">{aiInsights.key_insights}</p>
          </div>

          {/* Positive Factors */}
          {aiInsights.factors.positive.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-600" />
                <span className="text-xs font-medium">Fatores Positivos</span>
              </div>
              <ul className="space-y-1">
                {aiInsights.factors.positive.map((factor, i) => (
                  <li key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
                    <span className="text-emerald-600">✓</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negative Factors */}
          {aiInsights.factors.negative.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown className="h-3 w-3 text-red-600" />
                <span className="text-xs font-medium">Fatores de Risco</span>
              </div>
              <ul className="space-y-1">
                {aiInsights.factors.negative.map((factor, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="text-red-600">✗</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {aiInsights.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span className="text-xs font-medium">Recomendações</span>
              </div>
              <ul className="space-y-1">
                {aiInsights.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5">
                    <span className="text-primary">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* History Link */}
      {opportunityId && (
        <div className="flex justify-end pt-1 border-t">
          <ScoreHistoryModal
            entityType="opportunity"
            entityId={opportunityId}
            entityName={opportunityName}
          />
        </div>
      )}

      {/* AI Recommendations */}
      {showRecommendations && (
        <ScoreRecommendations
          entityType="opportunity"
          scores={{ engagementScore: engagement, velocityScore: velocity, riskScore: risk, opportunityScore: score }}
          scoringFactors={scoringFactors}
          className="pt-2 border-t"
        />
      )}
    </div>
  );
}