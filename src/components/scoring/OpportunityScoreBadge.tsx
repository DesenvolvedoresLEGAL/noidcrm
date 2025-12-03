import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OpportunityScoreBadgeProps {
  score: number;
  riskScore?: number;
  winProbability?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export function OpportunityScoreBadge({ 
  score, 
  riskScore, 
  winProbability,
  size = 'md', 
  showDetails = false 
}: OpportunityScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500 text-white';
    if (score >= 60) return 'bg-blue-500 text-white';
    if (score >= 40) return 'bg-yellow-500 text-white';
    if (score >= 20) return 'bg-orange-500 text-white';
    return 'bg-red-500 text-white';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excelente';
    if (score >= 60) return 'Bom';
    if (score >= 40) return 'Regular';
    if (score >= 20) return 'Baixo';
    return 'Crítico';
  };

  const sizeStyles = {
    sm: 'h-6 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-10 px-4 text-base'
  };

  const isHighRisk = riskScore && riskScore >= 60;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <div
              className={cn(
                'rounded-full font-bold flex items-center justify-center gap-1',
                getScoreColor(score),
                sizeStyles[size]
              )}
            >
              {score >= 60 ? (
                <TrendingUp className="h-3 w-3" />
              ) : score < 40 ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              <span>{score}</span>
            </div>
            {isHighRisk && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-medium">{getScoreLabel(score)}</div>
            {riskScore !== undefined && (
              <div className="text-xs">
                Risco: {riskScore}% {riskScore >= 60 ? '⚠️' : '✓'}
              </div>
            )}
            {winProbability !== undefined && winProbability !== null && (
              <div className="text-xs">
                Prob. de Ganho (AI): {winProbability}%
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
