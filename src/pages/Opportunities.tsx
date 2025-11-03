import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KanbanBoard } from '@/components/KanbanBoard';
import { OpportunityDetailModal } from '@/components/opportunity/OpportunityDetailModal';
import { CreateOpportunityModal } from '@/components/CreateOpportunityModal';
import { Plus, Search } from 'lucide-react';
import { listPipelines } from '@/services/crm/pipelines';
import { listOpportunities, moveOpportunity, createOpportunity, updateOpportunityStatus, updateOpportunity } from '@/services/crm/opportunities';
import { Pipeline } from '@/services/crm/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export default function Opportunities() {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
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

      const oppsData = await listOpportunities();
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

  const handleWon = async () => {
    if (!selectedOpportunityId) return;
    try {
      await updateOpportunityStatus(selectedOpportunityId, 'won');
      await loadData();
      setSelectedOpportunityId(null);
      toast({
        title: 'Sucesso',
        description: 'Oportunidade marcada como ganha!',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar oportunidade',
        variant: 'destructive',
      });
    }
  };

  const handleLost = async () => {
    if (!selectedOpportunityId) return;
    try {
      await updateOpportunityStatus(selectedOpportunityId, 'lost');
      await loadData();
      setSelectedOpportunityId(null);
      toast({
        title: 'Oportunidade perdida',
        description: 'Oportunidade marcada como perdida.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar oportunidade',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateOpportunity = async (id: string, updates: any) => {
    try {
      await updateOpportunity(id, updates);
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar oportunidade:', error);
      throw error;
    }
  };

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesPipeline = opp.pipeline_id === selectedPipelineId;
    const matchesSearch = searchQuery
      ? (opp.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         opp.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesPipeline && matchesSearch;
  });

  const selectedOpportunity = opportunities.find((o) => o.id === selectedOpportunityId);

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
      <div className="p-4 md:p-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Pipeline</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie suas oportunidades de vendas
            </p>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="lg"
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full md:w-auto animate-scale-in"
          >
            <Plus className="h-5 w-5 mr-2" />
            Oportunidade
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4 bg-card p-4 rounded-lg border shadow-card animate-fade-in">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa ou contato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Selecione o funil" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Métricas do Funil */}
        {selectedPipeline && (
          <div className="bg-card p-4 md:p-6 rounded-lg border shadow-card animate-fade-in">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg md:text-xl font-bold text-foreground">{selectedPipeline.name}</h2>
              <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm">
                <div>
                  <span className="text-muted-foreground">Total de Oportunidades: </span>
                  <span className="font-bold text-foreground">{totalOpportunities}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor Total P&S: </span>
                  <span className="font-bold text-primary">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                    }).format(totalValue)}
                  </span>
                </div>
                {totalMRR > 0 && (
                  <div>
                    <span className="text-muted-foreground">MRR Total: </span>
                    <span className="font-bold text-accent">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                      }).format(totalMRR)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        {selectedPipeline && (
          <KanbanBoard
            pipeline={selectedPipeline}
            opportunities={filteredOpportunities}
            onMoveOpportunity={handleMoveOpportunity}
            onOpportunityClick={setSelectedOpportunityId}
          />
        )}

        {/* Modal de Detalhes */}
        {selectedPipeline && selectedOpportunity && (
          <OpportunityDetailModal
            open={!!selectedOpportunityId}
            onOpenChange={(open) => !open && setSelectedOpportunityId(null)}
            opportunity={selectedOpportunity}
            pipeline={selectedPipeline}
            onWon={handleWon}
            onLost={handleLost}
            onUpdate={handleUpdateOpportunity}
          />
        )}

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
