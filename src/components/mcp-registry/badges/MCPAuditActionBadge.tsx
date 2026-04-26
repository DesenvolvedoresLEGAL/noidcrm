import { Badge } from '@/components/ui/badge';

const COLOR: Record<string, string> = {
  created: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  updated: 'bg-muted text-muted-foreground',
  enabled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  disabled: 'bg-muted text-muted-foreground',
  activated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  deactivated: 'bg-muted text-muted-foreground',
  archived: 'bg-muted text-muted-foreground',
  system_seed_created: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  system_seed_verified: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  simulated_invocation_created: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  blocked_invocation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

export function MCPAuditActionBadge({ action }: { action: string }) {
  const cls = COLOR[action] ?? 'bg-muted text-muted-foreground';
  return (
    <Badge className={`hover:${cls.split(' ')[0]} ${cls}`} variant="secondary">
      {action}
    </Badge>
  );
}
