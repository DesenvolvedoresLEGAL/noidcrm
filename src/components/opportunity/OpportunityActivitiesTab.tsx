import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityCard } from '@/components/activities/ActivityCard';
import { CreateActivityModal } from '@/components/activities/CreateActivityModal';
import { EditActivityModal } from '@/components/activities/EditActivityModal';
import { AINextActionCard } from '@/components/ai/AINextActionCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Plus, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { getOpportunity } from '@/services/crm/opportunities';
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  completeActivity,
  markActivityAsNoShow,
  type ActivityListParams,
} from '@/services/crm/activities';
import { Activity } from '@/services/crm/types';

interface OpportunityActivitiesTabProps {
  opportunityId: string;
}

export function OpportunityActivitiesTab({ opportunityId }: OpportunityActivitiesTabProps) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [prefillData, setPrefillData] = useState<{
    type?: string;
    title?: string;
    description?: string;
    scheduled_date?: string;
    account_id?: string;
    contact_id?: string;
    opportunity_id?: string;
  } | null>(null);

  // Fetch opportunity data to get account_id and contact_id
  const { data: opportunity } = useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: () => getOpportunity(opportunityId),
    enabled: !!opportunityId,
  });

  const loadActivities = async () => {
    try {
      setLoading(true);
      const params: ActivityListParams = {
        opportunity_id: opportunityId,
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      };
      const result = await listActivities(params);
      setActivities(result.activities);
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as atividades.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [opportunityId, searchQuery, statusFilter, typeFilter]);

  const handleCreateActivity = async (data: Partial<Activity>) => {
    try {
      await createActivity({
        ...data,
        opportunity_id: opportunityId,
      });
      toast({
        title: 'Sucesso',
        description: 'Atividade criada com sucesso!',
      });
      loadActivities();
      setCreateModalOpen(false);
      setPrefillData(null);
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a atividade.',
        variant: 'destructive',
      });
    }
  };

  const handleEditActivity = async (id: string, data: Partial<Activity>) => {
    try {
      await updateActivity(id, data);
      toast({
        title: 'Sucesso',
        description: 'Atividade atualizada com sucesso!',
      });
      loadActivities();
      setEditModalOpen(false);
      setSelectedActivity(null);
    } catch (error) {
      console.error('Erro ao editar atividade:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a atividade.',
        variant: 'destructive',
      });
    }
  };

  const handleCompleteActivity = async (id: string) => {
    try {
      await completeActivity(id);
      toast({
        title: 'Sucesso',
        description: 'Atividade concluída!',
      });
      loadActivities();
    } catch (error) {
      console.error('Erro ao concluir atividade:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível concluir a atividade.',
        variant: 'destructive',
      });
    }
  };

  const handleNoShowActivity = async (id: string) => {
    try {
      await markActivityAsNoShow(id);
      toast({
        title: 'Sucesso',
        description: 'Atividade marcada como no-show.',
      });
      loadActivities();
    } catch (error) {
      console.error('Erro ao marcar no-show:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar como no-show.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta atividade?')) return;
    try {
      await deleteActivity(id);
      toast({
        title: 'Sucesso',
        description: 'Atividade excluída com sucesso!',
      });
      loadActivities();
    } catch (error) {
      console.error('Erro ao excluir atividade:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a atividade.',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (activity: Activity) => {
    setSelectedActivity(activity);
    setEditModalOpen(true);
  };

  const handleCreateActivityFromAI = (data: {
    type: string;
    title: string;
    description: string;
    scheduled_date?: string;
  }) => {
    // Get contact_id from opportunity if available (it exists in DB but not in type)
    const oppData = opportunity as any;
    
    setPrefillData({
      type: data.type,
      title: data.title,
      description: data.description,
      scheduled_date: data.scheduled_date,
      // Pre-fill opportunity context
      account_id: opportunity?.account_id || undefined,
      contact_id: oppData?.contact_id || undefined,
      opportunity_id: opportunityId,
    });
    setCreateModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Next Actions Card */}
      <AINextActionCard 
        opportunityId={opportunityId} 
        onCreateActivity={handleCreateActivityFromAI}
      />

      {/* Activities List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Atividades da Oportunidade</CardTitle>
            <Button onClick={() => { 
              // Pre-fill opportunity context even for manual creation
              const oppData = opportunity as any;
              setPrefillData({
                account_id: opportunity?.account_id || undefined,
                contact_id: oppData?.contact_id || undefined,
                opportunity_id: opportunityId,
              }); 
              setCreateModalOpen(true); 
            }} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Atividade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar atividades..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="note">Anotação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Atividades */}
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma atividade encontrada.</p>
                <p className="text-sm mt-2">Clique em "Nova Atividade" para começar.</p>
              </div>
            ) : (
              activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onComplete={handleCompleteActivity}
                  onNoShow={handleNoShowActivity}
                  onEdit={openEditModal}
                  onDelete={handleDeleteActivity}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <CreateActivityModal
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) setPrefillData(null);
        }}
        onSubmit={handleCreateActivity}
        prefillData={prefillData}
      />

      {selectedActivity && (
        <EditActivityModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          activity={selectedActivity}
          onSubmit={handleEditActivity}
        />
      )}
    </div>
  );
}