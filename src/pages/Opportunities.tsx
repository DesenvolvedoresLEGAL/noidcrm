import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateOpportunityModal } from '@/components/CreateOpportunityModal';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineContextBar } from '@/components/pipeline/PipelineContextBar';
import { listPipelines } from '@/services/crm/pipelines';
import { listOpportunities, moveOpportunity, createOpportunity } from '@/services/crm/opportunities';
import { processPendingWorkflows } from '@/services/crm/workflow-rules';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRealtimeOpportunities } from '@/hooks/useRealtimeOpportunities';
import { opportunityKeys } from '@/lib/query-keys';

export default function Opportunities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { visibleUserIds, canViewAll, isTeamManager } = useTeamVisibility();
  const { users: orgUsers } = useOrganizationUsers();
  const { profile } = useCurrentUser();
  
  // Managers veem apenas membros do time no filtro, owners/admins veem todos
  const showUserFilter = canViewAll || isTeamManager;
  const filterableUsers = canViewAll 
    ? orgUsers 
    : isTeamManager && visibleUserIds 
      ? orgUsers.filter(u => visibleUserIds.includes(u.id))
      : [];

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [hygieneFilter, setHygieneFilter] = useState<string>('');

  const pipelineParam = searchParams.get('pipeline');

  // Enable realtime subscriptions for automatic updates
  useRealtimeOpportunities();

  const opportunitiesQueryKey = [...opportunityKeys.lists(), selectedPipelineId, visibleUserIds];

  // React Query: pipelines
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: listPipelines,
  });

  // React Query: opportunities
  const { data: opportunitiesData, isLoading: oppsLoading } = useQuery({
    queryKey: opportunitiesQueryKey,
    queryFn: () => listOpportunities({
      pipeline_id: selectedPipelineId,
      owner_user_ids: visibleUserIds || undefined,
      projection: 'kanban', // SPRINT PERF 0.6B — payload menor para o board
    }),
    enabled: !!selectedPipelineId && (visibleUserIds !== undefined || visibleUserIds === null),
  });

  const opportunities = opportunitiesData?.data || [];
  const loading = pipelinesLoading || oppsLoading;

  // Set selected pipeline based on URL param, user default, or first pipeline
  useEffect(() => {
    if (pipelines.length === 0) return;
    if (selectedPipelineId && pipelines.find(p => p.id === selectedPipelineId)) return;

    let targetPipelineId = pipelines[0].id;
    if (pipelineParam && pipelines.find(p => p.id === pipelineParam)) {
      targetPipelineId = pipelineParam;
    } else if (profile?.default_pipeline_id && pipelines.find(p => p.id === profile.default_pipeline_id)) {
      targetPipelineId = profile.default_pipeline_id;
    }
    setSelectedPipelineId(targetPipelineId);
  }, [pipelines, pipelineParam, profile?.default_pipeline_id]);

  // Função para mudar pipeline e atualizar URL
  const handlePipelineChange = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setSearchParams({ pipeline: pipelineId });
  };

  const handleMoveOpportunity = async (oppId: string, newStageId: string) => {
    // Atualização otimista
    const previousOpportunities = opportunities;
    const targetStage = selectedPipeline?.stages.find(s => s.id === newStageId);
    const newProb = targetStage?.probability;

    queryClient.setQueryData(
      opportunitiesQueryKey,
      (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((opp: any) =>
            opp.id === oppId
              ? { ...opp, stage_id: newStageId, prob: newProb ?? opp.prob }
              : opp
          ),
        };
      }
    );

    try {
      await moveOpportunity(oppId, newStageId);
      await processPendingWorkflows(oppId);
      toast({ title: 'Sucesso', description: 'Oportunidade movida com sucesso' });
    } catch (error) {
      // Rollback
      queryClient.setQueryData(opportunitiesQueryKey, { data: previousOpportunities, total: previousOpportunities.length });
      console.error('Erro ao mover oportunidade:', error);
      toast({ title: 'Erro', description: 'Erro ao mover oportunidade', variant: 'destructive' });
    }
  };

  const handleCreateOpportunity = async (data: any) => {
    try {
      await createOpportunity(data);
      queryClient.invalidateQueries({ queryKey: opportunityKeys.lists() });
    } catch (error) {
      console.error('Erro ao criar oportunidade:', error);
      throw error;
    }
  };

  const handleOpportunityClick = (opportunityId: string) => {
    navigate(`/app/opportunities/${opportunityId}`);
  };

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const validStageIds = selectedPipeline?.stages?.map(s => s.id) || [];
  
  const filteredOpportunities = opportunities.filter((opp: any) => {
    const matchesPipeline = opp.pipeline_id === selectedPipelineId;
    const hasValidStage = validStageIds.includes(opp.stage_id);
    const matchesSearch = searchQuery
      ? (opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    
    const isOnboardingPipeline = selectedPipeline?.pipeline_type === 'onboarding' || 
                                  selectedPipeline?.pipeline_type === 'renewal';
    const isActive = isOnboardingPipeline 
      ? opp.status !== 'lost'
      : opp.status !== 'won' && opp.status !== 'lost';
    
    const matchesUser = selectedUserId ? opp.owner_user_id === selectedUserId : true;
    
    const matchesHygiene = (() => {
      if (!hygieneFilter) return true;
      const score = opp.nrhs_score;
      if (score === null || score === undefined) return true;
      if (hygieneFilter === 'healthy') return score >= 75;
      if (hygieneFilter === 'risk') return score >= 60 && score < 75;
      if (hygieneFilter === 'critical') return score < 60;
      return true;
    })();
    
    return matchesPipeline && hasValidStage && matchesSearch && isActive && matchesUser && matchesHygiene;
  });

  const totalOpportunities = filteredOpportunities.length;
  const totalValue = filteredOpportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);
  const totalMRR = filteredOpportunities.reduce((sum, opp) => sum + (opp.meta?.mrr || 0), 0);

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <PipelineToolbar
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={handlePipelineChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={() => setCreateModalOpen(true)}
          users={showUserFilter ? filterableUsers : []}
          selectedUserId={selectedUserId}
          onUserFilterChange={setSelectedUserId}
          hygieneFilter={hygieneFilter}
          onHygieneFilterChange={setHygieneFilter}
        />

        {selectedPipeline && (
          <PipelineContextBar
            pipeline={selectedPipeline}
            totalOpportunities={totalOpportunities}
            totalValue={totalValue}
            totalMRR={totalMRR}
          />
        )}

        <div className="flex-1 overflow-hidden bg-muted/20">
          {selectedPipeline && (
            <KanbanBoard
              pipeline={selectedPipeline}
              opportunities={filteredOpportunities}
              onMoveOpportunity={handleMoveOpportunity}
              onOpportunityClick={handleOpportunityClick}
            />
          )}
        </div>

        <CreateOpportunityModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          pipelines={pipelines}
          onCreateOpportunity={handleCreateOpportunity}
          defaultPipelineId={selectedPipelineId}
        />
      </div>
    </Layout>
  );
}
