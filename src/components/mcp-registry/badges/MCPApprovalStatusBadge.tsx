import { Badge } from '@/components/ui/badge';
import type { McpApprovalStatus } from '@/services/mcp-registry/types';
import { CheckCircle2, Clock, XCircle, MinusCircle, AlertCircle } from 'lucide-react';

const MAP: Record<McpApprovalStatus, { label: string; className: string; Icon: typeof Clock }> = {
  not_required: { label: 'N/A', className: 'bg-muted text-muted-foreground hover:bg-muted', Icon: MinusCircle },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100', Icon: Clock },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive hover:bg-destructive/10', Icon: XCircle },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground hover:bg-muted', Icon: AlertCircle },
};

export function MCPApprovalStatusBadge({ status }: { status: McpApprovalStatus | string }) {
  const cfg = MAP[status as McpApprovalStatus] ?? MAP.not_required;
  return (
    <Badge className={`gap-1 ${cfg.className}`} variant="secondary">
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}
