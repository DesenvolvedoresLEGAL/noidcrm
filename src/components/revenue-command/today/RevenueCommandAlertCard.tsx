import { AlertTriangle, Info, OctagonAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TodayAlert } from '@/hooks/revenue-command/useRevenueTodayCommand';

const STYLES = {
  info: {
    icon: Info,
    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400',
    border: 'border-l-blue-500/60',
  },
  warning: {
    icon: AlertTriangle,
    badge: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
    border: 'border-l-amber-500/60',
  },
  critical: {
    icon: OctagonAlert,
    badge: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
    border: 'border-l-red-500/60',
  },
} as const;

export function RevenueCommandAlertCard({ alert }: { alert: TodayAlert }) {
  const s = STYLES[alert.severity];
  const Icon = s.icon;
  return (
    <Card className={cn('border-l-4', s.border)}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-semibold">{alert.title}</h4>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', s.badge)}>
            {alert.severity}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{alert.source}</span>
          {alert.cta && (
            <Link
              to={alert.cta.to}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {alert.cta.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
