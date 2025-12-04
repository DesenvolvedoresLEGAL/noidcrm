import { Flame, Thermometer, Eye, TrendingUp, TrendingDown, Activity, Zap, Target, Snowflake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ViewingNowIndicator } from './ViewingNowIndicator';

interface ProposalExecutiveHeaderProps {
  proposalNumber?: string;
  version?: number;
  temperature?: 'hot' | 'warm' | 'cold' | 'frozen';
  engagementScore?: number;
  winProbabilityDelta?: number;
  activeViewers?: Array<{
    sessionId: string;
    viewedAt: string;
    deviceType?: string;
    city?: string;
  }>;
  className?: string;
}

const temperatureConfig = {
  hot: {
    label: 'Quente',
    icon: Flame,
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
    borderColor: 'border-red-500/30',
  },
  warm: {
    label: 'Morno',
    icon: Thermometer,
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    borderColor: 'border-amber-500/30',
  },
  cold: {
    label: 'Frio',
    icon: Snowflake,
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/30',
  },
  frozen: {
    label: 'Congelado',
    icon: Snowflake,
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-500',
    borderColor: 'border-slate-500/30',
  },
};

const getScoreConfig = (score: number) => {
  if (score >= 80) return { label: 'Muito Engajado', color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: Zap };
  if (score >= 60) return { label: 'Engajado', color: 'text-blue-500', bgColor: 'bg-blue-500', icon: TrendingUp };
  if (score >= 40) return { label: 'Moderado', color: 'text-amber-500', bgColor: 'bg-amber-500', icon: Target };
  if (score >= 20) return { label: 'Baixo', color: 'text-orange-500', bgColor: 'bg-orange-500', icon: Target };
  return { label: 'Sem Engajamento', color: 'text-muted-foreground', bgColor: 'bg-muted-foreground', icon: Target };
};

export function ProposalExecutiveHeader({
  proposalNumber,
  version,
  temperature = 'cold',
  engagementScore = 0,
  winProbabilityDelta = 0,
  activeViewers = [],
  className,
}: ProposalExecutiveHeaderProps) {
  const tempConfig = temperatureConfig[temperature];
  const TempIcon = tempConfig.icon;
  const scoreConfig = getScoreConfig(engagementScore);
  const ScoreIcon = scoreConfig.icon;

  return (
    <div className={cn('p-4 rounded-xl bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 border', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Proposal Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">Dashboard de Engajamento</span>
          </div>
          {proposalNumber && (
            <Badge variant="outline" className="font-mono text-xs">
              {proposalNumber} {version && `v${version}`}
            </Badge>
          )}
        </div>

        {/* KPIs Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Temperature Badge */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border',
                  tempConfig.bgColor,
                  tempConfig.borderColor
                )}>
                  <TempIcon className={cn('h-4 w-4', tempConfig.textColor)} />
                  <span className={cn('font-semibold text-sm', tempConfig.textColor)}>
                    {tempConfig.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Temperatura da proposta baseada no engajamento e recência</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Engagement Score */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
                  <div className={cn('p-1 rounded', scoreConfig.bgColor + '/10')}>
                    <ScoreIcon className={cn('h-3 w-3', scoreConfig.color)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Score</span>
                    <span className={cn('font-bold', scoreConfig.color)}>{engagementScore}</span>
                  </div>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn('h-full rounded-full transition-all duration-500', scoreConfig.bgColor)}
                      style={{ width: `${engagementScore}%` }}
                    />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{scoreConfig.label} - Score de engajamento: {engagementScore}/100</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Win Probability Delta */}
          {winProbabilityDelta !== 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg border',
                    winProbabilityDelta > 0 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  )}>
                    {winProbabilityDelta > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={cn(
                      'font-semibold text-sm',
                      winProbabilityDelta > 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {winProbabilityDelta > 0 ? '+' : ''}{winProbabilityDelta}%
                    </span>
                    <span className="text-xs text-muted-foreground">Win Prob.</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Variação na probabilidade de fechamento baseada no comportamento</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Viewing Now */}
          {activeViewers.length > 0 && (
            <ViewingNowIndicator viewers={activeViewers} />
          )}
        </div>
      </div>
    </div>
  );
}
