import { Badge } from '@/components/ui/badge';
import { Eye, Lightbulb, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  can_read: boolean;
  can_suggest: boolean;
  can_execute: boolean;
  className?: string;
}

const off = 'bg-muted text-muted-foreground';

export function MCPPermissionActionBadges({ can_read, can_suggest, can_execute, className }: Props) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      <Badge
        variant="secondary"
        className={cn(
          'gap-1 font-medium',
          can_read ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : off,
        )}
      >
        <Eye className="h-3 w-3" /> Read
      </Badge>
      <Badge
        variant="secondary"
        className={cn(
          'gap-1 font-medium',
          can_suggest ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' : off,
        )}
      >
        <Lightbulb className="h-3 w-3" /> Suggest
      </Badge>
      <Badge
        variant="secondary"
        className={cn(
          'gap-1 font-medium',
          can_execute ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : off,
        )}
      >
        <Zap className="h-3 w-3" /> Execute
      </Badge>
    </div>
  );
}
