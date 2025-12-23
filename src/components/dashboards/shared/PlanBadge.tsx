import { Badge } from '@/components/ui/badge';
import { usePlanType } from '@/hooks/usePlanType';
import { Brain, Bot, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  showTrialDays?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PlanBadge({ showTrialDays = false, className, size = 'md' }: PlanBadgeProps) {
  const { 
    planDisplayName, 
    isAutonomous, 
    isNeural, 
    isTrial, 
    trialDaysRemaining,
    isLoading 
  } = usePlanType();

  if (isLoading) {
    return <div className="h-6 w-20 bg-muted/30 rounded animate-pulse" />;
  }

  const Icon = isAutonomous ? Bot : isNeural ? Brain : Zap;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <Badge 
      variant="outline"
      className={cn(
        'font-medium',
        sizeClasses[size],
        isAutonomous && 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
        isNeural && 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
        !isAutonomous && !isNeural && 'bg-muted/50 border-border text-muted-foreground',
        className
      )}
    >
      <Icon className={iconSize[size]} />
      <span>{planDisplayName}</span>
      {showTrialDays && isTrial && trialDaysRemaining > 0 && (
        <span className="opacity-70">• {trialDaysRemaining}d trial</span>
      )}
    </Badge>
  );
}
