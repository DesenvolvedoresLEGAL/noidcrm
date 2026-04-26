import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
  variant?: 'default' | 'success' | 'warning' | 'muted';
  className?: string;
}

const variantClasses: Record<NonNullable<Props['variant']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  muted: 'bg-muted text-muted-foreground',
};

export function MCPMetricCard({ label, value, icon: Icon, hint, variant = 'default', className }: Props) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4 flex items-start gap-3">
        {Icon && (
          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', variantClasses[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</div>
          <div className="text-2xl font-bold text-foreground mt-0.5 leading-none">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
