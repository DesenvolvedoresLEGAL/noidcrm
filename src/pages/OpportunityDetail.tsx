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
import { DealParticipantsManager } from '@/components/opportunity/DealParticipantsManager';
import { EditOpportunityModal } from '@/components/opportunity/EditOpportunityModal';
import { LossReasonModal } from '@/components/opportunity/LossReasonModal';
import { useOpportunityDetails } from '@/hooks/useOpportunityDetails';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOpportunity, updateOpportunityStatus, markOpportunityAsLost } from '@/services/crm/opportunities';
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
import { 
  History, 
  MessageSquare, 
  Calendar, 
  FileText, 
  Mail, 
  FileCheck, 
  Users 
} from 'lucide-react';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lossReasonModalOpen, setLossReasonModalOpen] = useState(false);

  const { data: opportunity, isLoading, error } = useOpportunityDetails(id!);
  const { pipelines } = useOrganizationPipelines();

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
    mutationFn: () => updateOpportunityStatus(id!, 'won'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'Oportunidade marcada como ganha!' });
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
    mutationFn: ({ lossReasonId, comment }: { lossReasonId: string; comment: string }) =>
      markOpportunityAsLost(id!, lossReasonId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setLossReasonModalOpen(false);
      toast({ title: 'Oportunidade marcada como perdida' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
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
    wonMutation.mutate();
  };

  const handleLost = () => {
    setLossReasonModalOpen(true);
  };

  const handleConfirmLoss = (lossReasonId: string, comment: string) => {
    lossMutation.mutate({ lossReasonId, comment });
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
        {/* Header Ultra-Minimal */}
        <OpportunityDetailHeader opportunity={opportunity} />

        {/* 2-Column Layout - Sidebar + Main */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Sidebar - 3 cols */}
          <div className="lg:col-span-3 xl:col-span-2 space-y-3">
            <OpportunitySidebar 
              opportunity={opportunityForSidebar} 
              onUpdateField={handleUpdateField}
              onUpdateTitle={handleUpdateTitle}
              onWon={handleWon}
              onLost={handleLost}
              onEdit={() => setEditModalOpen(true)}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </div>

          {/* Main Content - 9 cols */}
          <div className="lg:col-span-9 xl:col-span-10 space-y-4">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="w-full grid grid-cols-3 lg:grid-cols-7 gap-1 h-auto p-1">
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
                <TabsTrigger value="proposals" className="text-xs px-2 py-1.5">
                  <FileCheck className="h-3 w-3 mr-1 hidden sm:inline" />
                  Propostas
                </TabsTrigger>
                <TabsTrigger value="team" className="text-xs px-2 py-1.5">
                  <Users className="h-3 w-3 mr-1 hidden sm:inline" />
                  Equipe
                </TabsTrigger>
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

              <TabsContent value="proposals" className="mt-4">
                <OpportunityProposalsTab 
                  opportunityId={opportunity.id} 
                  pipelineType={opportunity.pipeline?.pipeline_type}
                />
              </TabsContent>

              <TabsContent value="team" className="mt-4">
                <DealParticipantsManager opportunityId={opportunity.id} />
              </TabsContent>
            </Tabs>
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

      {/* Loss Reason Modal */}
      <LossReasonModal
        open={lossReasonModalOpen}
        onClose={() => setLossReasonModalOpen(false)}
        onConfirm={handleConfirmLoss}
        opportunityTitle={opportunity.title}
        pipelineId={opportunity.pipeline_id}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{opportunity.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement delete
                navigate(`/app/opportunities?pipeline=${opportunity.pipeline_id}`);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
