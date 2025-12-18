import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface FilterBarProps {
  activeFilter?: string;
  statusFilter?: 'pending' | 'completed' | 'all';
  stats: {
    overdue: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    scheduled: number;
    completed?: number;
  };
  onFilterChange: (filter: string | undefined) => void;
  onStatusFilterChange?: (status: 'pending' | 'completed' | 'all') => void;
}

export function FilterBar({ 
  activeFilter, 
  statusFilter = 'pending',
  stats, 
  onFilterChange,
  onStatusFilterChange 
}: FilterBarProps) {
  const filters = [
    { id: 'overdue', label: 'Atrasadas', count: stats.overdue, variant: 'destructive' as const },
    { id: 'today', label: 'Hoje', count: stats.today, variant: 'default' as const },
    { id: 'this_week', label: 'Essa Semana', count: stats.thisWeek, variant: 'default' as const },
    { id: 'this_month', label: 'Esse Mês', count: stats.thisMonth, variant: 'default' as const },
    { id: 'scheduled', label: 'Planejadas', count: stats.scheduled, variant: 'default' as const },
  ];

  const statusFilters = [
    { id: 'pending' as const, label: 'Pendentes' },
    { id: 'completed' as const, label: 'Concluídas' },
    { id: 'all' as const, label: 'Todas' },
  ];

  return (
    <div className="space-y-3">
      {/* Status Filter */}
      {onStatusFilterChange && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground mr-2">Status:</span>
          {statusFilters.map((filter) => (
            <Button
              key={filter.id}
              variant={statusFilter === filter.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => onStatusFilterChange(filter.id)}
              className={cn(
                'gap-2',
                statusFilter === filter.id && 'bg-primary text-primary-foreground'
              )}
            >
              {filter.id === 'completed' && <CheckCircle2 className="h-3 w-3" />}
              {filter.label}
            </Button>
          ))}
        </div>
      )}
      
      {/* Date Filters - only show when status is pending */}
      {statusFilter === 'pending' && (
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
      )}
    </div>
  );
}
