import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, GraduationCap, Activity, Target, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreBreakdown } from '@/services/performance/performanceScores';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GraduationCap,
  Activity,
  Target,
  Gauge,
};

interface PerformanceScoreCardProps {
  breakdown: ScoreBreakdown;
  showDetails?: boolean;
}

export function PerformanceScoreCard({ breakdown, showDetails = false }: PerformanceScoreCardProps) {
  const Icon = iconMap[breakdown.icon] || Gauge;
  const value = breakdown.value ?? 0;
  
  const getBgGradient = () => {
    if (value >= 85) return 'from-green-500/20 to-green-600/5';
    if (value >= 70) return 'from-yellow-500/20 to-yellow-600/5';
    if (value >= 50) return 'from-orange-500/20 to-orange-600/5';
    return 'from-red-500/20 to-red-600/5';
  };

  const getProgressColor = () => {
    if (value >= 85) return 'bg-green-500';
    if (value >= 70) return 'bg-yellow-500';
    if (value >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const TrendIcon = breakdown.trend === 'up' ? TrendingUp : breakdown.trend === 'down' ? TrendingDown : Minus;
  const trendColor = breakdown.trend === 'up' ? 'text-green-500' : breakdown.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn(
            'relative overflow-hidden transition-all hover:shadow-lg cursor-pointer',
            'bg-gradient-to-br',
            getBgGradient()
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', breakdown.color.replace('text-', 'bg-') + '/20')}>
                    <Icon className={cn('h-5 w-5', breakdown.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{breakdown.score}</p>
                    <p className="text-sm font-semibold">{breakdown.label}</p>
                  </div>
                </div>
                <div className={cn('flex items-center gap-1', trendColor)}>
                  <TrendIcon className="h-4 w-4" />
                  {breakdown.trendValue > 0 && (
                    <span className="text-xs font-medium">{breakdown.trendValue.toFixed(1)}</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-baseline gap-1">
                  <span className={cn('text-3xl font-bold', breakdown.color)}>
                    {breakdown.value?.toFixed(1) ?? 'N/A'}
                  </span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={cn('h-full rounded-full transition-all duration-500', getProgressColor())}
                    style={{ width: `${Math.min(value, 100)}%` }}
                  />
                </div>
                
                {showDetails && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {breakdown.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{breakdown.label}</p>
          <p className="text-sm text-muted-foreground">{breakdown.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
