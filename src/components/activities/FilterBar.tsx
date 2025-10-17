import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  activeFilter?: string;
  stats: {
    overdue: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    scheduled: number;
  };
  onFilterChange: (filter: string | undefined) => void;
}

export function FilterBar({ activeFilter, stats, onFilterChange }: FilterBarProps) {
  const filters = [
    { id: 'overdue', label: 'Atrasadas', count: stats.overdue, variant: 'destructive' as const },
    { id: 'today', label: 'Hoje', count: stats.today, variant: 'default' as const },
    { id: 'this_week', label: 'Essa Semana', count: stats.thisWeek, variant: 'default' as const },
    { id: 'this_month', label: 'Esse Mês', count: stats.thisMonth, variant: 'default' as const },
    { id: 'scheduled', label: 'Planejadas', count: stats.scheduled, variant: 'default' as const },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={activeFilter === filter.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(activeFilter === filter.id ? undefined : filter.id)}
          className={cn(
            'gap-2',
            activeFilter === filter.id && 'bg-primary text-primary-foreground'
          )}
        >
          {filter.label}
          <Badge
            variant={filter.variant}
            className={cn(
              'ml-1',
              activeFilter === filter.id ? 'bg-primary-foreground/20 text-primary-foreground' : ''
            )}
          >
            {filter.count}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
