import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { OpportunityDiagnosticTab } from '@/components/opportunity/OpportunityDiagnosticTab';
import { EditOpportunityModal } from '@/components/opportunity/EditOpportunityModal';
import { LossReasonModal, type LossDetails } from '@/components/opportunity/LossReasonModal';
import { DisqualifyLeadModal, type DisqualifyLeadDetails } from '@/components/opportunity/DisqualifyLeadModal';
import { disqualifyPreSalesOpportunity } from '@/services/crm/disqualify';
import { WinReasonModal, type WinDetails } from '@/components/opportunity/WinReasonModal';
import { SellerClassificationBanner } from '@/components/opportunity/SellerClassificationBanner';
import { ReopenOpportunityModal } from '@/components/opportunity/ReopenOpportunityModal';
import { OpportunityIntelligenceTab } from '@/components/opportunity/OpportunityIntelligenceTab';
import { useOpportunityDetails } from '@/hooks/useOpportunityDetails';
import { useRealtimeOpportunityDetail } from '@/hooks/useRealtimeOpportunityDetail';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { extractEmail, extractPhone } from '@/lib/contactFormat';
import { updateOpportunity, updateOpportunityStatus, markOpportunityAsLost, markOpportunityAsWon, deleteOpportunity, reopenOpportunity } from '@/services/crm/opportunities';
import { processPendingWorkflows } from '@/services/crm/workflow-rules';
import { invalidateOpportunity } from '@/lib/cache-invalidation';
import { opportunityKeys } from '@/lib/query-keys';
import { DeleteOpportunityDialog } from '@/components/opportunity/DeleteOpportunityDialog';
import { 
  History, 
  MessageSquare, 
  Calendar, 
  FileText, 
  Mail, 
  FileCheck, 
  Users,
  BarChart3,
  ClipboardList,
  Network,
  Brain,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);
  const [disqualifyModalOpen, setDisqualifyModalOpen] = useState(false);
  const [winReasonModalOpen, setWinReasonModalOpen] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [sellerClassificationMode, setSellerClassificationMode] = useState(false);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const approvalParam = searchParams.get('approval');
  const [activeTab, setActiveTab] = useState(tabParam || 'history');

  // React to deep-link changes (e.g. from notifications/timeline)
  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  // Scroll to highlighted approval after a moment
  useEffect(() => {
    if (approvalParam && activeTab === 'emails') {
      const t = setTimeout(() => {
        document.getElementById(`approval-${approvalParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [approvalParam, activeTab]);

  const { data: opportunity, isLoading, error } = useOpportunityDetails(id!);
  const { pipelines } = useOrganizationPipelines(editModalOpen);
  const { membership, organization } = useCurrentUser();

  // Real-time updates for this opportunity and its linked account/contact
  useRealtimeOpportunityDetail(id, opportunity?.account_id, opportunity?.contact_id);

  const updateMutation = useMutation({
    mutationFn: (updates: any) => updateOpportunity(id!, updates),
    onSuccess: () => {
      invalidateOpportunity(queryClient, id);
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
      invalidateOpportunity(queryClient, id);
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
        relationshipFactor: details.relationshipFactor,
        lossAccountability: details.lossAccountability,
        isRecoverable: details.isRecoverable,
      });
      // 2. If seller classification mode, also clear requires_seller_classification
      if (sellerClassificationMode) {
        const { updateOpportunity: updateOpp } = await import('@/services/crm/opportunities');
        await updateOpp(id!, { requires_seller_classification: false } as any);
      }
      // 3. Executa workflows IMEDIATAMENTE (sem esperar CRON)
      await processPendingWorkflows(id!);
    },
    onSuccess: () => {
      invalidateOpportunity(queryClient, id);
      setLossReasonModalOpen(false);
      setSellerClassificationMode(false);
      toast({ title: sellerClassificationMode 
        ? 'Motivo real classificado. Oportunidade marcada como perdida.' 
        : 'Oportunidade perdida. Automações executadas.' 
      });
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
    onSuccess: async () => {
      // Force refetch BEFORE navigating so the kanban remounts with fresh data.
      // Without refetchType:'all' the inactive list query is only marked stale
      // and (because the global config sets refetchOnMount:false) it never
      // refetches on remount, leaving the deleted card visible until a hard
      // refresh.
      await invalidateOpportunity(queryClient, id);
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

  const reopenMutation = useMutation({
    mutationFn: ({ reason, targetStageId }: { reason: string; targetStageId: string }) =>
      reopenOpportunity(id!, { reason, targetStageId }),
    onSuccess: () => {
      invalidateOpportunity(queryClient, id);
      setReopenModalOpen(false);
      toast({ title: 'Oportunidade reaberta com sucesso' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao reabrir',
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
    if (opportunity?.pipeline?.pipeline_type === 'qualification') {
      setDisqualifyModalOpen(true);
    } else {
      setLossReasonModalOpen(true);
    }
  };

  const handleConfirmLoss = (details: LossDetails) => {
    lossMutation.mutate(details);
  };

  const disqualifyMutation = useMutation({
    mutationFn: async (details: DisqualifyLeadDetails) => {
      const result = await disqualifyPreSalesOpportunity(id!, {
        reasonSlug: details.reasonKey ?? details.reasonSlug,
        reasonLabel: details.reasonLabel,
        observation: details.observation,
        createRemarketing: details.createRemarketing,
      });
      await processPendingWorkflows(id!);
      return result;
    },
    onSuccess: (result) => {
      invalidateOpportunity(queryClient, id);
      setDisqualifyModalOpen(false);
      if (result.remarketingExisted) {
        toast({ title: 'Lead desqualificado e já existente no Remarketing.' });
      } else if (result.duplicated) {
        toast({ title: 'Lead desqualificado. Nova oportunidade criada no Remarketing.' });
      } else if (result.remarketingPipelineMissing) {
        toast({
          title: 'Lead desqualificado.',
          description: 'Funil Remarketing não configurado nesta organização.',
        });
      } else {
        toast({ title: 'Lead desqualificado.' });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao desqualificar', description: error.message });
    },
  });

  const handleConfirmDisqualify = (details: DisqualifyLeadDetails) => {
    disqualifyMutation.mutate(details);
  };

  const handleReopen = () => {
    setReopenModalOpen(true);
  };

  const handleConfirmReopen = (reason: string, targetStageId: string) => {
    reopenMutation.mutate({ reason, targetStageId });
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
  // Use extractEmail/extractPhone to handle both {value, type, is_primary} and {tipo, numero} formats
  const opportunityForSidebar = {
    ...opportunity,
    account_name: opportunity.account?.nome_fantasia || opportunity.account?.razao_social,
    contact_name: opportunity.contact?.nome,
    contact_email: extractEmail(opportunity.contact?.emails) || undefined,
    contact_phone: extractPhone(opportunity.contact?.telefones) || undefined,
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Seller Classification Banner */}
        {(opportunity as any).requires_seller_classification && (
          <SellerClassificationBanner
            clientReasonName={(opportunity as any).client_loss_reason?.name}
            onClassify={() => {
              setSellerClassificationMode(true);
              setLossReasonModalOpen(true);
            }}
          />
        )}

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
              onReopen={handleReopen}
              userRole={membership?.org_role || undefined}
              onNavigateToIntelligence={() => setActiveTab('intelligence')}
            />
          </div>

          {/* Main Content - 9 cols */}
          <div className="lg:col-span-9 xl:col-span-10 space-y-4">
            {/* Header compacto - alinhado com tabs */}
            <OpportunityDetailHeader 
              opportunity={opportunity} 
              onStageChange={async (stageId) => {
                await updateMutation.mutateAsync({ stage_id: stageId });
              }}
            />
            {/* Oculta tab Propostas para pipelines de qualificação (PRÉ VENDAS) */}
            {(() => {
              const showProposals = opportunity.pipeline?.pipeline_type !== 'qualification';
              const showAnalytics = showProposals;
              
              return (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-2 p-1.5">
                    <TabsTrigger value="history" className="text-sm px-3 py-2">
                      <History className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Histórico
                    </TabsTrigger>
                    <TabsTrigger value="intelligence" className="text-sm px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Inteligência
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-sm px-3 py-2">
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Notas
                    </TabsTrigger>
                    <TabsTrigger value="activities" className="text-sm px-3 py-2">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Atividades
                    </TabsTrigger>
                    <TabsTrigger value="files" className="text-sm px-3 py-2">
                      <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Arquivos
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="text-sm px-3 py-2">
                      <Mail className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      E-mails
                    </TabsTrigger>
                    {showProposals && (
                      <TabsTrigger value="proposals" className="text-sm px-3 py-2">
                        <FileCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Propostas
                      </TabsTrigger>
                    )}
                    {showAnalytics && (
                      <TabsTrigger value="analytics" className="text-sm px-3 py-2">
                        <BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                        Analytics
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="forms" className="text-sm px-3 py-2">
                      <ClipboardList className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Formulários
                    </TabsTrigger>
                    <TabsTrigger value="team" className="text-sm px-3 py-2">
                      <Users className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Equipe
                    </TabsTrigger>
                    <TabsTrigger value="graph" className="text-sm px-3 py-2">
                      <Network className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Rede
                    </TabsTrigger>
                    <TabsTrigger value="memories" className="text-sm px-3 py-2">
                      <Brain className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Memórias
                    </TabsTrigger>
                    <TabsTrigger value="diagnostic" className="text-sm px-3 py-2">
                      <ClipboardCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                      Diagnóstico
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="history" className="mt-4">
                    <OpportunityHistoryTab opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="intelligence" className="mt-4">
                    <OpportunityIntelligenceTab 
                      opportunityId={opportunity.id}
                      opportunityTitle={opportunity.title}
                      organizationId={(opportunity as any).organization_id}
                    />
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
                        onNavigateToAnalytics={() => setActiveTab('analytics')}
                      />
                    </TabsContent>
                  )}

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

                  <TabsContent value="team" className="mt-4">
                    <DealParticipantsManager opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="graph" className="mt-4">
                    <OpportunityGraphSignals opportunityId={opportunity.id} />
                  </TabsContent>

                  <TabsContent value="memories" className="mt-4">
                    <DealMemoryPanel 
                      opportunityId={opportunity.id}
                      stage={opportunity.stage_id}
                    />
                  </TabsContent>

                  <TabsContent value="diagnostic" className="mt-4">
                    <OpportunityDiagnosticTab opportunityId={opportunity.id} />
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

      {/* Disqualify Lead Modal (PRÉ VENDAS) */}
      <DisqualifyLeadModal
        open={disqualifyModalOpen}
        onClose={() => setDisqualifyModalOpen(false)}
        onConfirm={handleConfirmDisqualify}
        opportunityId={opportunity.id}
        opportunityTitle={opportunity.title}
        isLoading={disqualifyMutation.isPending}
      />

      {/* Delete Confirmation - with typing requirement */}
      <DeleteOpportunityDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deleteMutation.mutate()}
        opportunityTitle={opportunity.title}
        isLoading={deleteMutation.isPending}
      />

      {/* Reopen Modal */}
      <ReopenOpportunityModal
        open={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        onConfirm={handleConfirmReopen}
        opportunityTitle={opportunity.title}
        pipelineId={opportunity.pipeline_id}
        isLoading={reopenMutation.isPending}
      />
    </Layout>
  );
}
