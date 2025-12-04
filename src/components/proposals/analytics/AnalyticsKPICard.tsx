import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsKPICardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning';
  className?: string;
}

const variantStyles = {
  default: {
    bg: 'bg-muted/50',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
  },
  primary: {
    bg: 'bg-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  success: {
    bg: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
};

export function AnalyticsKPICard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  variant = 'default',
  className,
}: AnalyticsKPICardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all hover:shadow-sm',
        styles.bg,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg', styles.iconBg)}>
          <Icon className={cn('h-4 w-4', styles.iconColor)} />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              trend.isPositive
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-red-500/10 text-red-500'
            )}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
