import { Progress } from '@/components/ui/progress';
import { TrendingUp, Zap, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EngagementScoreCardProps {
  score: number; // 0-100
  className?: string;
}

export function EngagementScoreCard({ score, className }: EngagementScoreCardProps) {
  const getScoreConfig = (score: number) => {
    if (score >= 80) {
      return {
        label: 'Muito Engajado',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500',
        icon: Zap,
        description: 'Cliente demonstra alto interesse na proposta',
      };
    }
    if (score >= 60) {
      return {
        label: 'Engajado',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500',
        icon: TrendingUp,
        description: 'Bom nível de interesse detectado',
      };
    }
    if (score >= 40) {
      return {
        label: 'Moderado',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500',
        icon: Target,
        description: 'Interesse médio, considere fazer follow-up',
      };
    }
    if (score >= 20) {
      return {
        label: 'Baixo',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500',
        icon: Target,
        description: 'Pouca interação com a proposta',
      };
    }
    return {
      label: 'Sem Engajamento',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted-foreground',
      icon: Target,
      description: 'Proposta ainda não foi visualizada',
    };
  };

  const config = getScoreConfig(score);
  const Icon = config.icon;

  return (
    <div className={cn('p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.bgColor + '/10')}>
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Engagement Score</span>
        </div>
        <span className={cn('text-2xl font-bold', config.color)}>{score}</span>
      </div>
      
      <div className="space-y-2">
        <div className="relative">
          <Progress 
            value={score} 
            className="h-3 bg-muted"
          />
          <div 
            className={cn(
              'absolute top-0 left-0 h-3 rounded-full transition-all duration-500',
              config.bgColor
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-semibold', config.color)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">de 100</span>
        </div>
        
        <p className="text-xs text-muted-foreground mt-1">
          {config.description}
        </p>
      </div>
    </div>
  );
}
