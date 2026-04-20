import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Mail, FileText, Activity, History, Sparkles, Check, X } from 'lucide-react';
import { getUnifiedTimeline, TimelineEvent } from '@/services/crm/timeline';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnifiedTimelineProps {
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  limit?: number;
}

export function UnifiedTimeline({ opportunityId, accountId, contactId, limit = 50 }: UnifiedTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [opportunityId, accountId, contactId]);

  const loadTimeline = async () => {
    try {
      const data = await getUnifiedTimeline({
        opportunity_id: opportunityId,
        account_id: accountId,
        contact_id: contactId,
        limit,
      });
      setEvents(data);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (event: TimelineEvent) => {
    if (event.type === 'agent_approval') {
      const status = event.metadata?.status;
      if (status === 'approved') return <Check className="h-4 w-4 text-emerald-600" />;
      if (status === 'rejected') return <X className="h-4 w-4 text-destructive" />;
      return <Sparkles className="h-4 w-4 text-amber-600" />;
    }
    switch (event.type) {
      case 'activity':
        return <Activity className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'audit':
        return <History className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (event: TimelineEvent) => {
    if (event.type === 'agent_approval') {
      const status = event.metadata?.status;
      if (status === 'approved') return 'Agente · Aprovado';
      if (status === 'rejected') return 'Agente · Rejeitado';
      return 'Agente · Aprovação pendente';
    }
    switch (event.type) {
      case 'activity':
        return 'Atividade';
      case 'email':
        return 'Email';
      case 'note':
        return 'Nota';
      case 'audit':
        return 'Mudança';
      default:
        return event.type;
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd MMM 'às' HH:mm", { locale: ptBR });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle>Timeline de Atividades</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento registrado
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={event.id} className="relative pl-8 pb-4">
                  {index < events.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-border" />
                  )}
                  <div className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2 ${
                    event.type === 'agent_approval'
                      ? event.metadata?.status === 'approved'
                        ? 'border-emerald-500'
                        : event.metadata?.status === 'rejected'
                        ? 'border-destructive'
                        : 'border-amber-500'
                      : 'border-primary'
                  }`}>
                    {getIcon(event)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {getTypeLabel(event)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{event.title}</p>
                    {event.metadata && event.type === 'email' && (
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        <p>Para: {event.metadata.to?.join(', ')}</p>
                        {event.metadata.opened_count > 0 && (
                          <p className="text-primary">
                            ✓ Aberto {event.metadata.opened_count}x
                          </p>
                        )}
                      </div>
                    )}
                    {event.metadata && event.type === 'audit' && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <p>
                          Campo: <span className="font-medium">{event.metadata.field_name}</span>
                        </p>
                      </div>
                    )}
                    {event.type === 'agent_approval' && event.metadata && (
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        {event.metadata.recipient_email && (
                          <p>Destinatário: {event.metadata.recipient_email}</p>
                        )}
                        {event.metadata.agent_name && (
                          <p>Agente: <span className="font-medium">{event.metadata.agent_name}</span></p>
                        )}
                        {event.metadata.status === 'pending' && event.opportunity_id && (
                          <Button asChild size="sm" variant="outline" className="mt-2 h-7 gap-1.5">
                            <Link to={`/app/opportunities/${event.opportunity_id}?tab=emails&approval=${event.metadata.queue_id || event.id}`}>
                              <Sparkles className="h-3 w-3" />
                              Revisar
                            </Link>
                          </Button>
                        )}
                        {event.metadata.status === 'rejected' && event.metadata.rejection_reason && (
                          <p className="italic">Motivo: {event.metadata.rejection_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
