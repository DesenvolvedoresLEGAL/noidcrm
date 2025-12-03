import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { KanbanBoard } from '@/components/KanbanBoard';
import { CreateOpportunityModal } from '@/components/CreateOpportunityModal';
import { PipelineHeader } from '@/components/pipeline/PipelineHeader';
import { StageHeaderBar } from '@/components/pipeline/StageHeaderBar';
import { listPipelines } from '@/services/crm/pipelines';
import { listOpportunities, moveOpportunity, createOpportunity } from '@/services/crm/opportunities';
import { processPendingWorkflows } from '@/services/crm/workflow-rules';
import { Pipeline } from '@/services/crm/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useDataVisibility } from '@/hooks/useDataVisibility';

export default function Opportunities() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getVisibilityFilter } = useDataVisibility();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const pipelinesData = await listPipelines();
      setPipelines(pipelinesData);
      
      if (pipelinesData.length > 0) {
        setSelectedPipelineId(pipelinesData[0].id);
      }

      const visibilityFilter = getVisibilityFilter();
      const oppsData = await listOpportunities(visibilityFilter);
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
    try {
      await moveOpportunity(oppId, newStageId);
      
      // Process any pending workflow automations triggered by this stage change
      await processPendingWorkflows(oppId);
      
      await loadData();
      toast({
        title: 'Sucesso',
        description: 'Oportunidade movida com sucesso',
      });
    } catch (error) {
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
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesPipeline = opp.pipeline_id === selectedPipelineId;
    const matchesSearch = searchQuery
      ? (opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    const isActive = opp.status !== 'won' && opp.status !== 'lost';
    return matchesPipeline && matchesSearch && isActive;
  });

  // Group opportunities by stage
  const opportunitiesByStage: Record<string, any[]> = {};
  if (selectedPipeline) {
    selectedPipeline.stages.forEach(stage => {
      opportunitiesByStage[stage.id] = filteredOpportunities.filter(opp => opp.stage_id === stage.id);
    });
  }

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
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Compact Header */}
        <PipelineHeader
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateClick={() => setCreateModalOpen(true)}
          totalOpportunities={totalOpportunities}
          totalValue={totalValue}
          totalMRR={totalMRR}
        />

        {/* Stage Headers */}
        {selectedPipeline && (
          <StageHeaderBar
            stages={selectedPipeline.stages}
            opportunitiesByStage={opportunitiesByStage}
            totalOpportunities={totalOpportunities}
            totalValue={totalValue}
          />
        )}

        {/* Full-height Kanban */}
        <div className="flex-1 overflow-hidden">
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
        />
      </div>
    </Layout>
  );
}
