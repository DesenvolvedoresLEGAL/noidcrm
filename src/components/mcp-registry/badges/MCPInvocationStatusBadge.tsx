import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, Loader2, Clock, MinusCircle } from 'lucide-react';
import type { McpExecutionStatus } from '@/services/mcp-registry/types';

const MAP: Record<
  McpExecutionStatus,
  { label: string; className: string; Icon: typeof Shield }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Clock,
  },
  running: {
    label: 'Running',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 hover:bg-sky-100',
    Icon: Loader2,
  },
  success: {
    label: 'Success',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive hover:bg-destructive/10',
    Icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: MinusCircle,
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100',
    Icon: Shield,
  },
};

export function MCPInvocationStatusBadge({ status }: { status: McpExecutionStatus | string }) {
  const cfg = MAP[status as McpExecutionStatus] ?? {
    label: String(status),
    className: 'bg-muted text-muted-foreground hover:bg-muted',
    Icon: Clock,
  };
  return (
    <Badge className={`gap-1 ${cfg.className}`} variant="secondary">
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
