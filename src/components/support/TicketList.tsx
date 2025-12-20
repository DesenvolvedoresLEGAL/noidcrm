import { useState } from 'react';
import { SupportTicket, TicketStatus } from '@/hooks/useSupportTickets';
import { TicketCard } from './TicketCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TicketListProps {
  tickets: SupportTicket[];
  loading: boolean;
  onTicketClick: (ticketId: string) => void;
  showViewAll?: boolean;
  maxItems?: number;
}

export function TicketList({
  tickets,
  loading,
  onTicketClick,
  showViewAll = false,
  maxItems,
}: TicketListProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filteredTickets = tickets.filter((t) => {
    if (filter === 'open') return ['open', 'in_progress', 'waiting_response'].includes(t.status);
    if (filter === 'resolved') return ['resolved', 'closed'].includes(t.status);
    return true;
  });

  const displayedTickets = maxItems ? filteredTickets.slice(0, maxItems) : filteredTickets;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex p-4 rounded-full bg-muted mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Nenhum chamado ainda</h3>
        <p className="text-sm text-muted-foreground">
          Quando você abrir um chamado, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todos ({tickets.length})</TabsTrigger>
          <TabsTrigger value="open">
            Abertos ({tickets.filter((t) => ['open', 'in_progress', 'waiting_response'].includes(t.status)).length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolvidos ({tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {displayedTickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket.id)}
          />
        ))}
      </div>

      {showViewAll && filteredTickets.length > (maxItems || 0) && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/app/support/tickets')}
        >
          Ver todos os chamados
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
