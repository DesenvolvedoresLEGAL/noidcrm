import { Target, CheckCircle2, TrendingUp, Rocket, BarChart3, Zap, Trophy, Calendar, Shield } from 'lucide-react';
import { ForecastKPIs } from '@/hooks/useForecastData';
import { formatCurrencyFull } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ForecastKPICardsProps {
  kpis: ForecastKPIs | null;
  isLoading?: boolean;
}

interface KPICardData {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  variant: 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'info' | 'purple';
  progress?: number;
  tooltip?: string;
}

const variantStyles = {
  primary: 'from-primary/20 to-primary/5 border-primary/30',
  success: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  warning: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  danger: 'from-red-500/20 to-red-500/5 border-red-500/30',
  info: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
  default: 'from-muted/20 to-muted/5 border-border',
};

const iconVariantStyles = {
  primary: 'text-primary bg-primary/10',
  success: 'text-emerald-500 bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-500/10',
  danger: 'text-red-500 bg-red-500/10',
  info: 'text-blue-500 bg-blue-500/10',
  purple: 'text-purple-500 bg-purple-500/10',
  default: 'text-muted-foreground bg-muted/50',
};

const valueVariantStyles = {
  primary: 'text-primary',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger: 'text-red-500',
  info: 'text-blue-500',
  purple: 'text-purple-500',
  default: 'text-foreground',
};

export function ForecastKPICards({ kpis, isLoading }: ForecastKPICardsProps) {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const getNRHSVariant = (): 'success' | 'warning' | 'danger' | 'purple' => {
    if (kpis.nrhsConfidence === 'high') return 'success';
    if (kpis.nrhsConfidence === 'moderate') return 'warning';
    if (kpis.nrhsConfidence === 'low') return 'danger';
    return 'danger';
  };

  const getNRHSLabel = () => {
    if (kpis.nrhsConfidence === 'high') return 'Alta';
    if (kpis.nrhsConfidence === 'moderate') return 'Moderada';
    if (kpis.nrhsConfidence === 'low') return 'Baixa';
    return 'Muito Baixa';
  };

  const cards: KPICardData[] = [
    {
      title: 'Meta do Período',
      value: formatCurrencyFull(kpis.goal),
      icon: Target,
      variant: 'primary',
    },
    {
      title: 'Fechado',
      value: formatCurrencyFull(kpis.closedRevenue),
      subtitle: `${kpis.closedPercentage.toFixed(0)}% da meta`,
      icon: CheckCircle2,
      variant: kpis.closedPercentage >= 100 ? 'success' : kpis.closedPercentage >= 70 ? 'warning' : 'danger',
      progress: Math.min(kpis.closedPercentage, 100),
    },
    {
      title: 'Commit',
      value: formatCurrencyFull(kpis.commitForecast),
      subtitle: `${kpis.commitPercentage.toFixed(0)}% da meta`,
      icon: TrendingUp,
      variant: kpis.commitPercentage >= 100 ? 'success' : kpis.commitPercentage >= 80 ? 'warning' : 'danger',
      progress: Math.min(kpis.commitPercentage, 100),
    },
    {
      title: 'Best Case',
      value: formatCurrencyFull(kpis.bestCaseForecast),
      subtitle: `${kpis.bestCasePercentage.toFixed(0)}% da meta`,
      icon: Rocket,
      variant: kpis.bestCasePercentage >= 100 ? 'success' : 'info',
      progress: Math.min(kpis.bestCasePercentage, 100),
    },
    {
      title: 'Confiança NRHS',
      value: `${kpis.nrhsAverage.toFixed(0)}%`,
      subtitle: getNRHSLabel(),
      icon: Shield,
      variant: getNRHSVariant(),
      progress: kpis.nrhsAverage,
      tooltip: `Mede a confiabilidade operacional do forecast. ${kpis.excludedByNrhsCount} deals excluídos por NRHS < 40.`,
    },
    {
      title: 'Cobertura',
      value: `${kpis.pipelineCoverage.toFixed(1)}x`,
      subtitle: 'Pipeline / Meta',
      icon: BarChart3,
      variant: kpis.pipelineCoverage >= 3 ? 'success' : kpis.pipelineCoverage >= 2 ? 'warning' : 'danger',
    },
    {
      title: 'Velocidade',
      value: formatCurrencyFull(kpis.velocityPerDay),
      subtitle: 'por dia',
      icon: Zap,
      variant: 'default',
    },
    {
      title: 'Win Rate',
      value: `${kpis.winRate.toFixed(0)}%`,
      subtitle: 'Histórico',
      icon: Trophy,
      variant: kpis.winRate >= 30 ? 'success' : kpis.winRate >= 20 ? 'warning' : 'danger',
    },
    {
      title: 'Dias Restantes',
      value: kpis.daysRemaining.toString(),
      subtitle: 'no período',
      icon: Calendar,
      variant: kpis.daysRemaining <= 5 ? 'danger' : kpis.daysRemaining <= 10 ? 'warning' : 'default',
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const cardContent = (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'relative overflow-hidden rounded-xl border bg-gradient-to-br p-3',
                'backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
                variantStyles[card.variant]
              )}
            >
              {/* Icon */}
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg mb-2',
                iconVariantStyles[card.variant]
              )}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Title */}
              <p className="text-xs text-muted-foreground font-medium mb-1 truncate">
                {card.title}
              </p>

              {/* Value */}
              <p className={cn(
                'text-lg font-bold tracking-tight truncate',
                valueVariantStyles[card.variant]
              )}>
                {card.value}
              </p>

              {/* Subtitle */}
              {card.subtitle && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {card.subtitle}
                </p>
              )}

              {/* Progress bar */}
              {card.progress !== undefined && (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(card.progress, 100)}%` }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                    className={cn(
                      'h-full rounded-full',
                      card.variant === 'success' && 'bg-emerald-500',
                      card.variant === 'warning' && 'bg-amber-500',
                      card.variant === 'danger' && 'bg-red-500',
                      card.variant === 'info' && 'bg-blue-500',
                      card.variant === 'purple' && 'bg-purple-500',
                      card.variant === 'primary' && 'bg-primary'
                    )}
                  />
                </div>
              )}
            </motion.div>
          );

          if (card.tooltip) {
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  {cardContent}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{card.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return cardContent;
        })}
      </div>
    </TooltipProvider>
  );
}
