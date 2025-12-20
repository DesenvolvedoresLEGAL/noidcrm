import { Card, CardContent } from '@/components/ui/card';
import { TicketStatusBadge } from './TicketStatusBadge';
import { SupportTicket } from '@/hooks/useSupportTickets';
import { ChevronRight, Clock } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TicketCardProps {
  ticket: SupportTicket;
  onClick: () => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const slaDeadline = ticket.slaDeadline ? parseISO(ticket.slaDeadline) : null;
  const isOverdue = slaDeadline && isPast(slaDeadline) && !['resolved', 'closed'].includes(ticket.status);
  const slaText = slaDeadline
    ? formatDistanceToNow(slaDeadline, { locale: ptBR, addSuffix: true })
    : null;

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">
                {ticket.ticketNumber}
              </span>
              <TicketStatusBadge status={ticket.status} />
            </div>
            <h4 className="font-medium text-foreground truncate">{ticket.subject}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {ticket.description}
            </p>
            {slaText && !['resolved', 'closed'].includes(ticket.status) && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs mt-2',
                  isOverdue ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                <Clock className="h-3 w-3" />
                <span>{isOverdue ? 'SLA expirado' : `SLA ${slaText}`}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
