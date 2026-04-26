import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Risk = 'low' | 'medium' | 'high' | 'critical';

const styles: Record<Risk, string> = {
  low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const labels: Record<Risk, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

export function MCPRiskBadge({ risk, className }: { risk: Risk; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', styles[risk], className)}>
      {labels[risk]}
    </Badge>
  );
}
