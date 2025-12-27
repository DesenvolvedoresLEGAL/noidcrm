import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpportunityDetailHeader } from '@/components/opportunity/OpportunityDetailHeader';
import { OpportunitySidebar } from '@/components/opportunity/OpportunitySidebar';
import { OpportunityHistoryTab } from '@/components/opportunity/OpportunityHistoryTab';
import { OpportunityNotesTab } from '@/components/opportunity/OpportunityNotesTab';
import { OpportunityActivitiesTab } from '@/components/opportunity/OpportunityActivitiesTab';
import { OpportunityFilesTab } from '@/components/opportunity/OpportunityFilesTab';
import { OpportunityEmailsTab } from '@/components/opportunity/OpportunityEmailsTab';
import { OpportunityProposalsTab } from '@/components/opportunity/OpportunityProposalsTab';
import { OpportunityAnalyticsTab } from '@/components/opportunity/OpportunityAnalyticsTab';
import { DealParticipantsManager } from '@/components/opportunity/DealParticipantsManager';
import { OpportunityFormsTab } from '@/components/opportunity/OpportunityFormsTab';
import { OpportunityGraphSignals } from '@/components/graph/OpportunityGraphSignals';
import { DealMemoryPanel } from '@/components/memory/DealMemoryPanel';
import { EditOpportunityModal } from '@/components/opportunity/EditOpportunityModal';
import { LossReasonModal, type LossDetails } from '@/components/opportunity/LossReasonModal';
import { WinReasonModal, type WinDetails } from '@/components/opportunity/WinReasonModal';
import { IntelligenceTabsDropdown, type IntelligenceTab } from '@/components/opportunity/IntelligenceTabsDropdown';
import { useOpportunityDetails } from '@/hooks/useOpportunityDetails';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOpportunity, updateOpportunityStatus, markOpportunityAsLost, markOpportunityAsWon, deleteOpportunity } from '@/services/crm/opportunities';
import { processPendingWorkflows } from '@/services/crm/workflow-rules';
import { DeleteOpportunityDialog } from '@/components/opportunity/DeleteOpportunityDialog';
import { 
  History, 
  MessageSquare, 
  Calendar, 
  FileText, 
  Mail, 
  FileCheck, 
  Users,
} from 'lucide-react';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [winReasonModalOpen, setWinReasonModalOpen] = useState(false);

  const [intelligenceTab, setIntelligenceTab] = useState<IntelligenceTab | undefined>(undefined);

  const { data: opportunity, isLoading, error } = useOpportunityDetails(id!);
  const { pipelines } = useOrganizationPipelines();
  const { membership, organization } = useCurrentUser();

  const updateMutation = useMutation({
    mutationFn: (updates: any) => updateOpportunity(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Oportunidade atualizada' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    },
  });

  const wonMutation = useMutation({
    mutationFn: async (details: WinDetails) => {
      // 1. Marca como ganha com detalhes
      await markOpportunityAsWon(id!, {
        winReasonId: details.winReasonId,
        finalValue: details.finalValue,
        discountPercent: details.discountPercent,
        championContactId: details.championContactId,
        keyDifferentiator: details.keyDifferentiator,
        customerFeedback: details.customerFeedback,
        negotiationRounds: details.negotiationRounds,
      });
      // 2. Executa workflows IMEDIATAMENTE (sem esperar CRON)
      await processPendingWorkflows(id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setWinReasonModalOpen(false);
      toast({ title: '🎉 Oportunidade ganha! Automações executadas.' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const lossMutation = useMutation({
    mutationFn: async (details: LossDetails) => {
      // 1. Marca como perdida com detalhes
      await markOpportunityAsLost(id!, {
        lossReasonId: details.lossReasonId,
        comment: details.comment,
        competitor: details.competitor,
        priceFactor: details.priceFactor,
        timingFactor: details.timingFactor,
        featureFactor: details.featureFactor,
        relationshipFactor: details.relationshipFactor
      });
      // 2. Executa workflows IMEDIATAMENTE (sem esperar CRON)
      await processPendingWorkflows(id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setLossReasonModalOpen(false);
      toast({ title: 'Oportunidade perdida. Automações executadas.' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOpportunity(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Oportunidade excluída com sucesso' });
      navigate(`/app/opportunities?pipeline=${opportunity?.pipeline_id || ''}`);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: error.message,
      });
    },
  });

  const handleUpdateTitle = async (newTitle: string) => {
    await updateMutation.mutateAsync({ title: newTitle });
  };

  const handleUpdateField = async (field: string, value: any) => {
    const updateData: any = {};
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updateData[parent] = {
        ...(opportunity as any)?.[parent],
        [child]: value,
      };
    } else {
      updateData[field] = value;
    }
    await updateMutation.mutateAsync(updateData);
  };

  const handleWon = () => {
    setWinReasonModalOpen(true);
  };

  const handleConfirmWin = (details: WinDetails) => {
    wonMutation.mutate(details);
  };

  const handleLost = () => {
    setLossReasonModalOpen(true);
  };

  const handleConfirmLoss = (details: LossDetails) => {
    lossMutation.mutate(details);
  };

  const handleSaveFromModal = async (oppId: string, updates: any) => {
    await updateMutation.mutateAsync(updates);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-muted-foreground">Carregando oportunidade...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !opportunity) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-destructive mb-4">
                  {error?.message || 'Oportunidade não encontrada'}
                </p>
                <button
                  onClick={() => navigate('/app/opportunities')}
                  className="text-primary hover:underline"
                >
                  Voltar para Pipeline
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Transform opportunity for components that expect the old format
  const opportunityForSidebar = {
    ...opportunity,
    account_name: opportunity.account?.nome_fantasia || opportunity.account?.razao_social,
    contact_name: opportunity.contact?.nome,
    contact_email: opportunity.contact?.emails?.[0],
    contact_phone: opportunity.contact?.telefones?.[0],
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        {/* 2-Column Layout - Sidebar + Main */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Sidebar - 3 cols */}
          <div className="lg:col-span-3 xl:col-span-2">
            <OpportunitySidebar 
              opportunity={opportunityForSidebar} 
              onUpdateField={handleUpdateField}
              onUpdateTitle={handleUpdateTitle}
              onWon={handleWon}
              onLost={handleLost}
              onEdit={() => setEditModalOpen(true)}
              onDelete={() => setDeleteDialogOpen(true)}
              userRole={membership?.org_role || undefined}
            />
          </div>

          {/* Main Content - 9 cols */}
          <div className="lg:col-span-9 xl:col-span-10 space-y-4">
            {/* Header compacto - alinhado com tabs */}
            <OpportunityDetailHeader opportunity={opportunity} />
            {/* Oculta tab Propostas para pipelines de qualificação (PRÉ VENDAS) */}
            {(() => {
              const showProposals = opportunity.pipeline?.pipeline_type !== 'qualification';
              const showAnalytics = showProposals;
              
              // Handle intelligence tab selection
              const handleIntelligenceTabSelect = (tab: IntelligenceTab) => {
                setIntelligenceTab(tab);
              };

              // Clear intelligence tab when selecting a main tab
              const handleMainTabChange = (value: string) => {
                if (!['graph', 'memories', 'analytics', 'forms'].includes(value)) {
                  setIntelligenceTab(undefined);
                }
              };
              
              // Determine active tab value
              const activeTabValue = intelligenceTab || 'history';
              
              return (
                <Tabs value={activeTabValue} onValueChange={handleMainTabChange} className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="history" className="text-xs px-2 py-1.5">
                      <History className="h-3 w-3 mr-1 hidden sm:inline" />
                      Histórico
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-xs px-2 py-1.5">
                      <MessageSquare className="h-3 w-3 mr-1 hidden sm:inline" />
                      Notas
                    </TabsTrigger>
                    <TabsTrigger value="activities" className="text-xs px-2 py-1.5">
                      <Calendar className="h-3 w-3 mr-1 hidden sm:inline" />
                      Atividades
                    </TabsTrigger>
                    <TabsTrigger value="files" className="text-xs px-2 py-1.5">
                      <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
                      Arquivos
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="text-xs px-2 py-1.5">
                      <Mail className="h-3 w-3 mr-1 hidden sm:inline" />
                      E-mails
                    </TabsTrigger>
                    {showProposals && (
                      <TabsTrigger value="proposals" className="text-xs px-2 py-1.5">
                        <FileCheck className="h-3 w-3 mr-1 hidden sm:inline" />
                        Propostas
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="team" className="text-xs px-2 py-1.5">
                      <Users className="h-3 w-3 mr-1 hidden sm:inline" />
                      Equipe
                    </TabsTrigger>
                    
                    {/* Intelligence Dropdown */}
                    <IntelligenceTabsDropdown 
                      activeTab={intelligenceTab}
                      onSelectTab={handleIntelligenceTabSelect}
                      showAnalytics={showAnalytics}
                    />
                  </TabsList>

                  <TabsContent value="history" className="mt-4">
                    <OpportunityHistoryTab opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <OpportunityNotesTab opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="activities" className="mt-4">
                    <OpportunityActivitiesTab opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="files" className="mt-4">
                    <OpportunityFilesTab opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="emails" className="mt-4">
                    <OpportunityEmailsTab opportunityId={opportunity.id} />
                  </TabsContent>

                  {showProposals && (
                    <TabsContent value="proposals" className="mt-4">
                      <OpportunityProposalsTab 
                        opportunityId={opportunity.id} 
                        pipelineType={opportunity.pipeline?.pipeline_type}
                      />
                    </TabsContent>
                  )}

                  <TabsContent value="team" className="mt-4">
                    <DealParticipantsManager opportunityId={opportunity.id} />
                  </TabsContent>

                  {/* Intelligence Tabs Content */}
                  <TabsContent value="graph" className="mt-4">
                    <OpportunityGraphSignals opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="memories" className="mt-4">
                    <DealMemoryPanel 
                      opportunityId={opportunity.id}
                      stage={opportunity.stage_id}
                    />
                  </TabsContent>

                  {showAnalytics && (
                    <TabsContent value="analytics" className="mt-4">
                      <OpportunityAnalyticsTab opportunityId={opportunity.id} />
                    </TabsContent>
                  )}

                  <TabsContent value="forms" className="mt-4">
                    <OpportunityFormsTab 
                      opportunityId={opportunity.id}
                      pipelineId={opportunity.pipeline_id}
                      opportunity={opportunity}
                      account={opportunity.account}
                      contact={opportunity.contact}
                    />
                  </TabsContent>
                </Tabs>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditOpportunityModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        opportunity={opportunityForSidebar}
        pipelines={pipelines}
        onSave={handleSaveFromModal}
      />

      {/* Win Reason Modal */}
      <WinReasonModal
        open={winReasonModalOpen}
        onClose={() => setWinReasonModalOpen(false)}
        onConfirm={handleConfirmWin}
        opportunityTitle={opportunity.title}
        opportunityValue={opportunity.valor_previsto}
        accountId={opportunity.account_id}
        pipelineId={opportunity.pipeline_id}
        opportunityId={opportunity.id}
      />

      {/* Loss Reason Modal */}
      <LossReasonModal
        open={lossReasonModalOpen}
        onClose={() => setLossReasonModalOpen(false)}
        onConfirm={handleConfirmLoss}
        opportunityTitle={opportunity.title}
        pipelineId={opportunity.pipeline_id}
      />

      {/* Delete Confirmation - with typing requirement */}
      <DeleteOpportunityDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deleteMutation.mutate()}
        opportunityTitle={opportunity.title}
        isLoading={deleteMutation.isPending}
      />
    </Layout>
  );
}
