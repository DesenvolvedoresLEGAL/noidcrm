import { Badge } from '@/components/ui/badge';
import type { McpPermissionStatus } from '@/services/mcp-registry/types';
import { cn } from '@/lib/utils';

const styles: Record<McpPermissionStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  inactive: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  archived: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const labels: Record<McpPermissionStatus, string> = {
  active: 'Ativa',
  inactive: 'Inativa',
  archived: 'Arquivada',
};

export function MCPPermissionStatusBadge({
  status,
  className,
}: {
  status: McpPermissionStatus;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn('font-medium', styles[status], className)}>
      {labels[status]}
    </Badge>
  );
}
