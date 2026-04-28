import { Badge } from '@/components/ui/badge';
import type { CloserPaceSeverity, CloserPaceStatus } from '@/types/dashboard/closer';
import { CheckCircle2, TrendingUp, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

const map: Record<CloserPaceSeverity, { variant: any; className: string; Icon: any }> = {
  success: {
    variant: 'secondary',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    Icon: TrendingUp,
  },
  info: {
    variant: 'secondary',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
    Icon: CheckCircle2,
  },
  attention: {
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    Icon: AlertTriangle,
  },
  critical: {
    variant: 'destructive',
    className: '',
    Icon: ShieldAlert,
  },
  warning: {
    variant: 'outline',
    className: 'border-muted-foreground/40 text-muted-foreground',
    Icon: Info,
  },
};

export function CloserPaceStatusBadge({
  status,
  severity,
}: {
  status: CloserPaceStatus;
  severity: CloserPaceSeverity;
}) {
  const cfg = map[severity];
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant} className={`gap-1 ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
