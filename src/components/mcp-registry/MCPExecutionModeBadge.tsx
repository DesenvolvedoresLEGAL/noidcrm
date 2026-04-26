import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Mode = 'read_only' | 'suggestion_only' | 'approval_required' | 'automatic_controlled';

const styles: Record<Mode, string> = {
  read_only: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  suggestion_only: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  approval_required: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  automatic_controlled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

const labels: Record<Mode, string> = {
  read_only: 'Read-only',
  suggestion_only: 'Sugestão',
  approval_required: 'Aprovação',
  automatic_controlled: 'Auto Controlado',
};

export function MCPExecutionModeBadge({ mode, className }: { mode: Mode; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', styles[mode], className)}>
      {labels[mode]}
    </Badge>
  );
}
