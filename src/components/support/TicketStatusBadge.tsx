import { Badge } from '@/components/ui/badge';
import { TicketStatus } from '@/hooks/useSupportTickets';
import { cn } from '@/lib/utils';

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

const statusConfig: Record<TicketStatus, { label: string; className: string }> = {
  open: {
    label: 'Aberto',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  in_progress: {
    label: 'Em análise',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  },
  waiting_response: {
    label: 'Aguardando resposta',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  },
  resolved: {
    label: 'Resolvido',
    className: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  closed: {
    label: 'Fechado',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.open;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
