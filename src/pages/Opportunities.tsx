import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateOpportunityModal } from '@/components/CreateOpportunityModal';
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar';
import { PipelineContextBar } from '@/components/pipeline/PipelineContextBar';
import { listPipelines } from '@/services/crm/pipelines';
import { listOpportunities, moveOpportunity, createOpportunity } from '@/services/crm/opportunities';
import { processPendingWorkflows } from '@/services/crm/workflow-rules';
import { Pipeline } from '@/services/crm/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';

export default function Opportunities() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { visibleUserIds, canViewAll } = useTeamVisibility();
  const { users: orgUsers } = useOrganizationUsers();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const pipelineParam = searchParams.get('pipeline');

  useEffect(() => {
    loadData();
  }, [visibleUserIds]);

  const loadData = async () => {
    try {
      const pipelinesData = await listPipelines();
      setPipelines(pipelinesData);
      
      if (pipelinesData.length > 0) {
        // Use pipeline from URL if valid, otherwise default to first
        const targetPipelineId = pipelineParam && pipelinesData.find(p => p.id === pipelineParam)
          ? pipelineParam
          : pipelinesData[0].id;
        setSelectedPipelineId(targetPipelineId);
      }

      // Aplicar filtro de visibilidade por time
      const oppsData = await listOpportunities({
        owner_user_ids: visibleUserIds || undefined
      });
      setOpportunities(oppsData.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOpportunity = async (oppId: string, newStageId: string) => {
    // Atualização otimista: atualizar UI imediatamente antes da API
    const previousOpportunities = [...opportunities];
    
    setOpportunities(prev => 
      prev.map(opp => 
        opp.id === oppId 
          ? { ...opp, stage_id: newStageId }
          : opp
      )
    );

    try {
      await moveOpportunity(oppId, newStageId);
      
      // Process any pending workflow automations triggered by this stage change
      await processPendingWorkflows(oppId);
      
      toast({
        title: 'Sucesso',
        description: 'Oportunidade movida com sucesso',
      });
    } catch (error) {
      // Rollback em caso de erro
      setOpportunities(previousOpportunities);
      console.error('Erro ao mover oportunidade:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao mover oportunidade',
        variant: 'destructive',
      });
    }
  };

  const handleCreateOpportunity = async (data: any) => {
    try {
      await createOpportunity(data);
      await loadData();
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
  
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesPipeline = opp.pipeline_id === selectedPipelineId;
    const hasValidStage = validStageIds.includes(opp.stage_id);
    const matchesSearch = searchQuery
      ? (opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const isActive = opp.status !== 'won' && opp.status !== 'lost';
    const matchesUser = selectedUserId ? opp.owner_user_id === selectedUserId : true;
    return matchesPipeline && hasValidStage && matchesSearch && isActive && matchesUser;
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
        {/* Toolbar */}
        <PipelineToolbar
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={() => setCreateModalOpen(true)}
          users={canViewAll ? orgUsers : []}
          selectedUserId={selectedUserId}
          onUserFilterChange={setSelectedUserId}
        />

        {/* Context Bar with KPIs */}
        {selectedPipeline && (
          <PipelineContextBar
            pipeline={selectedPipeline}
            totalOpportunities={totalOpportunities}
            totalValue={totalValue}
            totalMRR={totalMRR}
          />
        )}

        {/* Full-height Kanban */}
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

        {/* Modal de Criação */}
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
