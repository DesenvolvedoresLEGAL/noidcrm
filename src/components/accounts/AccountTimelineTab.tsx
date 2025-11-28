import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  FileText, 
  Mail, 
  Phone, 
  Video, 
  TrendingUp, 
  TrendingDown,
  Edit,
  MessageSquare,
  Calendar,
  Building2,
  Clock
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface AccountTimelineTabProps {
  accountId: string;
  accountName: string;
}

interface TimelineEvent {
  id: string;
  type: 'account_created' | 'activity' | 'note' | 'email' | 'opportunity_created' | 'opportunity_won' | 'opportunity_lost' | 'opportunity_stage_change' | 'contact_created';
  title: string;
  description?: string;
  timestamp: string;
  icon: any;
  iconColor: string;
  metadata?: Record<string, any>;
}

export function AccountTimelineTab({ accountId, accountName }: AccountTimelineTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const { data: timelineEvents = [], isLoading } = useQuery({
    queryKey: ['account-timeline', accountId, eventFilter],
    queryFn: async () => {
      const events: TimelineEvent[] = [];

      // 1. Buscar criação da conta
      const { data: account } = await supabase
        .from('accounts')
        .select('created_at, razao_social')
        .eq('id', accountId)
        .single();

      if (account && (eventFilter === 'all' || eventFilter === 'account')) {
        events.push({
          id: `account-${accountId}`,
          type: 'account_created',
          title: 'Conta criada',
          description: `${account.razao_social} foi adicionada ao sistema`,
          timestamp: account.created_at,
          icon: Building2,
          iconColor: 'text-blue-600',
        });
      }

      // 2. Buscar atividades
      if (eventFilter === 'all' || eventFilter === 'activity') {
        const { data: activities } = await supabase
          .from('activities')
          .select(`
            id,
            title,
            type,
            description,
            scheduled_date,
            status,
            created_at
          `)
          .eq('account_id', accountId)
          .order('scheduled_date', { ascending: false });

        activities?.forEach((activity) => {
          const activityIcons: Record<string, any> = {
            call: Phone,
            meeting: Video,
            email: Mail,
            whatsapp: MessageSquare,
            task: FileText,
            note: FileText,
          };

          events.push({
            id: activity.id,
            type: 'activity',
            title: activity.title,
            description: activity.description || undefined,
            timestamp: activity.scheduled_date || activity.created_at,
            icon: activityIcons[activity.type] || FileText,
            iconColor: activity.status === 'completed' ? 'text-green-600' : 'text-blue-600',
            metadata: { status: activity.status, type: activity.type },
          });
        });
      }

      // 3. Buscar notas de oportunidades vinculadas
      if (eventFilter === 'all' || eventFilter === 'note') {
        const { data: notes } = await supabase
          .from('opportunity_notes')
          .select(`
            id,
            content,
            created_at,
            opportunities!inner(account_id, title)
          `)
          .eq('opportunities.account_id', accountId)
          .order('created_at', { ascending: false });

        notes?.forEach((note: any) => {
          events.push({
            id: note.id,
            type: 'note',
            title: 'Nota adicionada',
            description: note.content,
            timestamp: note.created_at,
            icon: FileText,
            iconColor: 'text-yellow-600',
            metadata: { opportunityTitle: note.opportunities?.title },
          });
        });
      }

      // 4. Buscar emails de oportunidades
      if (eventFilter === 'all' || eventFilter === 'email') {
        const { data: emails } = await supabase
          .from('opportunity_emails')
          .select(`
            id,
            subject,
            body,
            sent_at,
            opportunities!inner(account_id, title)
          `)
          .eq('opportunities.account_id', accountId)
          .order('sent_at', { ascending: false });

        emails?.forEach((email: any) => {
          events.push({
            id: email.id,
            type: 'email',
            title: email.subject,
            description: email.body?.substring(0, 200) + '...',
            timestamp: email.sent_at,
            icon: Mail,
            iconColor: 'text-purple-600',
            metadata: { opportunityTitle: email.opportunities?.title },
          });
        });
      }

      // 5. Buscar criação de oportunidades
      if (eventFilter === 'all' || eventFilter === 'opportunity') {
        const { data: opportunities } = await supabase
          .from('opportunities')
          .select('id, title, created_at, status, valor_previsto')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        opportunities?.forEach((opp) => {
          events.push({
            id: `opp-created-${opp.id}`,
            type: 'opportunity_created',
            title: 'Oportunidade criada',
            description: `${opp.title} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_previsto || 0)}`,
            timestamp: opp.created_at,
            icon: TrendingUp,
            iconColor: 'text-green-600',
          });

          if (opp.status === 'won') {
            events.push({
              id: `opp-won-${opp.id}`,
              type: 'opportunity_won',
              title: 'Oportunidade ganha! 🎉',
              description: opp.title,
              timestamp: opp.created_at, // Idealmente seria uma data de conclusão
              icon: TrendingUp,
              iconColor: 'text-green-600',
            });
          }

          if (opp.status === 'lost') {
            events.push({
              id: `opp-lost-${opp.id}`,
              type: 'opportunity_lost',
              title: 'Oportunidade perdida',
              description: opp.title,
              timestamp: opp.created_at,
              icon: TrendingDown,
              iconColor: 'text-red-600',
            });
          }
        });
      }

      // 6. Buscar mudanças de estágio via audit_log
      if (eventFilter === 'all' || eventFilter === 'opportunity') {
        const { data: stageChanges } = await supabase
          .from('audit_log')
          .select(`
            id,
            action,
            entity_id,
            field_name,
            old_value,
            new_value,
            created_at,
            metadata
          `)
          .eq('entity_type', 'opportunity')
          .eq('action', 'stage_moved')
          .order('created_at', { ascending: false })
          .limit(50);

        if (stageChanges) {
          // Filtrar apenas oportunidades desta conta
          const oppIds = new Set(
            (await supabase
              .from('opportunities')
              .select('id')
              .eq('account_id', accountId))
              .data?.map(o => o.id) || []
          );

          stageChanges
            .filter(sc => oppIds.has(sc.entity_id || ''))
            .forEach((change) => {
              events.push({
                id: change.id,
                type: 'opportunity_stage_change',
                title: 'Mudança de estágio',
                description: `Oportunidade avançou no pipeline`,
                timestamp: change.created_at || '',
                icon: TrendingUp,
                iconColor: 'text-blue-600',
              });
            });
        }
      }

      // 7. Buscar criação de contatos
      if (eventFilter === 'all' || eventFilter === 'contact') {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, nome, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false });

        contacts?.forEach((contact) => {
          events.push({
            id: `contact-${contact.id}`,
            type: 'contact_created',
            title: 'Contato adicionado',
            description: contact.nome,
            timestamp: contact.created_at,
            icon: MessageSquare,
            iconColor: 'text-indigo-600',
          });
        });
      }

      // Ordenar por timestamp decrescente
      return events.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    enabled: !!accountId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUser?.user?.id) throw new Error('Usuário não autenticado');

      // Buscar organização
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('Organização não encontrada');

      // Buscar primeira oportunidade da conta para vincular a nota
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('id')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!opportunity) {
        throw new Error('Nenhuma oportunidade encontrada para esta conta. Crie uma oportunidade primeiro.');
      }

      const { error } = await supabase.from('opportunity_notes').insert({
        opportunity_id: opportunity.id,
        organization_id: orgId,
        created_by: currentUser.user.id,
        content,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-timeline', accountId] });
      toast({ title: 'Nota adicionada com sucesso!' });
      setNewNote('');
      setAddingNote(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar nota',
        description: error.message,
      });
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Digite o conteúdo da nota',
      });
      return;
    }
    addNoteMutation.mutate(newNote.trim());
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return timestamp;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Adicionar Nota Rápida */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar Nota Rápida</CardTitle>
        </CardHeader>
        <CardContent>
          {!addingNote ? (
            <Button onClick={() => setAddingNote(true)} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nota
            </Button>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder="Digite sua nota sobre esta conta..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddNote} disabled={addNoteMutation.isPending}>
                  {addNoteMutation.isPending ? 'Salvando...' : 'Salvar Nota'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setAddingNote(false);
                  setNewNote('');
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timeline - {accountName}</CardTitle>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              <SelectItem value="activity">Atividades</SelectItem>
              <SelectItem value="note">Notas</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="opportunity">Oportunidades</SelectItem>
              <SelectItem value="contact">Contatos</SelectItem>
              <SelectItem value="account">Conta</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {timelineEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum evento encontrado</p>
              <p className="text-sm mt-1">Os eventos aparecerão aqui conforme você interage com a conta</p>
            </div>
          ) : (
            <div className="relative">
              {/* Linha vertical da timeline */}
              <div className="absolute left-[25px] top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-6">
                {timelineEvents.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="relative flex gap-4 group">
                      {/* Ícone */}
                      <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-background bg-card shadow-sm ${event.iconColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Conteúdo */}
                      <Card className="flex-1 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm mb-1">{event.title}</h4>
                              {event.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {formatTimestamp(event.timestamp)}
                            </Badge>
                          </div>

                          {event.metadata && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {event.metadata.opportunityTitle && (
                                <Badge variant="secondary" className="text-xs">
                                  {event.metadata.opportunityTitle}
                                </Badge>
                              )}
                              {event.metadata.status && (
                                <Badge 
                                  variant={event.metadata.status === 'completed' ? 'default' : 'outline'} 
                                  className="text-xs"
                                >
                                  {event.metadata.status === 'completed' ? 'Concluída' : 
                                   event.metadata.status === 'pending' ? 'Pendente' : 
                                   event.metadata.status}
                                </Badge>
                              )}
                              {event.metadata.type && (
                                <Badge variant="outline" className="text-xs">
                                  {event.metadata.type === 'call' ? 'Ligação' :
                                   event.metadata.type === 'meeting' ? 'Reunião' :
                                   event.metadata.type === 'email' ? 'Email' :
                                   event.metadata.type === 'whatsapp' ? 'WhatsApp' :
                                   event.metadata.type}
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
