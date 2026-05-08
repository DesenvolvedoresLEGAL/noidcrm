import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProposalEmailComposer } from '@/components/proposals/ProposalEmailComposer';
import { ProposalTemplatePickerDialog } from '@/components/proposals/ProposalTemplatePickerDialog';
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
  FileDown, 
  ExternalLink, 
  Eye, 
  MoreHorizontal, 
  Send, 
  Copy, 
  CheckCircle, 
  XCircle, 
  Trash2,
  Loader2,
  AlertTriangle,
  DollarSign,
  Package,
  Calendar,
  CreditCard
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  listProposals, 
  deleteProposal, 
  duplicateProposal, 
  updateProposal,
  generatePublicToken,
  getProposalWithDetails,
} from '@/services/crm/proposals';
import { listProposalItems } from '@/services/crm/proposal-items';
import { getPaymentTerms } from '@/services/supabase/proposal-payment-terms';
import { downloadProposalPDF } from '@/lib/proposalPdfGenerator';
import { buildProposalPDFData } from '@/lib/proposalPdfBuilder';
import { buildProposalPublicUrl, buildProposalDirectUrl } from '@/lib/proposalUrl';
import { formatDateBR } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { proposalKeys } from '@/lib/query-keys';

// Proposal items + payment-terms detail cache (specific to this tab).
const proposalDetailsKey = (opportunityId: string) =>
  ['proposal-details', opportunityId] as const;


interface OpportunityProposalsTabProps {
  opportunityId: string;
  pipelineType?: 'qualification' | 'sales' | 'onboarding' | 'renewal' | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  sent: { label: 'Enviada', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  viewed: { label: 'Visualizada', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  accepted: { label: 'Aceita', className: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Recusada', className: 'bg-red-100 text-red-700 border-red-200' },
  expired: { label: 'Expirada', className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const paymentMethodLabels: Record<string, { label: string; icon: string }> = {
  pix: { label: 'PIX', icon: '⚡' },
  boleto: { label: 'Boleto', icon: '📄' },
  cartao: { label: 'Cartão', icon: '💳' },
  transferencia: { label: 'Transferência', icon: '🏦' },
};

const formatCurrency = (value: number, currency: string = 'BRL') => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value);
};

export function OpportunityProposalsTab({ opportunityId, pipelineType }: OpportunityProposalsTabProps) {
  const canCreateProposals = pipelineType === 'sales' || pipelineType === null || pipelineType === undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);
  const [loadingPDF, setLoadingPDF] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailProposalId, setEmailProposalId] = useState<string | null>(null);

  // Fetch proposals
  const { data, isLoading } = useQuery({
    queryKey: [...proposalKeys.lists(), opportunityId],
    queryFn: () => listProposals({ opportunityId }),
  });

  const proposals = data?.data || [];

  // Fetch items and payment terms for all proposals
  const { data: proposalDetails } = useQuery({
    queryKey: proposalDetailsKey(opportunityId),
    queryFn: async () => {
      if (!proposals.length) return {};
      
      const details: Record<string, { items: any[]; paymentTerms: any[]; calculatedTotal: number }> = {};
      
      await Promise.all(
        proposals.map(async (proposal: any) => {
          const [items, paymentTerms] = await Promise.all([
            listProposalItems(proposal.id),
            getPaymentTerms(proposal.id),
          ]);
          
          const calculatedTotal = proposal.total_amount || items.reduce((sum, item) => sum + (item.total || 0), 0);
          
          details[proposal.id] = { items, paymentTerms, calculatedTotal };
        })
      );
      
      return details;
    },
    enabled: proposals.length > 0,
  });

  // Calculate KPIs
  const kpis = {
    total: proposals.length,
    accepted: proposals.filter((p: any) => p.status === 'accepted').length,
    viewed: proposals.filter((p: any) => ['viewed', 'accepted', 'rejected'].includes(p.status || '')).length,
    totalValue: proposals.reduce((sum: number, p: any) => {
      const details = proposalDetails?.[p.id];
      const value = details?.calculatedTotal || p.total_amount || 0;
      return sum + value;
    }, 0),
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      queryClient.invalidateQueries({ queryKey: proposalDetailsKey(opportunityId) });
      toast.success('Proposta excluída com sucesso');
      setDeleteDialogOpen(false);
      setProposalToDelete(null);
    },
    onError: () => {
      toast.error('Erro ao excluir proposta');
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      toast.success('Proposta duplicada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao duplicar proposta');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateProposal(id, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      const statusLabel = variables.status === 'accepted' ? 'aceita' : 'recusada';
      toast.success(`Proposta marcada como ${statusLabel}`);
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const handleSendEmail = (proposal: any) => {
    setEmailProposalId(proposal.id);
    setEmailDialogOpen(true);
  };

  const handleNewProposal = () => {
    navigate(`/app/proposals/new?opportunity_id=${opportunityId}`);
  };

  const handleEditProposal = (proposalId: string) => {
    navigate(`/app/proposals/${proposalId}/edit`);
  };

  const handleGeneratePDF = async (proposalId: string) => {
    setLoadingPDF(proposalId);
    try {
      // Fetch proposal with all related data (organization, account, contact, seller)
      const proposal = await getProposalWithDetails(proposalId);
      if (!proposal) throw new Error('Proposta não encontrada');

      const items = await listProposalItems(proposalId);
      const paymentTerms = await getPaymentTerms(proposalId);

      // Use centralized helper to build PDF data
      // Use centralized helper to build PDF data
      const { pdfData, pdfItems, installments } = buildProposalPDFData(
        proposal,
        items,
        paymentTerms
      );

      await downloadProposalPDF(pdfData, pdfItems, installments);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setLoadingPDF(null);
    }
  };

  const handleQuickView = async (proposalId: string, existingToken?: string) => {
    setLoadingLink(proposalId);
    try {
      let token = existingToken;
      
      if (!token) {
        token = await generatePublicToken(proposalId);
        queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      }
      
      const publicUrl = buildProposalPublicUrl(token);
      await navigator.clipboard.writeText(publicUrl);
      window.open(buildProposalDirectUrl(token), '_blank');
      toast.success('Link copiado e aberto em nova aba!');
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error('Erro ao gerar link');
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

  return (
    <div className="space-y-6">
      {!canCreateProposals && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Propostas não disponíveis</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Propostas só podem ser criadas em funis de vendas. Qualifique esta oportunidade primeiro para criar propostas.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs Section */}
      {proposals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <FileText className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{kpis.total}</p>
                  <p className="text-xs text-slate-600">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-900">{kpis.accepted}</p>
                  <p className="text-xs text-green-600">Aceitas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <Eye className="h-4 w-4 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-900">{kpis.viewed}</p>
                  <p className="text-xs text-purple-600">Visualizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-200 rounded-lg">
                  <DollarSign className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-900">{formatCurrency(kpis.totalValue)}</p>
                  <p className="text-xs text-emerald-600">Valor Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Propostas</h3>
        {canCreateProposals && (
          <Button onClick={handleNewProposal} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Proposta
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h4 className="text-lg font-medium mb-2">Nenhuma proposta</h4>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreateProposals 
                ? 'Crie uma proposta para esta oportunidade'
                : 'Esta oportunidade ainda não possui propostas'}
            </p>
            {canCreateProposals && (
              <Button onClick={handleNewProposal}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Proposta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal: any) => {
            const details = proposalDetails?.[proposal.id];
            const displayValue = proposal.total_amount || details?.calculatedTotal || 0;
            const itemCount = details?.items?.length || 0;
            const paymentTerm = details?.paymentTerms?.[0];
            const paymentMethod = paymentTerm?.payment_method;
            const firstInstallmentDate = paymentTerm?.first_installment_date || paymentTerm?.first_payment_date;
            const statusInfo = statusConfig[proposal.status] || statusConfig.draft;
            const isLoadingPDF = loadingPDF === proposal.id;
            const isLoadingLink = loadingLink === proposal.id;
            
            return (
              <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 
                          className="font-semibold text-base hover:text-primary cursor-pointer transition-colors"
                          onClick={() => handleQuickView(proposal.id, proposal.public_token)}
                        >
                          {proposal.title || 'Proposta sem título'}
                        </h4>
                        <Badge className={statusInfo.className}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                          {proposal.proposal_number || 'Sem número'}
                        </span>
                        <span className="mx-2">•</span>
                        Criada em {formatDateBR(proposal.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold">{formatCurrency(displayValue, proposal.currency)}</p>
                        <p className="text-xs text-muted-foreground">Valor Total</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
                        <p className="text-xs text-muted-foreground">Qtd Itens</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      <div>
                      <p className="text-sm font-semibold">
                          {firstInstallmentDate 
                            ? formatDateBR(firstInstallmentDate)
                            : '-'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">Vencimento</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-semibold">
                          {paymentMethod 
                            ? `${paymentMethodLabels[paymentMethod]?.icon || ''} ${paymentMethodLabels[paymentMethod]?.label || paymentMethod}`
                            : '-'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">Pagamento</p>
                      </div>
                    </div>
                  </div>

                  {/* Views indicator */}
                  {(proposal.views_count || 0) > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Eye className="h-4 w-4" />
                      <span>{proposal.views_count} {proposal.views_count === 1 ? 'visualização' : 'visualizações'}</span>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGeneratePDF(proposal.id)}
                      disabled={isLoadingPDF}
                    >
                      {isLoadingPDF ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      PDF
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickView(proposal.id, proposal.public_token)}
                      disabled={isLoadingLink}
                    >
                      {isLoadingLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Link Rápido
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditProposal(proposal.id)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleSendEmail(proposal)}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar por E-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => duplicateMutation.mutate(proposal.id)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar Proposta
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: 'accepted' })}
                          disabled={proposal.status === 'accepted' || updateStatusMutation.isPending}
                          className="text-green-600"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como Aceita
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: 'rejected' })}
                          disabled={proposal.status === 'rejected' || updateStatusMutation.isPending}
                          className="text-red-600"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Marcar como Recusada
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(proposal.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Proposta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Send Email Composer */}
      {emailProposalId && (
        <ProposalEmailComposer
          open={emailDialogOpen}
          onClose={() => {
            setEmailDialogOpen(false);
            setEmailProposalId(null);
          }}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
          }}
          proposalId={emailProposalId}
          opportunityId={opportunityId}
        />
      )}
    </div>
  );
}
