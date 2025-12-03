import { cn } from '@/lib/utils';
import { ScoreProgressBar } from './ScoreProgressBar';
import { RefreshCw, Gauge, TrendingUp, Zap, AlertTriangle, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OpportunityScoreCardProps {
  opportunityScore?: number | null;
  engagementScore?: number | null;
  velocityScore?: number | null;
  riskScore?: number | null;
  winProbabilityAi?: number | null;
  variant?: 'compact' | 'full' | 'badge';
  onRecalculate?: () => void;
  isRecalculating?: boolean;
  className?: string;
}

export function OpportunityScoreCard({
  opportunityScore,
  engagementScore,
  velocityScore,
  riskScore,
  winProbabilityAi,
  variant = 'full',
  onRecalculate,
  isRecalculating,
  className,
}: OpportunityScoreCardProps) {
  const score = opportunityScore ?? 0;
  const engagement = engagementScore ?? 0;
  const velocity = velocityScore ?? 0;
  const risk = riskScore ?? 0;
  const winProb = winProbabilityAi ?? null;

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
      <div className={cn('flex items-center gap-3', className)}>
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
    </div>
  );
}
