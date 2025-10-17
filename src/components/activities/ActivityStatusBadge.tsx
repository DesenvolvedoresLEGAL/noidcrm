import { Badge } from '@/components/ui/badge';

interface ActivityStatusBadgeProps {
  status: 'pending' | 'completed' | 'no_show' | 'cancelled';
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  },
  completed: {
    label: 'Concluída',
    className: 'bg-green-100 text-green-700 hover:bg-green-100',
  },
  no_show: {
    label: 'No-show',
    className: 'bg-red-100 text-red-700 hover:bg-red-100',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'bg-muted text-muted-foreground hover:bg-muted',
  },
};

export function ActivityStatusBadge({ status }: ActivityStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
