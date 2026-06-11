import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'primary' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'teal';
  loading?: boolean;
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  indigo: 'bg-indigo-500/10 text-indigo-600',
  amber: 'bg-amber-500/10 text-amber-600',
  rose: 'bg-rose-500/10 text-rose-600',
  teal: 'bg-teal-500/10 text-teal-600',
};

export function PerformanceMetricCard({ icon: Icon, label, value, hint, accent = 'primary', loading }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-24 mt-2" />
            ) : (
              <p className="text-2xl font-bold mt-1 truncate">{value}</p>
            )}
            {hint && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            )}
          </div>
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', accentMap[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
