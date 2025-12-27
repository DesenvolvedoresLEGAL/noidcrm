import { Gauge, Shield, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOpportunityScoring } from '@/hooks/useOpportunityScoring';
import { useNRHSScore } from '@/hooks/useNRHS';
import { useEntityInsights } from '@/hooks/useKnowledgeGraph';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface QuickIndicatorsProps {
  opportunityId: string;
  organizationId?: string;
  onNavigateToIntelligence?: () => void;
}

export function QuickIndicators({ opportunityId, organizationId, onNavigateToIntelligence }: QuickIndicatorsProps) {
  const { scoring, isLoading: isLoadingScore } = useOpportunityScoring(opportunityId);
  const { data: nrhsData, isLoading: isLoadingNrhs } = useNRHSScore(opportunityId);
  const { data: gaps, isLoading: isLoadingGaps } = useEntityInsights('opportunity', opportunityId);

  const score = scoring?.opportunity_score ?? 0;
  const nrhsScore = nrhsData?.score ?? 0;
  const gapsCount = gaps?.length ?? 0;

  const getScoreColor = (value: number) => {
    if (value >= 70) return 'text-green-600 dark:text-green-400';
    if (value >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getNrhsColor = (value: number) => {
    if (value >= 80) return 'text-green-600 dark:text-green-400';
    if (value >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getGapsColor = (count: number) => {
    if (count === 0) return 'text-green-600 dark:text-green-400';
    if (count <= 3) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const isLoading = isLoadingScore || isLoadingNrhs || isLoadingGaps;

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-card border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onNavigateToIntelligence}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Score */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("text-sm font-semibold", getScoreColor(score))}>
                  {score}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Score do Deal</p>
            </TooltipContent>
          </Tooltip>

          {/* NRHS */}
          {organizationId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn("text-sm font-semibold", getNrhsColor(nrhsScore))}>
                    {nrhsScore}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>NRHS - Higiene de Revenue</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Gaps */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={cn("text-sm font-semibold", getGapsColor(gapsCount))}>
                  {gapsCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gapsCount} lacuna{gapsCount !== 1 ? 's' : ''} identificada{gapsCount !== 1 ? 's' : ''}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigate hint */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Ver detalhes</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
