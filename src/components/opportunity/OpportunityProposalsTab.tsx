import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Plus, 
  FileText, 
  Pencil, 
  Download, 
  Link2, 
  Eye, 
  MoreVertical, 
  Mail, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Trash2,
  Loader2
} from 'lucide-react';
import { 
  listProposals, 
  deleteProposal, 
  duplicateProposal, 
  updateProposal,
  generateProposalPDF,
  generatePublicToken
} from '@/services/crm/proposals';
import { formatDateBR } from '@/lib/dateUtils';
import { useToast } from '@/hooks/use-toast';
import { ProposalViewModal } from '@/components/proposals/ProposalViewModal';

interface OpportunityProposalsTabProps {
  opportunityId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviada', variant: 'default' },
  viewed: { label: 'Visualizada', variant: 'outline' },
  accepted: { label: 'Aceita', variant: 'default' },
  rejected: { label: 'Recusada', variant: 'destructive' },
  expired: { label: 'Expirada', variant: 'destructive' },
};

export function OpportunityProposalsTab({ opportunityId }: OpportunityProposalsTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [loadingPDF, setLoadingPDF] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', opportunityId],
    queryFn: () => listProposals({ opportunityId }),
  });

  const proposals = data?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', opportunityId] });
      toast({ title: 'Proposta excluída com sucesso' });
      setDeleteDialogOpen(false);
      setProposalToDelete(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir proposta', variant: 'destructive' });
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', opportunityId] });
      toast({ title: 'Proposta duplicada com sucesso' });
    },
    onError: () => {
      toast({ title: 'Erro ao duplicar proposta', variant: 'destructive' });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateProposal(id, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', opportunityId] });
      const statusLabel = variables.status === 'accepted' ? 'aceita' : 'recusada';
      toast({ title: `Proposta marcada como ${statusLabel}` });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });

  const handleNewProposal = () => {
    navigate(`/app/proposals/new?opportunity_id=${opportunityId}`);
  };

  const handleEditProposal = (proposalId: string) => {
    navigate(`/app/proposals/${proposalId}/edit`);
  };

  const handleViewProposal = (proposal: any) => {
    setSelectedProposal(proposal);
    setViewModalOpen(true);
  };

  const handleGeneratePDF = async (proposalId: string) => {
    setLoadingPDF(proposalId);
    try {
      const pdfUrl = await generateProposalPDF(proposalId);
      window.open(pdfUrl, '_blank');
      toast({ title: 'PDF gerado com sucesso' });
    } catch (error) {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setLoadingPDF(null);
    }
  };

  const handleCopyLink = async (proposalId: string) => {
    setLoadingLink(proposalId);
    try {
      const token = await generatePublicToken(proposalId);
      const publicUrl = `${window.location.origin}/proposta/${token}`;
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Link copiado para a área de transferência' });
    } catch (error) {
      toast({ title: 'Erro ao gerar link', variant: 'destructive' });
    } finally {
      setLoadingLink(null);
    }
  };

  const handleDelete = (proposalId: string) => {
    setProposalToDelete(proposalId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (proposalToDelete) {
      deleteMutation.mutate(proposalToDelete);
    }
  };

  const handleDuplicate = (proposalId: string) => {
    duplicateMutation.mutate(proposalId);
  };

  const handleMarkAsAccepted = (proposalId: string) => {
    updateStatusMutation.mutate({ id: proposalId, status: 'accepted' });
  };

  const handleMarkAsRejected = (proposalId: string) => {
    updateStatusMutation.mutate({ id: proposalId, status: 'rejected' });
  };

  const handleSendEmail = () => {
    toast({ 
      title: 'Funcionalidade em desenvolvimento',
      description: 'O envio de e-mail estará disponível em breve.'
    });
  };

  const formatCurrency = (value: number, currency: string = 'BRL') => {
    const symbols: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' };
    return `${symbols[currency] || 'R$'} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Propostas</h3>
        <Button onClick={handleNewProposal} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Proposta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h4 className="text-lg font-medium mb-2">Nenhuma proposta</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Crie uma proposta para esta oportunidade
            </p>
            <Button onClick={handleNewProposal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Proposta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal: any) => {
            const statusInfo = statusConfig[proposal.status] || statusConfig.draft;
            const isLoadingPDF = loadingPDF === proposal.id;
            const isLoadingLink = loadingLink === proposal.id;
            
            return (
              <Card key={proposal.id} className="hover:bg-accent/30 transition-colors">
                <CardContent className="p-4">
                  {/* Header with title and status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{proposal.title}</p>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                          <span className="font-medium">{formatCurrency(proposal.value || 0, proposal.currency)}</span>
                          <span>•</span>
                          <span>{formatDateBR(proposal.created_at)}</span>
                          {proposal.proposal_number && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {proposal.proposal_number}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Primary actions - always visible */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGeneratePDF(proposal.id)}
                      disabled={isLoadingPDF}
                    >
                      {isLoadingPDF ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-1.5" />
                      )}
                      PDF
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(proposal.id)}
                      disabled={isLoadingLink}
                    >
                      {isLoadingLink ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-1.5" />
                      )}
                      Link
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProposal(proposal.id)}
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Editar
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProposal(proposal)}
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Ver
                    </Button>

                    {/* Secondary actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="px-2">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleSendEmail}>
                          <Mail className="h-4 w-4 mr-2" />
                          Enviar por E-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDuplicate(proposal.id)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar Proposta
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleMarkAsAccepted(proposal.id)}
                          disabled={proposal.status === 'accepted' || updateStatusMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          Marcar como Aceita
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleMarkAsRejected(proposal.id)}
                          disabled={proposal.status === 'rejected' || updateStatusMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-2 text-red-600" />
                          Marcar como Recusada
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Delete button - separate for safety */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(proposal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A proposta será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View modal */}
      <ProposalViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        proposal={selectedProposal}
      />
    </div>
  );
}
