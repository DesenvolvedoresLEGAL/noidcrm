import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Thermometer, Snowflake, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PLGScoreCardProps {
  score: number;
  scoreMax?: number;
  scoreAvg?: number;
  classification: 'hot' | 'warm' | 'cold' | null;
  breakdown?: {
    activation: number;
    engagement: number;
    adoption: number;
    intent: number;
  };
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PLGScoreCard({
  score,
  scoreMax,
  scoreAvg,
  classification,
  breakdown,
  showBreakdown = true,
  size = 'md',
  className,
}: PLGScoreCardProps) {
  const getClassificationConfig = (cls: string | null) => {
    switch (cls) {
      case 'hot':
        return {
          icon: Flame,
          label: 'Quente',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20',
          progressColor: 'bg-red-500',
        };
      case 'warm':
        return {
          icon: Thermometer,
          label: 'Morno',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20',
          progressColor: 'bg-yellow-500',
        };
      case 'cold':
        return {
          icon: Snowflake,
          label: 'Frio',
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          progressColor: 'bg-blue-500',
        };
      default:
        return {
          icon: Minus,
          label: 'N/A',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          borderColor: 'border-muted/20',
          progressColor: 'bg-muted',
        };
    }
  };

  const config = getClassificationConfig(classification);
  const Icon = config.icon;

  const getTrend = () => {
    if (!scoreAvg || score === scoreAvg) return { icon: Minus, label: 'Estável', color: 'text-muted-foreground' };
    if (score > scoreAvg) return { icon: TrendingUp, label: 'Subindo', color: 'text-green-500' };
    return { icon: TrendingDown, label: 'Caindo', color: 'text-red-500' };
  };

  const trend = getTrend();
  const TrendIcon = trend.icon;

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const scoreSizes = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-5xl',
  };

  return (
    <div 
      className={cn(
        "rounded-xl border",
        config.bgColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PLG Score</p>
            <Badge className={cn("mt-1", config.bgColor, config.color, config.borderColor)}>
              {config.label}
            </Badge>
          </div>
        </div>
        {scoreAvg !== undefined && (
          <div className="flex items-center gap-1 text-xs">
            <TrendIcon className={cn("h-3 w-3", trend.color)} />
            <span className={trend.color}>{trend.label}</span>
          </div>
        )}
      </div>

      {/* Score Display */}
      <div className="mb-4">
        <div className="flex items-end gap-2">
          <span className={cn("font-bold", scoreSizes[size], config.color)}>
            {score}
          </span>
          <span className="text-muted-foreground mb-1">/ 100</span>
        </div>
        <Progress 
          value={score} 
          className="h-2 mt-2"
        />
      </div>

      {/* Stats */}
      {(scoreMax !== undefined || scoreAvg !== undefined) && (
        <div className="flex gap-4 mb-4 text-sm">
          {scoreMax !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Máximo</p>
              <p className="font-semibold">{scoreMax}</p>
            </div>
          )}
          {scoreAvg !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Média</p>
              <p className="font-semibold">{scoreAvg.toFixed(1)}</p>
            </div>
          )}
        </div>
      )}

      {/* Breakdown */}
      {showBreakdown && breakdown && (
        <div className="space-y-2 pt-3 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Breakdown</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span>🚀 Ativação</span>
              <span className="font-medium">{breakdown.activation}</span>
            </div>
            <div className="flex justify-between">
              <span>💡 Engajamento</span>
              <span className="font-medium">{breakdown.engagement}</span>
            </div>
            <div className="flex justify-between">
              <span>⚡ Adoção</span>
              <span className="font-medium">{breakdown.adoption}</span>
            </div>
            <div className="flex justify-between">
              <span>🎯 Intenção</span>
              <span className="font-medium">{breakdown.intent}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
