import { Progress } from '@/components/ui/progress';
import { TrendingUp, Zap, Target, Flame, Snowflake, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface EngagementScoreCardProps {
  score: number; // 0-100 (current engagement, recency-weighted)
  /** v2: deterministic label from analyticsScoring */
  label?: string;
  /** v2: human microcopy explaining why the score is what it is */
  explanation?: string;
  /** v2: optional historical-vs-current breakdown */
  historicalScore?: number;
  riskScore?: number;
  className?: string;
}

// Maps Sprint C deterministic labels into visual config. Falls back to score-based config.
function getConfig(score: number, label?: string) {
  const map: Record<string, { color: string; bgColor: string; icon: any; description: string }> = {
    'Muito quente agora': {
      color: 'text-red-500', bgColor: 'bg-red-500', icon: Flame,
      description: 'Cliente revisou agora e demonstra alto interesse comercial.',
    },
    'Quente agora': {
      color: 'text-orange-500', bgColor: 'bg-orange-500', icon: Flame,
      description: 'Sinais recentes fortes. Momento ideal para follow-up consultivo.',
    },
    'Engajado recente': {
      color: 'text-emerald-500', bgColor: 'bg-emerald-500', icon: Zap,
      description: 'Boa interação recente. Mantenha o ritmo do contato.',
    },
    'Morno com risco': {
      color: 'text-amber-500', bgColor: 'bg-amber-500', icon: AlertTriangle,
      description: 'Houve interesse, mas o sinal atual está esfriando.',
    },
    'Frio': {
      color: 'text-blue-400', bgColor: 'bg-blue-400', icon: Target,
      description: 'Baixa interação recente. Reavaliar prioridade.',
    },
    'Sem engajamento': {
      color: 'text-slate-400', bgColor: 'bg-slate-400', icon: Snowflake,
      description: 'Sem sinais comerciais ativos.',
    },
  };
  if (label && map[label]) return { label, ...map[label] };

  if (score >= 75) return { label: 'Quente agora', ...map['Quente agora'] };
  if (score >= 60) return { label: 'Engajado recente', ...map['Engajado recente'] };
  if (score >= 40) return { label: 'Morno com risco', ...map['Morno com risco'] };
  if (score >= 20) return { label: 'Frio', ...map['Frio'] };
  return { label: 'Sem engajamento', ...map['Sem engajamento'] };
}

export function EngagementScoreCard({
  score,
  label,
  explanation,
  historicalScore,
  riskScore,
  className,
}: EngagementScoreCardProps) {
  const config = getConfig(score, label);
  const Icon = config.icon;

  return (
    <div className={cn('p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', config.bgColor + '/10')}>
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Engajamento atual</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Score calculado com leitura, recência, urgência, seções vistas e sinais comerciais.
                  Leitura antiga não conta como engajamento atual.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className={cn('text-2xl font-bold', config.color)}>{score}</span>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Progress value={score} className="h-3 bg-muted" />
          <div
            className={cn('absolute top-0 left-0 h-3 rounded-full transition-all duration-500', config.bgColor)}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={cn('text-sm font-semibold', config.color)}>{config.label}</span>
          <span className="text-xs text-muted-foreground">de 100</span>
        </div>

        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {explanation || config.description}
        </p>

        {(typeof historicalScore === 'number' || typeof riskScore === 'number') && (
          <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-border/50">
            {typeof historicalScore === 'number' && (
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Histórico</div>
                <div className="text-sm font-semibold">{historicalScore}</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Atual</div>
              <div className={cn('text-sm font-semibold', config.color)}>{score}</div>
            </div>
            {typeof riskScore === 'number' && (
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risco</div>
                <div className={cn(
                  'text-sm font-semibold',
                  riskScore >= 60 ? 'text-red-500' : riskScore >= 35 ? 'text-amber-500' : 'text-emerald-500',
                )}>
                  {riskScore}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
