import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Phone, Video, Mail, MessageSquare, CheckSquare, FileText, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateActivityModal } from '@/components/activities/CreateActivityModal';
import { EditActivityModal } from '@/components/activities/EditActivityModal';
import { ActivityCard } from '@/components/activities/ActivityCard';
import { createActivity, completeActivity, markActivityAsNoShow, deleteActivity } from '@/services/crm/activities';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';


interface AccountActivitiesTabProps {
  accountId: string;
  accountName: string;
}

export function AccountActivitiesTab({ accountId, accountName }: AccountActivitiesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['account-activities', accountId, statusFilter, typeFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select(`
          *,
          accounts!inner(id, razao_social, nome_fantasia),
          contacts(id, nome),
          opportunities(id, title)
        `)
        .eq('account_id', accountId)
        .order('scheduled_date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });

  const createMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
      queryClient.invalidateQueries({ queryKey: ['account-details', accountId] });
      toast({ title: 'Atividade criada com sucesso!' });
      setCreateModalOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar atividade',
        description: error.message,
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
      toast({ title: 'Atividade concluída!' });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: markActivityAsNoShow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
      toast({ title: 'Atividade marcada como no-show' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
      toast({ title: 'Atividade excluída' });
    },
  });

  const handleEdit = (activity: any) => {
    setSelectedActivity(activity);
    setEditModalOpen(true);
  };

  // Calcular estatísticas
  const stats = {
    total: activities.length,
    pending: activities.filter(a => a.status === 'pending').length,
    completed: activities.filter(a => a.status === 'completed').length,
    noShow: activities.filter(a => a.status === 'no_show').length,
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'meeting': return <Video className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      default: return <CheckSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.noShow}</div>
            <p className="text-xs text-muted-foreground">No-show</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Atividades</CardTitle>
          <Button onClick={() => setCreateModalOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Atividade
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atividades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="note">Anotação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <CheckSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma atividade</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Crie a primeira atividade para {accountName}
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Atividade
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={{
                    ...activity,
                    type: activity.type as 'call' | 'email' | 'meeting' | 'note' | 'task' | 'whatsapp',
                    status: (activity.status as 'pending' | 'completed' | 'cancelled' | 'no_show') || 'pending',
                    sentiment: activity.sentiment as 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative' | undefined,
                    sync_metadata: activity.sync_metadata as Record<string, any> | undefined,
                  }}
                  onComplete={completeMutation.mutate}
                  onNoShow={noShowMutation.mutate}
                  onEdit={handleEdit}
                  onDelete={deleteMutation.mutate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateActivityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={createMutation.mutate}
        defaultAccountId={accountId}
      />

      {selectedActivity && (
        <EditActivityModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          activity={selectedActivity}
          onSubmit={(data) => {
            // Handle edit submission
            queryClient.invalidateQueries({ queryKey: ['account-activities', accountId] });
            setEditModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
