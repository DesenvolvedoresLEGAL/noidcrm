import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { TicketStatusBadge } from './TicketStatusBadge';
import { SupportTicket, TicketResponse, useSupportTickets } from '@/hooks/useSupportTickets';
import { ArrowLeft, Send, Clock, User, Headphones, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

const moduleLabels: Record<string, string> = {
  pipeline: 'Pipeline de Vendas',
  forecast: 'Forecast',
  proposals: 'Propostas',
  scoring: 'Scoring de Leads',
  reports: 'Relatórios',
  intelligence: 'Inteligência (IA)',
  activities: 'Atividades',
  accounts: 'Contas e Contatos',
  roleplay: 'Roleplay',
  settings: 'Configurações',
  billing: 'Faturamento e Planos',
  authentication: 'Login e Acesso',
  other: 'Outro',
};

const typeLabels: Record<string, string> = {
  bug: '🐛 Bug / Erro',
  question: '❓ Dúvida',
  improvement: '💡 Sugestão de melhoria',
  billing: '💳 Financeiro / Cobrança',
  other: '📋 Outro',
};

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const { getTicketById, addResponse, closeTicket } = useSupportTickets();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const loadTicket = async () => {
      setLoading(true);
      const result = await getTicketById(ticketId);
      if (result) {
        setTicket(result.ticket);
        setResponses(result.responses);
      }
      setLoading(false);
    };
    loadTicket();
  }, [ticketId, getTicketById]);

  const handleSendResponse = async () => {
    if (!newMessage.trim() || !ticket) return;
    
    setSending(true);
    const success = await addResponse(ticket.id, newMessage);
    if (success) {
      setNewMessage('');
      // Reload responses
      const result = await getTicketById(ticketId);
      if (result) setResponses(result.responses);
    }
    setSending(false);
  };

  const handleCloseTicket = async () => {
    if (!ticket) return;
    
    setClosing(true);
    const success = await closeTicket(ticket.id);
    if (success) {
      setTicket((prev) => prev ? { ...prev, status: 'closed' } : null);
    }
    setClosing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Chamado não encontrado</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    );
  }

  const slaDeadline = ticket.slaDeadline ? parseISO(ticket.slaDeadline) : null;
  const isOverdue = slaDeadline && isPast(slaDeadline) && !['resolved', 'closed'].includes(ticket.status);
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">
              {ticket.ticketNumber}
            </span>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">{ticket.subject}</h1>
        </div>
        {!isClosed && (
          <Button variant="outline" onClick={handleCloseTicket} disabled={closing}>
            {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Marcar como resolvido'}
          </Button>
        )}
      </div>

      {/* Ticket Info */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipo</p>
              <p className="text-sm font-medium">{typeLabels[ticket.requestType] || ticket.requestType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Módulo</p>
              <p className="text-sm font-medium">
                {ticket.affectedModule ? moduleLabels[ticket.affectedModule] || ticket.affectedModule : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Criado em</p>
              <p className="text-sm font-medium">
                {format(parseISO(ticket.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">SLA</p>
              <p className={cn('text-sm font-medium', isOverdue && 'text-destructive')}>
                {slaDeadline ? (
                  isOverdue ? 'Expirado' : formatDistanceToNow(slaDeadline, { locale: ptBR, addSuffix: true })
                ) : '-'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Descrição</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Responses Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de respostas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma resposta ainda. Nossa equipe responderá em breve.
            </p>
          ) : (
            responses.map((response) => (
              <div
                key={response.id}
                className={cn(
                  'p-4 rounded-lg',
                  response.isSupportTeam ? 'bg-primary/5 border border-primary/20' : 'bg-muted'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    'p-1.5 rounded-full',
                    response.isSupportTeam ? 'bg-primary/10' : 'bg-muted-foreground/10'
                  )}>
                    {response.isSupportTeam ? (
                      <Headphones className="h-3 w-3 text-primary" />
                    ) : (
                      <User className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {response.isSupportTeam ? 'Suporte NOID' : 'Você'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(response.createdAt), { locale: ptBR, addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{response.message}</p>
              </div>
            ))
          )}

          {/* Add Response */}
          {!isClosed && (
            <div className="pt-4 border-t">
              <Textarea
                placeholder="Escreva uma resposta..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end mt-3">
                <Button onClick={handleSendResponse} disabled={sending || !newMessage.trim()}>
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
