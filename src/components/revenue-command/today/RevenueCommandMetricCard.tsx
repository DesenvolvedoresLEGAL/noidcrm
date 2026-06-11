import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  helper?: string;
  source?: string;
  icon?: LucideIcon;
  loading?: boolean;
  empty?: boolean;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
};

export function RevenueCommandMetricCard({
  label,
  value,
  helper,
  source,
  icon: Icon,
  loading,
  empty,
  tone = 'default',
}: Props) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
          </span>
          {source && <span className="text-[10px] uppercase tracking-wide opacity-70">{source}</span>}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <div className={cn('text-2xl font-semibold leading-tight', TONE[tone])}>
            {empty ? '—' : value}
          </div>
        )}
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}
