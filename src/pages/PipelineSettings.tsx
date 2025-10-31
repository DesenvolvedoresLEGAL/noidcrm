import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PipelineCard } from '@/components/pipelines/PipelineCard';
import { EditPipelineModal } from '@/components/pipelines/EditPipelineModal';
import { EditStageModal } from '@/components/pipelines/EditStageModal';
import { useToast } from '@/hooks/use-toast';
import {
  listPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  createStage,
  updateStage,
  deleteStage,
} from '@/services/crm/pipelines';
import type { Pipeline, Stage } from '@/services/crm/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PipelineSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | undefined>();
  const [selectedStage, setSelectedStage] = useState<Stage | undefined>();
  const [currentPipelineForStage, setCurrentPipelineForStage] = useState<Pipeline | undefined>();
  
  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'pipeline' | 'stage'>('pipeline');
  const [itemToDelete, setItemToDelete] = useState<{ pipeline?: Pipeline; stage?: Stage }>();

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      const data = await listPipelines();
      setPipelines(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar funis',
        description: 'Não foi possível carregar os funis de vendas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePipeline = () => {
    setSelectedPipeline(undefined);
    setPipelineModalOpen(true);
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setPipelineModalOpen(true);
  };

  const handleSavePipeline = async (data: Partial<Pipeline>) => {
    try {
      if (selectedPipeline) {
        await updatePipeline(selectedPipeline.id, data);
        toast({
          title: 'Funil atualizado',
          description: 'O funil foi atualizado com sucesso.',
        });
      } else {
        await createPipeline(data as Omit<Pipeline, 'id' | 'created_at' | 'stages'>);
        toast({
          title: 'Funil criado',
          description: 'O novo funil foi criado com sucesso.',
        });
      }
      loadPipelines();
    } catch (error) {
      console.error('Error saving pipeline:', error);
      toast({
        title: 'Erro ao salvar funil',
        description: (error as any)?.message || 'Não foi possível salvar o funil.',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePipeline = (pipeline: Pipeline) => {
    setItemToDelete({ pipeline });
    setDeleteType('pipeline');
    setDeleteConfirmOpen(true);
  };

  const handleDuplicatePipeline = async (pipeline: Pipeline) => {
    try {
      const newPipeline = await createPipeline({
        name: `${pipeline.name} (Cópia)`,
        bu: pipeline.bu,
      });
      
      // Duplicate stages
      for (const stage of pipeline.stages) {
        await createStage(newPipeline.id, {
          name: stage.name,
          description: stage.description,
          position: stage.position,
          color: stage.color,
          probability: stage.probability,
          stagnation_alert_days: stage.stagnation_alert_days,
          allow_create_opportunity: stage.allow_create_opportunity,
          allow_win_opportunity: stage.allow_win_opportunity,
          allow_lose_opportunity: stage.allow_lose_opportunity,
        });
      }
      
      toast({
        title: 'Funil duplicado',
        description: 'O funil foi duplicado com sucesso.',
      });
      loadPipelines();
    } catch (error) {
      toast({
        title: 'Erro ao duplicar funil',
        description: 'Não foi possível duplicar o funil.',
        variant: 'destructive',
      });
    }
  };

  const handleAddStage = (pipeline: Pipeline) => {
    setCurrentPipelineForStage(pipeline);
    setSelectedStage(undefined);
    setStageModalOpen(true);
  };

  const handleEditStage = (pipeline: Pipeline, stage: Stage) => {
    setCurrentPipelineForStage(pipeline);
    setSelectedStage(stage);
    setStageModalOpen(true);
  };

  const handleSaveStage = async (data: Partial<Stage>) => {
    if (!currentPipelineForStage) return;
    
    try {
      if (selectedStage) {
        await updateStage(currentPipelineForStage.id, selectedStage.id, data);
        toast({
          title: 'Etapa atualizada',
          description: 'A etapa foi atualizada com sucesso.',
        });
      } else {
        await createStage(currentPipelineForStage.id, data as Omit<Stage, 'id' | 'pipeline_id' | 'created_at'>);
        toast({
          title: 'Etapa criada',
          description: 'A nova etapa foi criada com sucesso.',
        });
      }
      loadPipelines();
    } catch (error) {
      console.error('Error saving stage:', error);
      toast({
        title: 'Erro ao salvar etapa',
        description: (error as any)?.message || 'Não foi possível salvar a etapa.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStage = () => {
    if (!currentPipelineForStage || !selectedStage) return;
    setItemToDelete({ pipeline: currentPipelineForStage, stage: selectedStage });
    setDeleteType('stage');
    setDeleteConfirmOpen(true);
    setStageModalOpen(false);
  };

  const confirmDelete = async () => {
    try {
      if (deleteType === 'pipeline' && itemToDelete?.pipeline) {
        await deletePipeline(itemToDelete.pipeline.id);
        toast({
          title: 'Funil removido',
          description: 'O funil foi removido com sucesso.',
        });
      } else if (deleteType === 'stage' && itemToDelete?.pipeline && itemToDelete?.stage) {
        await deleteStage(itemToDelete.pipeline.id, itemToDelete.stage.id);
        toast({
          title: 'Etapa removida',
          description: 'A etapa foi removida com sucesso.',
        });
      }
      loadPipelines();
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o item.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(undefined);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold">Funis e etapas</h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie os funis e suas etapas de maneira simples para adaptar ao seu processo de vendas.
            </p>
          </div>
          <Button onClick={handleCreatePipeline}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>

        {/* Pipelines Grid */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              onEditPipeline={handleEditPipeline}
              onDeletePipeline={handleDeletePipeline}
              onDuplicatePipeline={handleDuplicatePipeline}
              onAddStage={handleAddStage}
              onEditStage={handleEditStage}
            />
          ))}
          
          {pipelines.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum funil de vendas configurado ainda.
              </p>
              <Button onClick={handleCreatePipeline}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro funil
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditPipelineModal
        open={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
        onSave={handleSavePipeline}
        pipeline={selectedPipeline}
      />

      <EditStageModal
        open={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        onSave={handleSaveStage}
        onDelete={selectedStage ? handleDeleteStage : undefined}
        stage={selectedStage}
        pipelineName={currentPipelineForStage?.name || ''}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === 'pipeline'
                ? 'Tem certeza que deseja remover este funil? Todas as etapas associadas também serão removidas. Esta ação não pode ser desfeita.'
                : 'Tem certeza que deseja remover esta etapa? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
