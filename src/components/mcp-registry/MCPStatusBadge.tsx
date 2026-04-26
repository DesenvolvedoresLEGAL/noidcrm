import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'draft' | 'active' | 'inactive' | 'archived' | 'enabled' | 'disabled';

const styles: Record<Status, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  inactive: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  archived: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  enabled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  disabled: 'bg-muted text-muted-foreground',
};

const labels: Record<Status, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  inactive: 'Inativo',
  archived: 'Arquivado',
  enabled: 'Habilitado',
  disabled: 'Desabilitado',
};

export function MCPStatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', styles[status], className)}>
      {labels[status]}
    </Badge>
  );
}
