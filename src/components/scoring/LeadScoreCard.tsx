import { cn } from '@/lib/utils';
import { LeadGradeBadge } from './LeadGradeBadge';
import { ScoreProgressBar } from './ScoreProgressBar';
import { ScoreHistoryModal } from './ScoreHistoryModal';
import { ScoreRecommendations } from './ScoreRecommendations';
import { RefreshCw, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LeadScoreCardProps {
  accountId?: string;
  accountName?: string;
  leadScore?: number | null;
  fitScore?: number | null;
  intentScore?: number | null;
  leadGrade?: string | null;
  scoringFactors?: Record<string, any> | null;
  variant?: 'compact' | 'full' | 'inline';
  onRecalculate?: () => void;
  isRecalculating?: boolean;
  showRecommendations?: boolean;
  className?: string;
}

export function LeadScoreCard({
  accountId,
  accountName,
  leadScore,
  fitScore,
  intentScore,
  leadGrade,
  scoringFactors,
  variant = 'full',
  onRecalculate,
  isRecalculating,
  showRecommendations = false,
  className,
}: LeadScoreCardProps) {
  const grade = leadGrade || 'N/A';
  const score = leadScore ?? 0;
  const fit = fitScore ?? 0;
  const intent = intentScore ?? 0;

  // Inline variant - just the badge
  if (variant === 'inline') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex">
              <LeadGradeBadge grade={grade} size="sm" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-3">
            <div className="space-y-2">
              <div className="font-semibold text-xs">Lead Score: {score}/100</div>
              <div className="space-y-1.5 min-w-[140px]">
                <ScoreProgressBar value={fit} label="FIT" size="sm" />
                <ScoreProgressBar value={intent} label="INTENT" size="sm" />
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Compact variant - badge + mini bars
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-2', className)}>
              <LeadGradeBadge grade={grade} size="md" />
              <div className="flex-1 min-w-0 space-y-0.5">
                <ScoreProgressBar value={fit} size="sm" showValue={false} />
                <ScoreProgressBar value={intent} size="sm" showValue={false} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-3">
            <div className="space-y-2">
              <div className="font-semibold text-xs">Lead Score: {score}/100</div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">FIT:</span>
                  <span className="ml-1 font-medium">{fit}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">INTENT:</span>
                  <span className="ml-1 font-medium">{intent}</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant - complete card
  return (
    <div className={cn('bg-card border rounded-lg p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Lead Score</span>
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
        <LeadGradeBadge grade={grade} score={score} size="lg" showScore />
        <div className="flex-1 text-right">
          <div className="text-2xl font-bold text-foreground">{score}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">pontos</div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Target className="h-3 w-3 text-blue-500" />
          <ScoreProgressBar value={fit} label="FIT Score (ICP)" size="md" className="flex-1" />
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-amber-500" />
          <ScoreProgressBar value={intent} label="INTENT Score" size="md" className="flex-1" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t">
        <div className="text-[10px] text-muted-foreground">
          Lead = (FIT × 0.4) + (INTENT × 0.6)
        </div>
        {accountId && (
          <ScoreHistoryModal
            entityType="account"
            entityId={accountId}
            entityName={accountName}
          />
        )}
      </div>

      {/* AI Recommendations */}
      {showRecommendations && (
        <ScoreRecommendations
          entityType="account"
          scores={{ fitScore: fit, intentScore: intent, leadScore: score }}
          scoringFactors={scoringFactors}
          className="pt-2 border-t"
        />
      )}
    </div>
  );
}
