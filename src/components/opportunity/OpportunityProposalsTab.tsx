import { useEffect, useRef, useState } from 'react';
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
  MoreHorizontal,
  Send,
  Copy,
  CheckCircle,
  XCircle,
  Trash2,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Link as LinkIcon,
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
import { orchestrateProposalFinancials } from '@/services/proposals/proposalOrchestrator';
import { ensureProposalDynamicPricingCurrent } from '@/services/proposals/ensureProposalDynamicPricingCurrent';
import {
  getEffectiveAmount,
  getDynamicAdjustment,
  getCommercialStatus,
  getCommercialStatusLabel,
  getCommercialStatusTone,
  getNextAction,
  getProposalsBreakdown,
  pickActiveProposal,
  formatBRL,
  formatPct,
} from '@/lib/proposals/effectiveAmount';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { resolveApprovedCommercialAmount } from '@/lib/proposals/resolveApprovedCommercialAmount';

const proposalDetailsKey = (opportunityId: string) =>
  ['proposal-details', opportunityId] as const;

interface OpportunityProposalsTabProps {
  opportunityId: string;
  pipelineType?: 'qualification' | 'sales' | 'onboarding' | 'renewal' | null;
  onNavigateToAnalytics?: () => void;
}

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  cartao: 'Cartão',
  transferencia: 'Transferência',
};

// Token-aware tone classes (no raw color literals)
const TONE_CLASSES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/30',
    badge: 'bg-success/15 text-success border-success/30',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/30',
    badge: 'bg-warning/15 text-warning border-warning/30',
  },
  danger: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/30',
    badge: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  info: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/30',
    badge: 'bg-primary/15 text-primary border-primary/30',
  },
  muted: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

export function OpportunityProposalsTab({
  opportunityId,
  pipelineType,
  onNavigateToAnalytics,
}: OpportunityProposalsTabProps) {
  const canCreateProposals =
    pipelineType === 'sales' || pipelineType === null || pipelineType === undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);
  const [loadingPDF, setLoadingPDF] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState<string | null>(null);
  const [recalculatingId, setRecalculatingId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailProposalId, setEmailProposalId] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Inherited-proposal mode: if this opportunity is an operational/renewal handoff
  // linked to an accepted commercial proposal, show the original (read-only) instead
  // of letting users create/clone new proposals here.
  const { data: oppMeta } = useQuery({
    queryKey: ['opportunity-handoff-meta', opportunityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, source_opportunity_id, accepted_proposal_id, pipeline:pipelines(pipeline_type)')
        .eq('id', opportunityId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const inheritedPipelineTypes = new Set(['onboarding', 'renewal']);
  const isOperationalHandoff = !!(
    oppMeta?.source_opportunity_id &&
    inheritedPipelineTypes.has(oppMeta?.pipeline?.pipeline_type)
  );

  // Resolve the proposal to inherit: prefer the explicit FK on the opportunity,
  // otherwise fall back to the accepted/approved proposal on the source opportunity.
  const { data: inheritedProposal } = useQuery({
    queryKey: [
      'inherited-accepted-proposal',
      oppMeta?.accepted_proposal_id ?? null,
      oppMeta?.source_opportunity_id ?? null,
    ],
    queryFn: async () => {
      const selectCols =
        'id, proposal_number, title, total_amount, accepted_at, status, opportunity_id, currency, expires_at, public_token, approval_snapshot, approved_amount, approved_payment_schedule, updated_at, created_at';

      // 1. Direct FK
      if (oppMeta?.accepted_proposal_id) {
        const { data, error } = await supabase
          .from('proposals')
          .select(selectCols)
          .eq('id', oppMeta.accepted_proposal_id)
          .maybeSingle();
        if (error) throw error;
        if (data) return data as any;
      }

      // 2. Fallback: look at source opportunity for any accepted/approved proposal
      if (oppMeta?.source_opportunity_id) {
        const { data, error } = await supabase
          .from('proposals')
          .select(selectCols)
          .eq('opportunity_id', oppMeta.source_opportunity_id)
          .is('deleted_at', null);
        if (error) throw error;
        const list = (data ?? []) as any[];
        if (!list.length) return null;
        const score = (p: any) => {
          if (p.accepted_at) return 5;
          if (p.approval_snapshot) return 4;
          if (p.approved_amount != null) return 3;
          if (['accepted', 'approved', 'won'].includes(p.status)) return 2;
          return 0;
        };
        const sorted = [...list].sort((a, b) => {
          const ds = score(b) - score(a);
          if (ds !== 0) return ds;
          const ad = a.accepted_at ?? a.updated_at ?? a.created_at ?? '';
          const bd = b.accepted_at ?? b.updated_at ?? b.created_at ?? '';
          return bd.localeCompare(ad);
        });
        const best = sorted[0];
        if (score(best) === 0) return null;

        // Best-effort backfill of the FK so future loads are direct.
        if (!oppMeta.accepted_proposal_id && best?.id) {
          supabase
            .from('opportunities')
            .update({ accepted_proposal_id: best.id })
            .eq('id', opportunityId)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['opportunity-handoff-meta', opportunityId] });
            });
        }
        return best;
      }

      return null;
    },
    enabled: isOperationalHandoff,
  });



  const { data, isLoading } = useQuery({
    queryKey: [...proposalKeys.lists(), opportunityId],
    queryFn: () => listProposals({ opportunityId }),
    enabled: !isOperationalHandoff,
  });
  const proposals = data?.data || [];

  const { data: proposalDetails } = useQuery({
    queryKey: proposalDetailsKey(opportunityId),
    queryFn: async () => {
      if (!proposals.length) return {};
      const details: Record<string, { items: any[]; paymentTerms: any[] }> = {};
      await Promise.all(
        proposals.map(async (proposal: any) => {
          const [items, paymentTerms] = await Promise.all([
            listProposalItems(proposal.id),
            getPaymentTerms(proposal.id),
          ]);
          details[proposal.id] = { items, paymentTerms };
        }),
      );
      return details;
    },
    enabled: proposals.length > 0,
  });

  const breakdown = getProposalsBreakdown(proposals);
  const activeProposal = pickActiveProposal(proposals as any[]);
  const activeEffective = activeProposal ? getEffectiveAmount(activeProposal) : null;
  const activeDynamic = activeProposal ? getDynamicAdjustment(activeProposal) : null;
  const activeStatus = activeProposal ? getCommercialStatus(activeProposal) : null;
  const activeNextAction = activeProposal ? getNextAction(activeProposal) : null;

  const deleteMutation = useMutation({
    mutationFn: deleteProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      queryClient.invalidateQueries({ queryKey: proposalDetailsKey(opportunityId) });
      toast.success('Proposta excluída com sucesso');
      setDeleteDialogOpen(false);
      setProposalToDelete(null);
    },
    onError: () => toast.error('Erro ao excluir proposta'),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      toast.success('Proposta duplicada com sucesso');
    },
    onError: () => toast.error('Erro ao duplicar proposta'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateProposal(id, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
      const label = variables.status === 'accepted' ? 'aceita' : 'recusada';
      toast.success(`Proposta marcada como ${label}`);
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const handleNewProposal = () => setTemplatePickerOpen(true);
  const handleTemplateConfirmed = (templateId: string) => {
    navigate(`/app/proposals/new?opportunity_id=${opportunityId}&template_id=${templateId}`);
  };
  const handleEditProposal = (proposalId: string) =>
    navigate(`/app/proposals/${proposalId}/edit`);

  const handleGeneratePDF = async (proposalId: string) => {
    setLoadingPDF(proposalId);
    try {
      const proposal = await getProposalWithDetails(proposalId);
      if (!proposal) throw new Error('Proposta não encontrada');
      const items = await listProposalItems(proposalId);
      const paymentTerms = await getPaymentTerms(proposalId);
      const { pdfData, pdfItems, installments } = buildProposalPDFData(
        proposal,
        items,
        paymentTerms,
      );
      await downloadProposalPDF(pdfData, pdfItems, installments);
      toast.success('PDF gerado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setLoadingPDF(null);
    }
  };

  const ensureToken = async (proposal: any): Promise<string> => {
    if (proposal.public_token) return proposal.public_token;
    const token = await generatePublicToken(proposal.id);
    queryClient.invalidateQueries({ queryKey: [...proposalKeys.lists(), opportunityId] });
    return token;
  };

  const handleCopyLink = async (proposal: any) => {
    setLoadingLink(proposal.id);
    try {
      const token = await ensureToken(proposal);
      await navigator.clipboard.writeText(buildProposalPublicUrl(token));
      toast.success('Link copiado');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao copiar link');
    } finally {
      setLoadingLink(null);
    }
  };

  const handleOpenProposal = async (proposal: any) => {
    try {
      const token = await ensureToken(proposal);
      window.open(buildProposalDirectUrl(token), '_blank');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao abrir proposta');
    }
  };

  const handleRecalculate = async (proposalId: string) => {
    setRecalculatingId(proposalId);
    try {
      const res = await orchestrateProposalFinancials(proposalId, 'manual_recalc_tab');
      if (!res?.ok) throw new Error(res?.error || res?.reason || 'Falha ao recalcular');
      await queryClient.invalidateQueries({
        queryKey: [...proposalKeys.lists(), opportunityId],
      });
      toast.success('Valor vigente recalculado');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao recalcular valor vigente');
    } finally {
      setRecalculatingId(null);
    }
  };

  const handleSendWhatsApp = async (proposal: any) => {
    try {
      const token = await ensureToken(proposal);
      const url = buildProposalPublicUrl(token);
      const text = encodeURIComponent(
        `Olá! Segue a proposta ${proposal.proposal_number ?? ''}: ${url}`,
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao abrir WhatsApp');
    }
  };

  const handleDelete = (proposalId: string) => {
    setProposalToDelete(proposalId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (proposalToDelete) deleteMutation.mutate(proposalToDelete);
  };

  if (isOperationalHandoff) {
    return (
      <div className="space-y-4">
        <Alert variant="default" className="border-primary/40 bg-primary/5">
          <FileText className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Proposta aprovada herdada do comercial</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Esta oportunidade operacional usa a proposta originalmente aprovada pelo cliente
            no funil comercial. Não crie nem duplique propostas aqui — o vínculo é único.
          </AlertDescription>
        </Alert>
        {inheritedProposal ? (
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    {inheritedProposal.proposal_number ?? inheritedProposal.title ?? 'Proposta'}
                    <Badge variant="secondary" className="border-primary/30 text-primary bg-primary/10">
                      Herdada do comercial
                    </Badge>
                  </h4>
                  {inheritedProposal.accepted_at && (
                    <p className="text-xs text-muted-foreground">
                      Aceita em {formatDateBR(inheritedProposal.accepted_at)}
                    </p>
                  )}
                </div>
                {(() => {
                  const resolved = resolveApprovedCommercialAmount({
                    opportunity: { accepted_proposal_id: inheritedProposal.id, valor_previsto: null },
                    proposal: inheritedProposal as any,
                  });
                  const legacy = Number(inheritedProposal.total_amount ?? 0);
                  const showLegacy =
                    resolved.is_final_approved_value &&
                    legacy > 0 &&
                    Math.abs(legacy - resolved.approved_commercial_amount) > 0.01;
                  return (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor aprovado</p>
                      <p className="text-2xl font-bold text-success">
                        {formatBRL(resolved.approved_commercial_amount, inheritedProposal.currency ?? 'BRL')}
                      </p>
                      {showLegacy && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Valor original: {formatBRL(legacy, inheritedProposal.currency ?? 'BRL')}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-2 flex-wrap pt-2">
                {inheritedProposal.opportunity_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/app/opportunities/${inheritedProposal.opportunity_id}`)}
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Abrir oportunidade comercial
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGeneratePDF(inheritedProposal.id)}
                  disabled={loadingPDF === inheritedProposal.id}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF aprovado
                </Button>
                {inheritedProposal.public_token && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(buildProposalDirectUrl(inheritedProposal.public_token), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir proposta
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(buildProposalPublicUrl(inheritedProposal.public_token));
                          toast.success('Link copiado');
                        } catch {
                          toast.error('Erro ao copiar link');
                        }
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar link
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
              Carregando proposta original…
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {!canCreateProposals && (
        <Alert variant="default" className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Propostas não disponíveis</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Propostas só podem ser criadas em funis de vendas. Qualifique esta oportunidade
            primeiro para criar propostas.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary cards (commercial decision oriented) */}
      {proposals.length > 0 && activeProposal && activeEffective && activeDynamic && activeStatus && activeNextAction && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1 - Propostas */}
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Propostas</p>
              <p className="text-2xl font-bold leading-none">{breakdown.total}</p>
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                {breakdown.sent > 0 && <div>{breakdown.sent} enviada{breakdown.sent > 1 ? 's' : ''}</div>}
                {breakdown.viewed > 0 && <div>{breakdown.viewed} visualizada{breakdown.viewed > 1 ? 's' : ''}</div>}
                {breakdown.accepted > 0 && <div className="text-success">{breakdown.accepted} aceita{breakdown.accepted > 1 ? 's' : ''}</div>}
                {breakdown.expired > 0 && <div className="text-destructive">{breakdown.expired} vencida{breakdown.expired > 1 ? 's' : ''}</div>}
                {breakdown.rejected > 0 && <div className="text-destructive">{breakdown.rejected} recusada{breakdown.rejected > 1 ? 's' : ''}</div>}
              </div>
            </CardContent>
          </Card>

          {/* 2 - Valor Vigente */}
          <Card className={cn('border', TONE_CLASSES.success.border)}>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Vigente</p>
              <p className={cn('text-2xl font-bold leading-none', TONE_CLASSES.success.text)}>
                {formatBRL(activeEffective.value, activeProposal.currency)}
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                Valor válido para aprovação agora
              </p>
            </CardContent>
          </Card>

          {/* 3 - Ajuste Dinâmico */}
          <Card className={cn(activeDynamic.applied ? `border ${TONE_CLASSES.warning.border}` : '')}>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Ajuste Dinâmico</p>
              {activeDynamic.applied ? (
                <>
                  <p className={cn('text-2xl font-bold leading-none flex items-center gap-1', TONE_CLASSES.warning.text)}>
                    <TrendingUp className="h-5 w-5" />
                    {formatPct(activeDynamic.pct ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">Tabela dinâmica aplicada</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold leading-none text-muted-foreground">—</p>
                  <p className="text-xs text-muted-foreground pt-1">Tabela dinâmica não aplicada</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* 4 - Status Comercial */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status Comercial</p>
              <Badge className={cn('text-sm py-1 px-2.5', TONE_CLASSES[getCommercialStatusTone(activeStatus)].badge)}>
                {getCommercialStatusLabel(activeStatus)}
              </Badge>
              {activeProposal.expires_at && (
                <p className="text-xs text-muted-foreground">
                  Validade {formatDateBR(activeProposal.expires_at)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* 5 - Próxima Ação */}
          <Card className={cn('border', TONE_CLASSES[activeNextAction.tone].border)}>
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Próxima Ação</p>
              <p className={cn('text-sm font-semibold leading-snug', TONE_CLASSES[activeNextAction.tone].text)}>
                {activeNextAction.label}
              </p>
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
            <h4 className="text-lg font-medium mb-2">Nenhuma proposta criada para esta oportunidade</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Crie uma proposta para formalizar a condição comercial e liberar o link público para o cliente.
            </p>
            {canCreateProposals && (
              <Button onClick={handleNewProposal}>
                <Plus className="h-4 w-4 mr-2" />
                Nova proposta
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal: any) => {
            const details = proposalDetails?.[proposal.id];
            const itemCount = details?.items?.length ?? proposal.items_count ?? 0;
            const paymentTerm = details?.paymentTerms?.[0];
            const paymentMethod = paymentTerm?.payment_method;
            const eff = getEffectiveAmount(proposal);
            const dyn = getDynamicAdjustment(proposal);
            const cs = getCommercialStatus(proposal);
            const csTone = getCommercialStatusTone(cs);
            const next = getNextAction(proposal);
            const isLoadingPDF = loadingPDF === proposal.id;
            const isLoadingLink = loadingLink === proposal.id;
            const isRecalculating = recalculatingId === proposal.id;

            const showAlert = dyn.applied || cs === 'expired' || cs === 'expiring_soon';

            return (
              <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4
                          className="font-semibold text-base hover:text-primary cursor-pointer transition-colors"
                          onClick={() => handleOpenProposal(proposal)}
                        >
                          {proposal.title || 'Proposta sem título'}
                        </h4>
                        <Badge className={cn('text-xs', TONE_CLASSES[csTone].badge)}>
                          {getCommercialStatusLabel(cs)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          {proposal.proposal_number || 'Sem número'}
                        </span>
                        <span className="mx-2">•</span>
                        Criada em {formatDateBR(proposal.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Financial block */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Vigente</p>
                      <p className={cn('text-lg font-bold', TONE_CLASSES.success.text)}>
                        {formatBRL(eff.value, proposal.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Original</p>
                      <p className={cn(
                        'text-base font-medium',
                        eff.value !== eff.originalValue ? 'line-through text-muted-foreground' : '',
                      )}>
                        {formatBRL(eff.originalValue, proposal.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ajuste</p>
                      {dyn.applied ? (
                        <p className={cn('text-base font-semibold', TONE_CLASSES.warning.text)}>
                          {formatPct(dyn.pct ?? 0)}{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            (tabela dinâmica)
                          </span>
                        </p>
                      ) : (
                        <p className="text-base font-medium text-muted-foreground">Sem ajuste</p>
                      )}
                    </div>
                  </div>

                  {/* Operational metadata */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                    <span>Itens: <span className="text-foreground font-medium">{itemCount}</span></span>
                    <span>
                      Validade:{' '}
                      <span className="text-foreground font-medium">
                        {proposal.expires_at ? formatDateBR(proposal.expires_at) : '-'}
                      </span>
                    </span>
                    <span>
                      Pagamento:{' '}
                      <span className="text-foreground font-medium">
                        {paymentMethod ? paymentMethodLabels[paymentMethod] ?? paymentMethod : '-'}
                      </span>
                    </span>
                    {(proposal.views_count ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={onNavigateToAnalytics}
                        className="text-primary hover:underline"
                      >
                        Ver analytics da proposta
                      </button>
                    )}
                  </div>

                  {/* Conditional alert */}
                  {showAlert && (
                    <div className={cn(
                      'rounded-md border px-3 py-2 text-sm mb-3',
                      cs === 'expired'
                        ? `${TONE_CLASSES.danger.bg} ${TONE_CLASSES.danger.border} ${TONE_CLASSES.danger.text}`
                        : cs === 'expiring_soon'
                          ? `${TONE_CLASSES.warning.bg} ${TONE_CLASSES.warning.border} ${TONE_CLASSES.warning.text}`
                          : `${TONE_CLASSES.warning.bg} ${TONE_CLASSES.warning.border} ${TONE_CLASSES.warning.text}`,
                    )}>
                      {cs === 'expired'
                        ? 'Proposta vencida. Duplique a proposta para gerar nova condição comercial.'
                        : cs === 'expiring_soon'
                          ? 'Proposta vence em menos de 48h. Priorize follow up.'
                          : `Condição comercial vigente: o valor válido para aprovação é ${formatBRL(eff.value, proposal.currency)}.`}
                    </div>
                  )}

                  {/* AI summary */}
                  <details className="mb-3 group">
                    <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground">
                      <Sparkles className="h-3 w-3" />
                      Resumo para IA
                    </summary>
                    <ul className="mt-2 text-xs text-muted-foreground space-y-0.5 pl-5 list-disc">
                      <li>Status: {getCommercialStatusLabel(cs)}</li>
                      <li>Valor vigente: {formatBRL(eff.value, proposal.currency)}</li>
                      <li>
                        Tabela dinâmica:{' '}
                        {dyn.applied ? `${formatPct(dyn.pct ?? 0)} aplicado` : 'não aplicada'}
                      </li>
                      {proposal.expires_at && (
                        <li>Validade: {formatDateBR(proposal.expires_at)}</li>
                      )}
                      <li>Próxima ação: {next.label}</li>
                    </ul>
                  </details>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleOpenProposal(proposal)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(proposal)}
                      disabled={isLoadingLink}
                    >
                      {isLoadingLink ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4 mr-2" />
                      )}
                      Copiar link
                    </Button>
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
                    <Button variant="outline" size="sm" onClick={() => handleEditProposal(proposal.id)}>
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
                        <DropdownMenuItem onClick={() => {
                          setEmailProposalId(proposal.id);
                          setEmailDialogOpen(true);
                        }}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar por e-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendWhatsApp(proposal)}>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar por WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate(proposal.id)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar proposta
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRecalculate(proposal.id)}
                          disabled={isRecalculating}
                        >
                          {isRecalculating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Recalcular valor vigente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: 'accepted' })}
                          disabled={
                            proposal.status === 'accepted' ||
                            updateStatusMutation.isPending ||
                            !!(proposal as any).pricing_has_divergence
                          }
                          title={
                            (proposal as any).pricing_has_divergence
                              ? 'Existem valores divergentes nesta proposta. Recalcule antes de continuar.'
                              : undefined
                          }
                          className="text-success"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como aceita
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => updateStatusMutation.mutate({ id: proposal.id, status: 'rejected' })}
                          disabled={proposal.status === 'rejected' || updateStatusMutation.isPending}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Registrar recusa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(proposal.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir proposta
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

      <ProposalTemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onConfirm={handleTemplateConfirmed}
      />
    </div>
  );
}
