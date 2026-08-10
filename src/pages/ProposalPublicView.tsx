import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Loader2, 
  Eye, 
  Building2, 
  User, 
  Calendar, 
  CreditCard, 
  Wallet, 
  Receipt, 
  Banknote,
  Phone,
  Mail,
  Clock,
  Shield,
  FileCheck,
  AlertCircle,
  Download,
  MapPin,
  ExternalLink,
  MessageCircle,
  Image as ImageIcon,
  Sun,
  Moon

} from 'lucide-react';
import { getProposalByToken, declineProposal, trackView } from '@/services/crm/proposals';
import { getProposalPricingSummary } from '@/lib/proposals/pricingLedger';
import { ProposalPricingBreakdown } from '@/components/proposals/ProposalPricingBreakdown';
import { listProposalItems } from '@/services/crm/proposal-items';
import { formatProposalQuantity } from '@/lib/proposals/formatProposalQuantity';
import { getPaymentTerms, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { PublicProposalApprovedScreen } from '@/components/proposals/PublicProposalApprovedScreen';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';
import { downloadProposalPDF } from '@/lib/proposalPdfGenerator';
import { sanitizeHtml, sanitizeRichTextForDisplay } from '@/lib/sanitizeHtml';
import { usePublicDocumentTheme } from '@/hooks/usePublicDocumentTheme';
import confetti from 'canvas-confetti';
import { extractEmail, extractPhone } from '@/lib/contactFormat';
import { useProposalEngagementTracker } from '@/hooks/useProposalEngagementTracker';
import { PublicProposalDynamicPricingBanner } from '@/components/proposals/PublicProposalDynamicPricingBanner';
import { getDynamicPricingBreakdown, formatDateTime as formatDpDateTime } from '@/lib/proposals/dynamicPricing';
import { getEffectiveAmount } from '@/lib/proposals/effectiveAmount';
import { dynamicPricingEndForInstallments } from '@/lib/proposals/resolvePaymentDueDate';
import { readFrozenSchedule } from '@/lib/proposals/frozenSchedule';

// Fallback decline reasons (used if organization has none configured)
const FALLBACK_DECLINE_REASONS = [
  { id: 'price', label: 'Preço fora do orçamento' },
  { id: 'competitor', label: 'Já fechei com outro fornecedor' },
  { id: 'cancelled', label: 'Não vou mais realizar o evento' },
  { id: 'no_need', label: 'Não preciso mais da solução' },
  { id: 'timing', label: 'Falta de tempo / urgência' },
  { id: 'other', label: 'Outro motivo' },
];

export default function ProposalPublicView() {
  const { token } = useParams<{ token: string }>();
  const { theme: docTheme, toggleTheme: toggleDocTheme } = usePublicDocumentTheme();
  const [proposal, setProposal] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  // Acceptance modal state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptorName, setAcceptorName] = useState('');
  const [acceptorDocument, setAcceptorDocument] = useState('');
  const [acceptorPhone, setAcceptorPhone] = useState('');
  const [acceptorEmail, setAcceptorEmail] = useState('');
  const [acceptorPosition, setAcceptorPosition] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  
  // Customer feedback fields for Win/Loss
  const [winReasonId, setWinReasonId] = useState('');
  const [keyDifferentiators, setKeyDifferentiators] = useState<string[]>([]);
  const [customerFeedback, setCustomerFeedback] = useState('');
  const [winReasons, setWinReasons] = useState<Array<{ id: string; label: string; category?: string }>>([]);
  const [loadingWinReasons, setLoadingWinReasons] = useState(false);
  
  // Decline modal state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReasonId, setDeclineReasonId] = useState('');
  const [declineComment, setDeclineComment] = useState('');
  const [declineReasons, setDeclineReasons] = useState<Array<{ id: string; label: string }>>(FALLBACK_DECLINE_REASONS);
  const [loadingReasons, setLoadingReasons] = useState(false);
  // Competitor name (conditional on selected reason)
  const [competitorName, setCompetitorName] = useState('');
  
  // Contract documents viewer state
  const [currentDocPage, setCurrentDocPage] = useState(0);

  // Engagement tracker
  const { sessionId, trackPdfDownload, trackCopy, trackPrint } = useProposalEngagementTracker({
    proposalId: proposal?.id || '',
    enabled: !!proposal?.id,
  });

  const resolveNetApprovedAmount = (proposalLike: any, fallback = 0) => {
    const effective = getEffectiveAmount(proposalLike);
    return effective.value > 0 ? Number(effective.value.toFixed(2)) : Number(fallback.toFixed(2));
  };

  const pickPaymentTerm = (terms: any[], type: 'one_time' | 'recurring') =>
    terms
      .filter((term) => term.payment_type === type)
      .sort((a, b) => {
        const discountDelta = Number(b.discount_percent || 0) - Number(a.discount_percent || 0);
        if (type === 'one_time' && discountDelta !== 0) return discountDelta;
        return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
      })[0];

  useEffect(() => {
    if (token) {
      loadProposal();
      trackProposalView();
    }
  }, [token]);

  // Load win reasons as soon as the proposal (and its organization) are available,
  // so the acceptance modal NEVER falls back to hardcoded non-UUID ids.
  useEffect(() => {
    if (proposal?.organization_id) {
      loadWinReasons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.organization_id, proposal?.opportunity?.pipeline_id]);

  useEffect(() => {
    if (proposal?.opportunity?.title) {
      document.title = `${proposal.opportunity.title} | Proposta Comercial`;
      return;
    }

    if (proposal?.title) {
      document.title = `${proposal.title} | Proposta Comercial`;
      return;
    }

    document.title = 'Proposta Comercial';
  }, [proposal?.opportunity?.title, proposal?.title]);

  const loadWinReasons = async () => {
    if (!proposal?.organization_id) return;
    
    setLoadingWinReasons(true);
    try {
      const pipelineId = proposal.opportunity?.pipeline_id;
      
      const { data, error } = await supabase.functions.invoke('get-public-win-reasons', {
        body: {
          organizationId: proposal.organization_id,
          pipelineId: pipelineId || null,
        },
      });

      if (error) {
        console.error('Error loading win reasons:', error);
        return;
      }

      if (data?.reasons && data.reasons.length > 0) {
        const sorted = [...data.reasons].sort((a: any, b: any) =>
          String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR', { sensitivity: 'base' })
        );
        setWinReasons(sorted);
      }
    } catch (error) {
      console.error('Error loading win reasons:', error);
    } finally {
      setLoadingWinReasons(false);
    }
  };

  const loadLossReasons = async () => {
    if (!proposal?.organization_id) return;
    
    setLoadingReasons(true);
    try {
      const pipelineId = proposal.opportunity?.pipeline_id;
      
      const { data, error } = await supabase.functions.invoke('get-public-loss-reasons', {
        body: {
          organizationId: proposal.organization_id,
          pipelineId: pipelineId || null,
        },
      });

      if (error) {
        console.error('Error loading loss reasons:', error);
        return;
      }

      if (data?.reasons && data.reasons.length > 0) {
        setDeclineReasons(data.reasons);
      }
      // If no reasons from API, keep fallback
    } catch (error) {
      console.error('Error loading loss reasons:', error);
    } finally {
      setLoadingReasons(false);
    }
  };

  const loadProposal = async () => {
    try {
      setLoadError(null);
      const data = await getProposalByToken(token!);
      if (!data?.id) {
        // RPC returned null — token genuinely not found or expired
        setProposal(null);
        return;
      }
      setProposal(data);

      const bundleItems = (data as any).items || [];
      const bundleTerms = (data as any).payment_terms || [];

      if (bundleItems.length > 0 || bundleTerms.length > 0) {
        setItems(bundleItems);
        setPaymentTerms(bundleTerms);
      } else {
        const [itemsRes, termsRes] = await Promise.allSettled([
          listProposalItems(data.id),
          getPaymentTerms(data.id),
        ]);
        setItems(itemsRes.status === 'fulfilled' ? itemsRes.value : []);
        setPaymentTerms(termsRes.status === 'fulfilled' ? termsRes.value : []);
      }
    } catch (error: any) {
      console.error('[loadProposal] Error:', error);
      setLoadError(error?.message || 'Erro ao carregar proposta');
      setProposal(null);
    } finally {
      setLoading(false);
    }
  };

  const trackProposalView = async () => {
    try {
      if (!token) return;
      
      const proposalData = await getProposalByToken(token);
      if (!proposalData?.id) return;
      
      // Detect if viewer is internal (logged-in seller from same org) or external (client)
      let viewerType: 'internal' | 'external' = 'external';
      let viewerUserId: string | null = null;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if user belongs to the same organization as the proposal
          const { data: userOrgId } = await supabase.rpc('get_user_organization_id');
          
          if (userOrgId && userOrgId === proposalData.organization_id) {
            viewerType = 'internal';
            viewerUserId = session.user.id;
            console.log('[ProposalPublicView] Internal view detected (seller from same org)');
          }
        }
      } catch (authError) {
        // If auth check fails, treat as external (safe default)
        console.log('[ProposalPublicView] Auth check failed, treating as external view');
      }
      
      await trackView(proposalData.id, {
        userAgent: navigator.userAgent,
        viewerType,
        viewerUserId,
        sessionId,
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!proposal?.id) return;
    setDownloadingPDF(true);
    try {
      // Calculate installments for PDF
      const oneTimeTerm = pickPaymentTerm(paymentTerms, 'one_time');
      const recurringTerm = pickPaymentTerm(paymentTerms, 'recurring');
      // Calculate only one-time items total for installments (exclude MRR)
      const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
      const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
      const dpSnapForPdf: any = (proposal as any)?.dynamic_pricing_snapshot ?? null;
      const oneTimeAmountForPdf = resolveNetApprovedAmount(proposal, oneTimeTotal);
      const frozenPdfInstallments = readFrozenSchedule(proposal);
      const pdfInstallments = frozenPdfInstallments
        ? frozenPdfInstallments
        : oneTimeTerm
          ? calculateInstallments(oneTimeTerm, oneTimeAmountForPdf, {
              proposalExpiresAt: (proposal as any)?.expires_at ?? null,
              approvedAmount:
                ((proposal as any)?.status === 'accepted' || oneTimeTerm?.discount_percent)
                  ? Number((proposal as any)?.approved_amount ?? oneTimeAmountForPdf)
                  : null,
              frozenSchedule:
                (proposal as any)?.status === 'accepted' &&
                !!(proposal as any)?.approved_payment_schedule,
              dynamicPricingCurrentEndsAt: dynamicPricingEndForInstallments(
                proposal,
                oneTimeTerm,
                { snapshot: dpSnapForPdf },
              ),
            })
          : [];
      
      // Build recurring payment data for PDF
      const recurringPaymentData = recurringTerm ? {
        monthly_value: recurringTerm.monthly_value || 0,
        contract_months: recurringTerm.contract_months || recurringTerm.contract_duration_months || 12,
        contract_total: recurringTerm.contract_total || (recurringTerm.monthly_value || 0) * (recurringTerm.contract_months || 12),
        first_payment_date: recurringTerm.first_payment_date || recurringTerm.contract_start_date,
        billing_day: recurringTerm.billing_day || recurringTerm.recurring_due_day || 10,
        payment_method: recurringTerm.payment_method,
      } : undefined;
      
      // Add payment method to proposal data
      const proposalWithPaymentMethod = {
        ...proposal,
        payment_method: oneTimeTerm?.payment_method || recurringTerm?.payment_method,
      };
      
      // Generate PDF client-side with recurring data
      await downloadProposalPDF(proposalWithPaymentMethod, items, pdfInstallments, recurringPaymentData);
      trackPdfDownload();
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '';
    const numbers = cnpj.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  };

  // Format phone input as user types
  const formatPhoneInput = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const getWhatsAppLink = (phone: string) => {
    const numbers = phone?.replace(/\D/g, '') || '';
    return `https://wa.me/55${numbers}`;
  };

  const [processingMessage, setProcessingMessage] = useState('');

  // Helper function to invoke edge function with REAL timeout using Promise.race
  const invokeWithRetry = async (
    functionName: string,
    body: Record<string, any>,
    maxRetries: number = 2,
    timeoutMs: number = 30000
  ): Promise<{ data: any; error: any }> => {
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setProcessingMessage(`Tentativa ${attempt + 1}/${maxRetries + 1}... aguarde`);
          console.log(`[ProposalAccept] Retry attempt ${attempt + 1}/${maxRetries + 1}`);
          // Delay between retries (1 second)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Start slow connection warning timer
        const slowWarningId = setTimeout(() => {
          setProcessingMessage('A conexão está lenta, aguarde...');
        }, 10000);

        const startTime = Date.now();
        console.log(`[ProposalAccept] Invoking ${functionName}, attempt ${attempt + 1}`);

        // REAL timeout using Promise.race - this actually works!
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs);
        });

        const result = await Promise.race([
          supabase.functions.invoke(functionName, { body }),
          timeoutPromise
        ]);

        clearTimeout(slowWarningId);

        const elapsed = Date.now() - startTime;
        console.log(`[ProposalAccept] ${functionName} completed in ${elapsed}ms`);

        if (result.error) {
          throw result.error;
        }

        return result;
      } catch (error: any) {
        lastError = error;
        console.error(`[ProposalAccept] Attempt ${attempt + 1} failed:`, error);

        // If it's a timeout error, continue to retry
        if (error.message === 'TIMEOUT_EXCEEDED') {
          console.log('[ProposalAccept] Request timed out, will retry...');
          continue;
        }

        // For network errors, retry
        if (error.message?.includes('NetworkError') || 
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('fetch')) {
          console.log('[ProposalAccept] Network error, will retry...');
          continue;
        }

        // For other errors, don't retry
        break;
      }
    }

    return { data: null, error: lastError };
  };

  // Direct fallback to update proposal status when edge function fails
  const directProposalApproval = async (
    proposalId: string,
    acceptorName: string,
    acceptorDocument: string,
    winReasonIdParam?: string,
    keyDifferentiatorsParam?: string[],
    customerFeedbackParam?: string
  ): Promise<{ success: boolean; error: any }> => {
    console.log('[ProposalAccept] Attempting direct approval fallback (RPC freeze)...');
    setProcessingMessage('Finalizando aprovação...');

    try {
      // PRICE CORE 2.0C — never compute approved_amount/approval_snapshot in
      // the client. The freeze_proposal_approval RPC runs the ledger guard,
      // resolves the canonical effective amount and writes the immutable
      // approval snapshot atomically.
      const { data: freezeRes, error: freezeErr } = await (supabase as any).rpc(
        'freeze_proposal_approval',
        { p_proposal_id: proposalId },
      );
      if (freezeErr) {
        console.error('[ProposalAccept] freeze RPC failed:', freezeErr);
        return { success: false, error: freezeErr };
      }
      if (!freezeRes?.ok) {
        return {
          success: false,
          error: new Error(
            freezeRes?.message ||
              'Não foi possível aprovar a proposta. Existem valores divergentes. Recalcule antes de tentar novamente.',
          ),
        };
      }

      // Acceptance metadata (acceptor identity + customer feedback) is stored
      // outside the frozen snapshot — these fields do not affect pricing.
      const acceptedAt = new Date().toISOString();
      const { error: metaError } = await supabase
        .from('proposals')
        .update({
          acceptor_name: acceptorName,
          acceptor_document: acceptorDocument,
          accepted_at: acceptedAt,
        })
        .eq('id', proposalId);
      if (metaError) {
        console.warn('[ProposalAccept] Non-blocking metadata update failed:', metaError);
      }

      // Win/loss record (non-blocking, unchanged from previous flow)
      try {
        if (proposal?.opportunity?.id) {
          const opportunityId = proposal.opportunity.id;

          let salesCycleDays = null;
          if (proposal.opportunity.created_at) {
            const createdDate = new Date(proposal.opportunity.created_at);
            const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
            salesCycleDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          const { data: existingRecord } = await supabase
            .from('win_loss_records')
            .select('id')
            .eq('opportunity_id', opportunityId)
            .maybeSingle();

          if (existingRecord) {
            await supabase
              .from('win_loss_records')
              .update({
                recorded_by_customer: true,
                acceptor_name: acceptorName,
                acceptor_document: acceptorDocument,
                win_reason_id: winReasonIdParam || null,
                key_differentiator: keyDifferentiatorsParam?.join(',') || null,
                customer_feedback: customerFeedbackParam || null,
              })
              .eq('id', existingRecord.id);
          } else {
            await supabase.from('win_loss_records').insert({
              organization_id: proposal.organization_id,
              opportunity_id: opportunityId,
              outcome: 'won',
              win_reason_id: winReasonIdParam || null,
              key_differentiator: keyDifferentiatorsParam?.join(',') || null,
              customer_feedback: customerFeedbackParam || null,
              final_value: Number(freezeRes?.approved_amount ?? 0) || null,
              sales_cycle_days: salesCycleDays,
              closed_by_proposal_id: proposalId,
              recorded_by_customer: true,
              acceptor_name: acceptorName,
              acceptor_document: acceptorDocument,
            });
          }
        }
      } catch (winLossError) {
        console.error('[ProposalAccept] Non-critical: win_loss_record error:', winLossError);
      }

      console.log('[ProposalAccept] Direct approval (RPC freeze) succeeded!');

      return { success: true, error: null };
    } catch (error) {
      console.error('[ProposalAccept] Direct approval exception:', error);
      return { success: false, error };
    }
  };


  // Direct fallback to update proposal status for decline when edge function fails
  const directProposalDecline = async (
    proposalId: string,
    reason: string,
    reasonId?: string,
    enrichedData?: {
      competitor?: string | null;
      customerFeedback?: string | null;
      priceFactor?: boolean;
      timingFactor?: boolean;
      featureFactor?: boolean;
      relationshipFactor?: boolean;
    }
  ): Promise<{ success: boolean; error: any }> => {
    console.log('[ProposalDecline] Attempting direct decline fallback...');
    setProcessingMessage('Finalizando recusa...');
    
    try {
      const declinedAt = new Date().toISOString();
      
      // Update proposal status
      const { error } = await supabase
        .from('proposals')
        .update({
          status: 'rejected',
          declined_at: declinedAt,
          declined_reason: reason,
          signature_status: 'declined',
        })
        .eq('id', proposalId);

      if (error) {
        console.error('[ProposalDecline] Direct update failed:', error);
        return { success: false, error };
      }

      // Also update opportunity: save client reason and set requires_seller_classification
      if (proposal?.opportunity_id) {
        // Save client's reason in client_loss_reason_id, NOT in loss_reason_id
        // Do NOT set status to 'lost' — seller must classify first
        await supabase
          .from('opportunities')
          .update({
            client_loss_reason_id: reasonId || null,
            requires_seller_classification: true,
          })
          .eq('id', proposal.opportunity_id);

        // Create win_loss_record (check for existing first)
        const { data: existingRecord } = await supabase
          .from('win_loss_records')
          .select('id')
          .eq('opportunity_id', proposal.opportunity_id)
          .maybeSingle();

        if (!existingRecord) {
          await supabase
            .from('win_loss_records')
            .insert({
              organization_id: proposal.organization_id,
              opportunity_id: proposal.opportunity_id,
              outcome: 'lost',
              client_reason_id: reasonId || null,
              recorded_by_customer: true,
              customer_feedback: enrichedData?.customerFeedback || reason,
              competitor: enrichedData?.competitor || null,
              price_factor: enrichedData?.priceFactor || false,
              timing_factor: enrichedData?.timingFactor || false,
              feature_factor: enrichedData?.featureFactor || false,
              relationship_factor: enrichedData?.relationshipFactor || false,
              final_value: proposal.total_amount ?? proposal.value,
              recorded_at: declinedAt,
            });
          console.log('[ProposalDecline] Created win_loss_record via fallback');
        }
      }

      console.log('[ProposalDecline] Direct decline succeeded!');
      return { success: true, error: null };
    } catch (error) {
      console.error('[ProposalDecline] Direct decline exception:', error);
      return { success: false, error };
    }
  };

  const handleAccept = async () => {
    if (!proposal?.id || !token) return;
    
    if (!acceptorName.trim() || !acceptorDocument.trim() || !signatureName.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Validate phone (WhatsApp) - must have at least 10 digits
    const phoneDigits = acceptorPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Por favor, informe um número de WhatsApp válido');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!acceptorEmail.trim() || !emailRegex.test(acceptorEmail.trim())) {
      toast.error('Por favor, informe um e-mail válido');
      return;
    }

    // Validate mandatory feedback fields
    if (!winReasonId) {
      toast.error('Por favor, selecione o motivo pelo qual nos escolheu');
      return;
    }
    
    if (keyDifferentiators.length === 0) {
      toast.error('Por favor, selecione ao menos um diferencial decisivo');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você precisa concordar com os termos para aceitar a proposta');
      return;
    }
    
    setProcessing(true);
    setProcessingMessage('Verificando proposta...');
    
    try {
      // IDEMPOTENCY CHECK: Verify proposal hasn't already been accepted before processing
      const { data: currentProposal, error: checkError } = await supabase
        .from('proposals')
        .select('status')
        .eq('id', proposal.id)
        .single();
      
      if (!checkError && currentProposal?.status === 'accepted') {
        console.log('[ProposalAccept] Proposal already accepted, showing success');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        toast.success('Esta proposta já foi aceita!');
        setShowAcceptModal(false);
        loadProposal();
        setProcessing(false);
        return;
      }
      
      setProcessingMessage('Processando sua aprovação...');
      
      const acceptorIp = 'N/A';
      const acceptorUserAgent = navigator.userAgent;

      console.log('[ProposalAccept] Starting acceptance for proposal:', proposal.id);

      const { error: fnError } = await invokeWithRetry(
        'generate-acceptance-proof',
        {
          proposalId: proposal.id,
          acceptorName,
          acceptorDocument,
          acceptorPhone: acceptorPhone.replace(/\D/g, '') || undefined,
          acceptorEmail: acceptorEmail.trim() || undefined,
          acceptorPosition: acceptorPosition || 'Não informado',
          acceptorIp,
          acceptorUserAgent,
          acceptorSignature: signatureName,
          // Customer feedback for Win/Loss (mandatory)
          winReasonId,
          keyDifferentiator: keyDifferentiators.join(','),
          customerFeedback: customerFeedback.trim() || undefined,
        }
      );

      // If edge function failed after all retries, try direct fallback
      if (fnError) {
        console.error('[ProposalAccept] Edge function failed after retries:', fnError);
        
        const { success, error: directError } = await directProposalApproval(
          proposal.id,
          acceptorName,
          acceptorDocument,
          winReasonId,
          keyDifferentiators,
          customerFeedback.trim() || undefined
        );

        if (!success) {
          throw directError || new Error('Falha ao aprovar proposta');
        }
      }

      // Fire-and-forget: trigger post-acceptance effects (Slack + notifications + modal)
      // This runs on BOTH success and fallback paths to guarantee effects fire
      console.log('[ProposalAccept] Triggering post-acceptance effects from main success path...');
      supabase.functions.invoke('post-acceptance-effects', {
        body: { 
          proposalId: proposal.id, 
        }
      }).then(({ data, error: effectsError }) => {
        if (effectsError) {
          console.error('[ProposalAccept] post-acceptance-effects error (non-blocking):', effectsError);
        } else {
          console.log('[ProposalAccept] post-acceptance-effects result:', data);
        }
      });

      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Trigger SLG client provisioning (non-blocking)
      console.log('[ProposalAccept] Triggering SLG provisioning...');
      supabase.functions.invoke('provision-client-organization', {
        body: {
          proposal_id: proposal.id,
          acceptor_name: acceptorName,
          acceptor_email: acceptorEmail.trim(),
          acceptor_phone: acceptorPhone.replace(/\D/g, '') || undefined,
        }
      }).then(({ data, error }) => {
        if (error) {
          console.error('[ProposalAccept] SLG provisioning error (non-blocking):', error);
        } else {
          console.log('[ProposalAccept] SLG provisioning success:', data);
        }
      });

      toast.success('Proposta aceita com sucesso!');
      setShowAcceptModal(false);
      loadProposal();
    } catch (error: any) {
      console.error('[ProposalAccept] Error accepting proposal:', error);
      
      // Provide specific error messages
      if (error.message === 'TIMEOUT_EXCEEDED') {
        toast.error('A conexão expirou. Por favor, verifique sua internet e tente novamente.');
      } else if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error('Erro ao aceitar proposta. Por favor, tente novamente ou entre em contato.');
      }
    } finally {
      setProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleDecline = async () => {
    if (!proposal?.id || !token || !declineReasonId) {
      toast.error('Por favor, selecione o motivo da recusa');
      return;
    }
    
    setProcessing(true);
    setProcessingMessage('Verificando proposta...');
    
    try {
      // IDEMPOTENCY CHECK: Verify proposal hasn't already been rejected/accepted
      const { data: currentProposal, error: checkError } = await supabase
        .from('proposals')
        .select('status')
        .eq('id', proposal.id)
        .single();
      
      if (!checkError && (currentProposal?.status === 'rejected' || currentProposal?.status === 'accepted')) {
        console.log('[ProposalDecline] Proposal already processed:', currentProposal.status);
        toast.info(currentProposal.status === 'accepted' 
          ? 'Esta proposta já foi aceita!' 
          : 'Esta proposta já foi recusada!');
        setShowDeclineModal(false);
        loadProposal();
        setProcessing(false);
        return;
      }
      
      setProcessingMessage('Processando sua recusa...');
      
      const selectedReason = declineReasons.find(r => r.id === declineReasonId);
      const fullReason = declineComment 
        ? `${selectedReason?.label}: ${declineComment}`
        : selectedReason?.label || declineReasonId;

      console.log('[ProposalDecline] Starting decline for proposal:', proposal.id, 'Reason ID:', declineReasonId);

      // Detect competitor from selected reason label
      const isCompetitorReason = selectedReason?.label?.toLowerCase().includes('fornecedor');

      // Prepare decline data
      const declineData = {
        proposalId: proposal.id,
        reason: fullReason,
        declineReasonId: declineReasonId,
        declinedByName: 'Cliente',
        competitor: isCompetitorReason ? competitorName : null,
        customerFeedback: declineComment || null,
        pricesFactor: false,
        timingFactor: false,
        featureFactor: false,
        relationshipFactor: false,
      };

      // Try edge function with timeout and retry (same as handleAccept)
      const { error: fnError } = await invokeWithRetry(
        'handle-proposal-decline',
        declineData,
        2, // maxRetries
        30000 // timeout 30s
      );

      // If edge function failed, try direct fallback
      if (fnError) {
        console.error('[ProposalDecline] Edge function failed, trying direct update...', fnError);
        
        const { success, error: directError } = await directProposalDecline(
          proposal.id,
          fullReason,
          declineReasonId,
          {
            competitor: isCompetitorReason ? competitorName : null,
            customerFeedback: declineComment || null,
          }
        );

        if (!success) {
          console.error('[ProposalDecline] Direct fallback also failed:', directError);
          throw directError || new Error('Falha ao recusar proposta');
        }
      }

      toast.success('Resposta registrada com sucesso');
      setShowDeclineModal(false);
      loadProposal();
    } catch (error: any) {
      console.error('[ProposalDecline] Error:', error);
      
      if (error.message === 'TIMEOUT_EXCEEDED') {
        toast.error('A conexão expirou. Verifique sua internet e tente novamente.');
      } else if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else {
        toast.error('Erro ao recusar proposta. Por favor, tente novamente.');
      }
    } finally {
      setProcessing(false);
      setProcessingMessage('');
    }
  };

  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-muted">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-muted">
        <Card className="max-w-md shadow-xl">
          <CardContent className="pt-8 text-center">
            {loadError ? (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Erro ao carregar proposta</h2>
                <p className="text-muted-foreground mb-4">
                  Ocorreu um erro temporário. Tente novamente em alguns instantes.
                </p>
                <Button onClick={() => { setLoading(true); loadProposal(); }} variant="outline">
                  Tentar novamente
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Proposta não encontrada</h2>
                <p className="text-muted-foreground">
                  O link pode estar expirado ou inválido.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAccepted = proposal.status === 'accepted';
  const isDeclined = proposal.status === 'rejected';
  const canRespond = !isAccepted && !isDeclined;

  // Separate one-time and recurring items for correct total calculations
  const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
  const recurringMRR = recurringItems.reduce((sum, item) => sum + item.total, 0);
  const oneTimeTerm = pickPaymentTerm(paymentTerms, 'one_time');
  const recurringTerm = pickPaymentTerm(paymentTerms, 'recurring');
  
  // Dynamic pricing snapshot is the single source of truth for the one-time base
  // when active. Manual discount is then applied on top of that base — never on the
  // raw items subtotal — so header / financial summary / installments all match.
  const dpSnapPublic: any = (proposal as any)?.dynamic_pricing_snapshot ?? null;
  const dynamicOneTimeAmount =
    (proposal as any)?.dynamic_pricing_enabled && dpSnapPublic?.current_amount != null
      ? Number(dpSnapPublic.current_amount)
      : null;
  const legacyEffectiveOneTimeBase = dynamicOneTimeAmount ?? oneTimeTotal;
  const dynamicAdjustment = dynamicOneTimeAmount != null ? dynamicOneTimeAmount - oneTimeTotal : 0;

  // Calculate discount from payment terms (over the effective base, not the raw subtotal)
  const paymentDiscountPercent = oneTimeTerm?.discount_percent || 0;
  const legacyPaymentDiscountAmount = legacyEffectiveOneTimeBase * (paymentDiscountPercent / 100);
  const legacyOneTimeWithDiscount = legacyEffectiveOneTimeBase - legacyPaymentDiscountAmount;
  const recurringContractTotal = recurringMRR * (recurringTerm?.contract_months || recurringTerm?.contract_duration_months || 12);
  const legacyEffectiveOneTimeAmount = legacyOneTimeWithDiscount;
  const legacyTotalAmount = legacyEffectiveOneTimeAmount + recurringContractTotal;

  // PRICE CORE 2.0 — Phase B: prefer ledger snapshot when available.
  const pricingSummary = getProposalPricingSummary(proposal);
  const effectiveOneTimeBase = pricingSummary
    ? pricingSummary.subtotalItems + pricingSummary.dynamicAdjustment.amount
    : legacyEffectiveOneTimeBase;
  const paymentDiscountAmount = pricingSummary
    ? pricingSummary.manualDiscount.amount
    : legacyPaymentDiscountAmount;
  const oneTimeWithDiscount = pricingSummary
    ? pricingSummary.baseAmount + pricingSummary.dynamicAdjustment.amount
    : legacyOneTimeWithDiscount;
  const effectiveOneTimeAmount = oneTimeWithDiscount;
  // Ledger's `effective_amount` already includes 1 month of MRR
  // (`recurring_subtotal`). To avoid double-counting recurring revenue in
  // the public header / Proposta card, derive the one-time net from the
  // ledger and then add the full recurring contract total separately.
  const oneTimeNetFromLedger = pricingSummary
    ? pricingSummary.effectiveAmount - pricingSummary.recurringSubtotal
    : null;
  const totalAmount = pricingSummary
    ? (oneTimeNetFromLedger ?? 0) + recurringContractTotal
    : legacyTotalAmount;
  
  // CRITICAL: Use oneTimeTotal for installments, not totalAmount (which includes MRR items)
  // PRICE UX 1.0.3 — usar approved_amount quando proposta já foi aprovada (congela o split)
  //
  // PRICE CORE 2.0 — quando o ledger está disponível e a proposta ainda não
  // foi aprovada, usamos `oneTimeNetFromLedger` (valor já líquido de desconto
  // manual + ajuste dinâmico) como base do cronograma E como `approvedAmount`
  // do options, para que `calculateInstallments` NÃO reaplique o
  // `discount_percent` sobre uma base que já foi descontada. Sem isso o total
  // do cronograma diverge do "Valor vigente" mostrado no header/ledger.
  const ledgerOneTimeNet =
    pricingSummary && oneTimeNetFromLedger != null
      ? Number(Number(oneTimeNetFromLedger).toFixed(2))
      : null;
  const baseForSchedule =
    proposal?.status === 'accepted' && proposal?.approved_amount != null
      ? Number(proposal.approved_amount)
      : ledgerOneTimeNet ?? effectiveOneTimeBase;
  // FREEZE-ON-APPROVAL: quando a proposta está aprovada, o cronograma exibido
  // ao cliente DEVE vir do snapshot congelado em `approved_payment_schedule`.
  // Edições posteriores em `proposal_payment_terms` ou nos tiers dinâmicos
  // jamais podem alterar o que o cliente já aprovou.
  const frozenInstallments = readFrozenSchedule(proposal);
  const installments = frozenInstallments
    ? frozenInstallments
    : oneTimeTerm
      ? calculateInstallments(oneTimeTerm, baseForSchedule, {
          proposalExpiresAt: proposal?.expires_at ?? null,
          approvedAmount:
            proposal?.status === 'accepted'
              ? Number(proposal?.approved_amount ?? effectiveOneTimeAmount)
              : ledgerOneTimeNet,
          frozenSchedule:
            proposal?.status === 'accepted' &&
            !!(proposal as any)?.approved_payment_schedule,
          dynamicPricingCurrentEndsAt: dynamicPricingEndForInstallments(
            proposal,
            oneTimeTerm,
            { snapshot: dpSnapPublic },
          ),
        })
      : [];

  // PRICE UX 1.0.3 — flag pública de pagamento (Pix/ERP)
  const publicPaymentEnabled = proposal?.public_payment_enabled === true;

  const PAYMENT_METHODS: Record<string, { label: string; icon: any }> = {
    'pix': { label: 'PIX', icon: Wallet },
    'boleto': { label: 'Boleto Bancário', icon: Receipt },
    'cartao': { label: 'Cartão de Crédito', icon: CreditCard },
    'transferencia': { label: 'Transferência Bancária', icon: Banknote },
    'dinheiro': { label: 'Dinheiro', icon: Banknote },
    'debito_auto': { label: 'Débito Automático', icon: Banknote },
  };

  const formatCurrency = (value: number) => {
    const currency = (proposal as any).currency || 'BRL';
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';
    return `${symbol} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  // Extract data from expanded query
  const organization = proposal.organization;
  const account = proposal.opportunity?.account;
  const contact = proposal.opportunity?.contact;
  const sellerProfile = proposal.seller_profile;
  const layout = proposal.layout;
  const layoutPages = layout?.pages || [];

  // Build full address
  const orgAddress = organization ? [
    organization.address_street,
    organization.address_number,
    organization.address_complement,
    organization.address_city,
    organization.address_state,
    organization.address_zip
  ].filter(Boolean).join(', ') : '';

  const clientAddress = account ? [
    account.logradouro,
    account.numero,
    account.bairro,
    account.cidade,
    account.uf
  ].filter(Boolean).join(', ') : '';

  // Get primary contact info - use extractPhone/extractEmail to handle both formats
  const contactPhone = extractPhone(contact?.telefones) || '';
  const contactEmail = extractEmail(contact?.emails) || '';
  const accountPhone = extractPhone(account?.telefones) || '';
  const accountEmail = extractEmail(account?.emails) || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-background dark:via-background dark:to-muted">
      {/* Premium Letterhead Header */}
      <header 
        data-section="header"
        className="bg-white dark:bg-card border-b-4 shadow-sm"
        style={{ borderBottomColor: organization?.primary_color || '#6366f1' }}
      >
        <div className="max-w-7xl mx-auto px-3 py-4 md:px-4 md:py-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left: Logo + Company Info */}
            <div className="flex items-start gap-3 md:gap-4">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt={organization.name} className="h-12 md:h-16 w-auto object-contain" />
              ) : (
                <div 
                  className="w-12 h-12 md:w-16 md:h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl md:text-2xl flex-shrink-0"
                  style={{ backgroundColor: organization?.primary_color || '#6366f1' }}
                >
                  {organization?.name?.charAt(0) || 'P'}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-bold text-base md:text-xl leading-tight">{organization?.legal_name || organization?.name || 'Proposta Comercial'}</h1>
                {organization?.cnpj && (
                  <p className="text-xs md:text-sm text-muted-foreground">CNPJ: {formatCNPJ(organization.cnpj)}</p>
                )}
                {orgAddress && (
                  <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="break-words">{orgAddress}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-muted-foreground">
                  {organization?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(organization.phone)}
                    </span>
                  )}
                  {organization?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span className="break-all">{organization.email}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Proposal Info */}
            <div className="w-full md:w-auto md:text-right">
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleDocTheme}
                  aria-label={docTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
                  title={docTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
                >
                  {docTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
              <div className="bg-slate-50 dark:bg-muted rounded-lg p-3 md:p-4 border">
                <p className="text-xs md:text-sm text-muted-foreground mb-1">PROPOSTA COMERCIAL</p>
                <p className="font-bold text-base md:text-lg">
                  {proposal.proposal_number || `#${proposal.id?.slice(0, 8)}`}
                </p>
                {proposal.proposal_version && (
                  <Badge variant="secondary" className="mt-1">v{proposal.proposal_version}</Badge>
                )}
                {proposal.expires_at && (
                  <p className={`text-xs mt-2 ${new Date(proposal.expires_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Válida até {formatDateBR(proposal.expires_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 py-4 md:px-4 md:py-8 space-y-4 md:space-y-6">
        {/* Status Banner — PRICE UX 1.0.3: tela completa pós-aprovação quando aceita */}
        {isAccepted && (
          <PublicProposalApprovedScreen
            proposal={proposal}
            items={items}
            installments={installments as any}
            publicPaymentEnabled={publicPaymentEnabled}
            onDownloadPDF={handleDownloadPDF}
            downloadingPDF={downloadingPDF}
            contactConsultantHref={null}
          />
        )}
        {isDeclined && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardContent className="py-4 md:py-6 flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-red-900">Proposta Recusada</h3>
                <p className="text-sm md:text-base text-red-700">
                  Recusada em {formatDateBR(proposal.declined_at)}
                </p>
                {proposal.declined_reason && (
                  <p className="text-xs md:text-sm text-red-600 mt-1">Motivo: {proposal.declined_reason}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Context Cards Grid - Expanded */}
        <div data-section="context" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Client Card */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold text-lg">
                {proposal.client_name || account?.nome_fantasia || account?.razao_social || 'Cliente'}
              </p>
              {account?.razao_social && account.nome_fantasia && (
                <p className="text-sm text-muted-foreground">{account.razao_social}</p>
              )}
              {account?.cnpj && (
                <p className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(account.cnpj)}</p>
              )}
              {clientAddress && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {clientAddress}
                </p>
              )}
              {(accountPhone || accountEmail) && (
                <div className="pt-2 border-t text-sm space-y-1">
                  {accountPhone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {formatPhone(accountPhone)}
                    </p>
                  )}
                  {accountEmail && (
                    <p className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {accountEmail}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Card */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {contact ? (
                <>
                  <p className="font-semibold text-lg">{contact.nome}</p>
                  {contact.cargo && (
                    <p className="text-sm text-muted-foreground">{contact.cargo}</p>
                  )}
                  {contactPhone && (
                    <a
                      href={getWhatsAppLink(contactPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {formatPhone(contactPhone)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {contactEmail && (
                    <a
                      href={`mailto:${contactEmail}`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Mail className="h-3 w-3" />
                      {contactEmail}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Contato não especificado</p>
              )}
            </CardContent>
          </Card>

          {/* Proposal Info Card */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold">{proposal.opportunity?.title || proposal.title || 'Proposta Comercial'}</p>
              <p className="text-sm text-muted-foreground">
                Criada em {formatDateBR(proposal.created_at)}
              </p>
              <div className="pt-2 border-t space-y-1">
                {pricingSummary ? (
                  (pricingSummary.manualDiscount.amount > 0 ||
                    pricingSummary.dynamicAdjustment.amount !== 0) && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(pricingSummary.subtotalItems + recurringContractTotal)}</span>
                      </div>
                      {pricingSummary.manualDiscount.amount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>
                            Desconto{pricingSummary.manualDiscount.percent
                              ? ` (${pricingSummary.manualDiscount.percent}%)`
                              : ''}:
                          </span>
                          <span>- {formatCurrency(pricingSummary.manualDiscount.amount)}</span>
                        </div>
                      )}
                      {pricingSummary.dynamicAdjustment.amount !== 0 && (
                        <div className="flex justify-between text-sm text-amber-700 dark:text-amber-400">
                          <span>
                            Ajuste dinâmico{pricingSummary.dynamicAdjustment.percent
                              ? ` (${pricingSummary.dynamicAdjustment.percent > 0 ? '+' : ''}${pricingSummary.dynamicAdjustment.percent}%)`
                              : ''}:
                          </span>
                          <span>
                            {pricingSummary.dynamicAdjustment.amount >= 0 ? '+ ' : '- '}
                            {formatCurrency(Math.abs(pricingSummary.dynamicAdjustment.amount))}
                          </span>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  (paymentDiscountAmount > 0) && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {dynamicAdjustment !== 0 ? 'Subtotal vigente:' : 'Subtotal:'}
                        </span>
                        <span>{formatCurrency(effectiveOneTimeBase + recurringContractTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-red-600">
                        <span>
                          Desconto{paymentDiscountPercent > 0 ? ` (${paymentDiscountPercent}%)` : ''}:
                        </span>
                        <span>- {formatCurrency(paymentDiscountAmount)}</span>
                      </div>
                    </>
                  )
                )}
                <p className="text-2xl md:text-3xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                {proposal.views_count || 0} visualizações
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Introduction */}
        {proposal.introduction && (
          <Card>
            <CardHeader>
              <CardTitle>Apresentação</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextForDisplay(proposal.introduction) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Items Tables - Separated by Type */}
        <div data-section="items">
        {items.length > 0 && (() => {
          const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
          const recurringItems = items.filter(item => item.billing_type === 'recurring');
          const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
          const oneTimeSubtotal = oneTimeItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
          const oneTimeItemDiscount = oneTimeSubtotal - oneTimeTotal;
          const hasItemDiscounts = oneTimeItems.some(item => item.discount_percent > 0);
          const recurringMRR = recurringItems.reduce((sum, item) => sum + item.total, 0);
          const recurringSubtotal = recurringItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
          const recurringItemDiscount = recurringSubtotal - recurringMRR;
          const hasRecurringItemDiscounts = recurringItems.some(item => item.discount_percent > 0);
          const dpSnapItems: any = (proposal as any)?.dynamic_pricing_snapshot ?? null;
          const dpBreakdown = getDynamicPricingBreakdown(dpSnapItems, oneTimeTotal);
          const showDpBreakdown = dpBreakdown.active && dpBreakdown.hasAdjustment;
          // PRICE CORE 2.0 — quando o ledger existe e há desconto manual ou
          // ajuste dinâmico, o rodapé da tabela de itens deve exibir a mesma
          // composição canônica do "Resumo Financeiro" (subtotal → desconto
          // → base → ajuste → valor vigente) para não conflitar com o header.
          const ledgerFooterActive = !!(
            pricingSummary &&
            (pricingSummary.manualDiscount.amount > 0 ||
              pricingSummary.dynamicAdjustment.amount !== 0)
          );
          const ledgerManualDiscountPct = pricingSummary?.manualDiscount.percent ?? 0;
          const ledgerOneTimeEffective = pricingSummary
            ? pricingSummary.effectiveAmount - pricingSummary.recurringSubtotal
            : 0;
          const colSpanLabel = hasItemDiscounts ? 5 : 4;

          return (
            <>
              {/* One-time Items */}
              {oneTimeItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-amber-500" />
                      Itens Avulsos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-amber-50 dark:bg-amber-950/30">
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm w-24 md:w-28">Foto</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Item</th>
                            <th className="text-center py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Qtd</th>
                            <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden sm:table-cell">Preço Un.</th>
                            {hasItemDiscounts && (
                              <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden sm:table-cell">Desconto</th>
                            )}
                            <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oneTimeItems.map(item => (
                            <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-2 md:py-4 md:px-4 align-top">
                                {(item as any).image_url ? (
                                  <img
                                    src={(item as any).image_url}
                                    alt={item.name}
                                    loading="eager"
                                    decoding="sync"
                                    className="h-20 w-20 md:h-24 md:w-24 rounded-md object-contain bg-transparent [image-rendering:auto]"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />

                                ) : (
                                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-md border bg-muted flex items-center justify-center" aria-hidden>
                                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 md:py-4 md:px-4">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm md:text-base">{item.name}</div>
                                  {item.description && (
                                    <div 
                                      className="text-xs md:text-sm text-muted-foreground prose prose-sm max-w-none mt-1"
                                      dangerouslySetInnerHTML={{ __html: sanitizeRichTextForDisplay(item.description) }}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="text-center py-3 px-2 md:py-4 md:px-4 text-sm">
                                {(item as any).billing_type === 'point_day' && (item as any).quantity_points && (item as any).billing_days ? (
                                  <span className="whitespace-nowrap">
                                    {(item as any).quantity_points} {(item as any).quantity_points === 1 ? 'pt' : 'pts'} × {(item as any).billing_days} {(item as any).billing_days === 1 ? 'diária' : 'diárias'}
                                  </span>
                                ) : (
                                  <span className="whitespace-nowrap">{formatProposalQuantity(item.quantity, (item as any).measurement_unit)}</span>
                                )}
                              </td>
                              <td className="text-right py-3 px-2 md:py-4 md:px-4 text-sm hidden sm:table-cell">
                                {(item as any).billing_type === 'point_day' && (item as any).unit_price_point_day != null ? (
                                  <span className="whitespace-nowrap">
                                    {formatCurrency((item as any).unit_price_point_day)}
                                    <span className="text-xs text-muted-foreground"> / ponto-dia</span>
                                  </span>
                                ) : (
                                  formatCurrency(item.unit_price)
                                )}
                              </td>
                              {hasItemDiscounts && (
                                <td className="text-right py-3 px-2 md:py-4 md:px-4 text-sm hidden sm:table-cell">
                                  {item.discount_percent > 0 ? (
                                    <span className="text-red-600 font-medium">-{item.discount_percent}%</span>
                                  ) : '-'}
                                </td>
                              )}
                              <td className="text-right py-3 px-2 md:py-4 md:px-4 font-semibold text-sm">
                                {item.discount_percent > 0 && (
                                  <span className="text-xs text-red-500 block sm:hidden">(-{item.discount_percent}%)</span>
                                )}
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {hasItemDiscounts && (
                            <>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground sm:hidden">Subtotal Bruto</td>
                                <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground hidden sm:table-cell">Subtotal Bruto</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm">{formatCurrency(oneTimeSubtotal)}</td>
                              </tr>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 sm:hidden">Descontos dos Itens</td>
                                <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 hidden sm:table-cell">Descontos dos Itens</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 font-medium">- {formatCurrency(oneTimeItemDiscount)}</td>
                              </tr>
                            </>
                          )}
                          {ledgerFooterActive ? (
                            <>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground sm:hidden">Subtotal dos Itens</td>
                                <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground hidden sm:table-cell">Subtotal dos Itens</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm">{formatCurrency(pricingSummary!.subtotalItems)}</td>
                              </tr>
                              {pricingSummary!.manualDiscount.amount > 0 && (
                                <tr className="bg-red-50/60 dark:bg-red-950/20">
                                  <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-red-600 sm:hidden">
                                    Desconto manual{pricingSummary!.manualDiscount.percent ? ` (${pricingSummary!.manualDiscount.percent}%)` : ''}
                                  </td>
                                  <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-red-600 hidden sm:table-cell">
                                    Desconto manual{pricingSummary!.manualDiscount.percent ? ` (${pricingSummary!.manualDiscount.percent}%)` : ''}
                                  </td>
                                  <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-red-600">
                                    - {formatCurrency(pricingSummary!.manualDiscount.amount)}
                                  </td>
                                </tr>
                              )}
                              {pricingSummary!.manualDiscount.amount > 0 && pricingSummary!.dynamicAdjustment.amount !== 0 && (
                                <tr className="bg-muted/20">
                                  <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground sm:hidden">Base comercial</td>
                                  <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground hidden sm:table-cell">Base comercial</td>
                                  <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm">{formatCurrency(pricingSummary!.baseAmount)}</td>
                                </tr>
                              )}
                              {pricingSummary!.dynamicAdjustment.amount !== 0 && (
                                <tr className="bg-amber-50/60 dark:bg-amber-950/20">
                                  <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300 sm:hidden">
                                    Ajuste por antecedência ({pricingSummary!.dynamicAdjustment.percent >= 0 ? '+' : ''}{pricingSummary!.dynamicAdjustment.percent}%)
                                  </td>
                                  <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300 hidden sm:table-cell">
                                    Ajuste por antecedência ({pricingSummary!.dynamicAdjustment.percent >= 0 ? '+' : ''}{pricingSummary!.dynamicAdjustment.percent}%)
                                  </td>
                                  <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300">
                                    {pricingSummary!.dynamicAdjustment.amount >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(pricingSummary!.dynamicAdjustment.amount))}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-amber-50 dark:bg-amber-950/30 border-t-2 border-amber-300 dark:border-amber-700">
                                <td colSpan={3} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base sm:hidden">Total Vigente Hoje</td>
                                <td colSpan={colSpanLabel} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base hidden sm:table-cell">Total Vigente Hoje</td>
                                <td className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-base md:text-lg text-amber-700 dark:text-amber-300">
                                  {formatCurrency(ledgerOneTimeEffective)}
                                </td>
                              </tr>
                            </>
                          ) : showDpBreakdown ? (
                            <>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground sm:hidden">Subtotal dos Itens</td>
                                <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground hidden sm:table-cell">Subtotal dos Itens</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm">{formatCurrency(oneTimeTotal)}</td>
                              </tr>
                              <tr className="bg-amber-50/60 dark:bg-amber-950/20">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300 sm:hidden">
                                  Ajuste por antecedência ({dpBreakdown.adjustmentPercent >= 0 ? '+' : ''}{dpBreakdown.adjustmentPercent.toFixed(1)}%)
                                </td>
                                <td colSpan={colSpanLabel} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300 hidden sm:table-cell">
                                  Ajuste por antecedência ({dpBreakdown.adjustmentPercent >= 0 ? '+' : ''}{dpBreakdown.adjustmentPercent.toFixed(1)}%)
                                </td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm font-medium text-amber-700 dark:text-amber-300">
                                  {dpBreakdown.delta >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(dpBreakdown.delta))}
                                </td>
                              </tr>
                              <tr className="bg-amber-50 dark:bg-amber-950/30 border-t-2 border-amber-300 dark:border-amber-700">
                                <td colSpan={3} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base sm:hidden">Total Vigente Hoje</td>
                                <td colSpan={colSpanLabel} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base hidden sm:table-cell">Total Vigente Hoje</td>
                                <td className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-base md:text-lg text-amber-700 dark:text-amber-300">
                                  {formatCurrency(dpBreakdown.current)}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <tr className="bg-amber-50 dark:bg-amber-950/30">
                              <td colSpan={3} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base sm:hidden">Subtotal Avulso</td>
                              <td colSpan={colSpanLabel} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base hidden sm:table-cell">Subtotal Avulso</td>
                              <td className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-base md:text-lg">{formatCurrency(oneTimeTotal)}</td>
                            </tr>
                          )}
                        </tfoot>
                      </table>
                    </div>
                    {(showDpBreakdown || ledgerFooterActive) && (dpBreakdown.endsAt || dpBreakdown.nextAmount != null) && (
                      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                        {dpBreakdown.endsAt && (
                          <>Condição vigente até <span className="font-medium text-foreground">{formatDpDateTime(dpBreakdown.endsAt)}</span>. </>
                        )}
                        {dpBreakdown.nextAmount != null && dpBreakdown.nextStartsAt && (() => {
                          // Aplica o mesmo % de desconto manual ao "novo valor" para
                          // manter consistência com o header/ledger quando o cliente
                          // já tem desconto negociado.
                          const nextDiscounted = ledgerManualDiscountPct > 0
                            ? dpBreakdown.nextAmount * (1 - ledgerManualDiscountPct / 100)
                            : dpBreakdown.nextAmount;
                          return (
                            <>A partir de <span className="font-medium text-foreground">{formatDpDateTime(dpBreakdown.nextStartsAt)}</span>, novo valor: <span className="font-semibold text-amber-700 dark:text-amber-300">{formatCurrency(nextDiscounted)}</span>.</>
                          );
                        })()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recurring Items (MRR) */}
              {recurringItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-emerald-500" />
                      Itens Recorrentes (MRR)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-emerald-50 dark:bg-emerald-950/30">
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm w-24 md:w-28">Foto</th>
                            <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Item</th>
                            <th className="text-center py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Qtd</th>
                            <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden sm:table-cell">Preço/mês</th>
                            {hasRecurringItemDiscounts && (
                              <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden sm:table-cell">Desconto</th>
                            )}
                            <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">Total/mês</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recurringItems.map(item => (
                            <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-2 md:py-4 md:px-4 align-top">
                                {(item as any).image_url ? (
                                  <img
                                    src={(item as any).image_url}
                                    alt={item.name}
                                    loading="eager"
                                    decoding="sync"
                                    className="h-20 w-20 md:h-24 md:w-24 rounded-md object-contain bg-transparent [image-rendering:auto]"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />

                                ) : (
                                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-md border bg-muted flex items-center justify-center" aria-hidden>
                                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2 md:py-4 md:px-4">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm md:text-base">{item.name}</div>
                                  {item.description && (
                                    <div 
                                      className="text-xs md:text-sm text-muted-foreground prose prose-sm max-w-none mt-1"
                                      dangerouslySetInnerHTML={{ __html: sanitizeRichTextForDisplay(item.description) }}
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="text-center py-3 px-2 md:py-4 md:px-4 text-sm whitespace-nowrap">{formatProposalQuantity(item.quantity, (item as any).measurement_unit)}</td>
                              <td className="text-right py-3 px-2 md:py-4 md:px-4 text-sm hidden sm:table-cell">{formatCurrency(item.unit_price)}/mês</td>
                              {hasRecurringItemDiscounts && (
                                <td className="text-right py-3 px-2 md:py-4 md:px-4 text-sm hidden sm:table-cell">
                                  {item.discount_percent > 0 ? (
                                    <span className="text-red-600 font-medium">-{item.discount_percent}%</span>
                                  ) : '-'}
                                </td>
                              )}
                              <td className="text-right py-3 px-2 md:py-4 md:px-4 font-semibold text-emerald-600 text-sm">
                                {item.discount_percent > 0 && (
                                  <span className="text-xs text-red-500 block sm:hidden">(-{item.discount_percent}%)</span>
                                )}
                                {formatCurrency(item.total)}/mês
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {hasRecurringItemDiscounts && (
                            <>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground sm:hidden">Subtotal Bruto</td>
                                <td colSpan={hasRecurringItemDiscounts ? 5 : 4} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-muted-foreground hidden sm:table-cell">Subtotal Bruto</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm">{formatCurrency(recurringSubtotal)}/mês</td>
                              </tr>
                              <tr className="bg-muted/30">
                                <td colSpan={3} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 sm:hidden">Descontos dos Itens</td>
                                <td colSpan={hasRecurringItemDiscounts ? 5 : 4} className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 hidden sm:table-cell">Descontos dos Itens</td>
                                <td className="text-right py-2 px-2 md:py-3 md:px-4 text-sm text-red-600 font-medium">- {formatCurrency(recurringItemDiscount)}/mês</td>
                              </tr>
                            </>
                          )}
                          <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                            <td colSpan={3} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base sm:hidden">MRR Total</td>
                            <td colSpan={hasRecurringItemDiscounts ? 5 : 4} className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-sm md:text-base hidden sm:table-cell">MRR Total</td>
                            <td className="text-right py-3 px-2 md:py-4 md:px-4 font-bold text-base md:text-lg text-emerald-600">{formatCurrency(recurringMRR)}/mês</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}
        </div>

        {/* Tabela de Preço Dinâmica — informa ao cliente o valor vigente.
            Quando a proposta está APROVADA, renderiza a condição congelada
            (sem recalcular tier vivo). Caso contrário, mostra o snapshot atual. */}
        {(proposal as any)?.dynamic_pricing_enabled && (dpSnapPublic || isAccepted) && (
          <PublicProposalDynamicPricingBanner
            snapshot={dpSnapPublic}
            variant={isAccepted ? 'frozen' : 'public'}
            approvalSnapshot={isAccepted ? (proposal as any)?.approval_snapshot ?? null : null}
            acceptedAt={isAccepted ? (proposal as any)?.accepted_at ?? null : null}
            manualDiscountPercent={pricingSummary?.manualDiscount.percent ?? 0}
          />
        )}

        {/* Payment Terms */}
        <Card data-section="payment">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Condições de Pagamento
            </CardTitle>
          </CardHeader>
          {paymentTerms.length === 0 ? (
            <CardContent>
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm">
                <p className="font-semibold mb-1">Condições de pagamento ainda não definidas</p>
                <p className="text-muted-foreground">
                  Entre em contato com seu consultor comercial para confirmação dos valores e prazos antes do aceite.
                </p>
              </div>
            </CardContent>
          ) : (
            <CardContent className="space-y-6">
              {/* Avulso Payment */}
              {oneTimeTerm && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-green-600" />
                    Pagamento Avulso
                  </h4>
                  
                  {/* Payment Method */}
                  {oneTimeTerm.payment_method && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Forma de Pagamento:</span>
                      <Badge variant="secondary" className="font-medium">
                        {oneTimeTerm.payment_method === 'pix' && 'PIX'}
                        {oneTimeTerm.payment_method === 'boleto' && 'Boleto'}
                        {oneTimeTerm.payment_method === 'cartao' && 'Cartão'}
                        {oneTimeTerm.payment_method === 'transferencia' && 'Transferência'}
                      </Badge>
                    </div>
                  )}

                  {/* Financial Summary — PRICE CORE 2.0 ledger-driven when available */}
                  {pricingSummary ? (
                    (pricingSummary.manualDiscount.amount > 0 ||
                      pricingSummary.dynamicAdjustment.amount !== 0 ||
                      pricingSummary.inventoryAdjustmentAmount !== 0) && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-semibold mb-3">Resumo Financeiro</p>
                        <ProposalPricingBreakdown
                          proposal={proposal}
                          summary={pricingSummary}
                          audience="public"
                          bare
                        />
                      </div>
                    )
                  ) : (
                    paymentDiscountPercent > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-semibold mb-3">Resumo Financeiro</p>
                        <div className="space-y-2">
                          {dynamicAdjustment !== 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Subtotal dos itens:</span>
                              <span>{formatCurrency(oneTimeTotal)}</span>
                            </div>
                          )}
                          {dynamicAdjustment !== 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Ajuste por antecedência:</span>
                              <span>{dynamicAdjustment >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(dynamicAdjustment))}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {dynamicAdjustment !== 0 ? 'Subtotal vigente:' : 'Subtotal Avulso:'}
                            </span>
                            <span>{formatCurrency(effectiveOneTimeBase)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-red-600 font-medium">
                            <span>Desconto ({paymentDiscountPercent}%):</span>
                            <span>- {formatCurrency(paymentDiscountAmount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-base">
                            <span>Total com Desconto:</span>
                            <span className="text-primary">{formatCurrency(oneTimeWithDiscount)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                  
                  {installments.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        {installments.length === 1 && installments[0].type === 'upfront'
                          ? 'Forma e prazo do pagamento:'
                          : 'Cronograma de pagamentos:'}
                      </p>
                      <div className="space-y-2">
                        {installments.map((inst, idx) => {
                          const label = inst.label
                            ?? (inst.type === 'upfront' ? 'Pagamento à vista'
                              : inst.type === 'entry' ? 'Entrada'
                              : inst.type === 'balance' ? 'Saldo'
                              : `Parcela ${inst.number}`);
                          return (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge variant={inst.type === 'upfront' || inst.type === 'entry' ? 'default' : 'outline'} className="text-xs">
                                  {label}
                                </Badge>
                                <span className="text-sm">{formatDateBR(inst.dueDate)}</span>
                              </div>
                              <span className="font-semibold">{formatCurrency(inst.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MRR Payment */}
              {recurringTerm && (
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-blue-600" />
                    Pagamento Recorrente
                  </h4>
                  
                  {/* Payment Method */}
                  {recurringTerm.payment_method && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Forma de Pagamento:</span>
                      <Badge variant="secondary" className="font-medium">
                        {recurringTerm.payment_method === 'boleto' && 'Boleto'}
                        {recurringTerm.payment_method === 'cartao' && 'Cartão'}
                        {recurringTerm.payment_method === 'debito_auto' && 'Débito Automático'}
                        {!['boleto', 'cartao', 'debito_auto'].includes(recurringTerm.payment_method) && recurringTerm.payment_method}
                      </Badge>
                    </div>
                  )}

                  {/* Contract Details Grid */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 md:p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Prazo do Contrato</p>
                        <p className="font-semibold">{recurringTerm.contract_months || recurringTerm.contract_duration_months || 12} meses</p>
                      </div>
                      {(() => {
                        const rawStart = recurringTerm.first_payment_date || recurringTerm.contract_start_date || proposal?.accepted_at || proposal?.sent_at || proposal?.created_at;
                        const billingDay = recurringTerm.billing_day || recurringTerm.recurring_due_day || 10;
                        const m = typeof rawStart === 'string' ? rawStart.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
                        if (!m) return null;
                        const baseYear = Number(m[1]);
                        const baseMonth = Number(m[2]);
                        const baseDay = Number(m[3]);
                        const baseDate = new Date(baseYear, baseMonth - 1, baseDay);
                        let firstDue = new Date(baseYear, baseMonth - 1, billingDay);
                        if (firstDue < baseDate) {
                          firstDue = new Date(baseYear, baseMonth, billingDay);
                        }
                        const firstDueStr = `${firstDue.getFullYear()}-${String(firstDue.getMonth() + 1).padStart(2, '0')}-${String(firstDue.getDate()).padStart(2, '0')}`;

                        return (
                          <div>
                            <p className="text-muted-foreground text-xs">Início</p>
                            <p className="font-semibold">{formatDateBR(firstDueStr)}</p>
                          </div>
                        );
                      })()}
                      <div>
                        <p className="text-muted-foreground text-xs">Dia de Vencimento</p>
                        <p className="font-semibold">Dia {recurringTerm.billing_day || recurringTerm.recurring_due_day || 10}</p>
                      </div>
                      {recurringTerm.auto_renewal && (
                        <div>
                          <p className="text-muted-foreground text-xs">Renovação</p>
                          <p className="font-semibold text-green-600">Automática</p>
                        </div>
                      )}
                    </div>

                    {/* Resumo Valores */}
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Valor Mensal</p>
                        <p className="font-bold text-xl text-blue-600">{formatCurrency(recurringTerm.monthly_value || 0)}</p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                      <div className="text-center border-l border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-muted-foreground">Total do Contrato ({recurringTerm.contract_months || recurringTerm.contract_duration_months || 12}m)</p>
                        <p className="font-bold text-xl">{formatCurrency(recurringTerm.contract_total || (recurringTerm.monthly_value || 0) * (recurringTerm.contract_months || recurringTerm.contract_duration_months || 12))}</p>
                      </div>
                    </div>
                  </div>

                  {/* MRR Installments Schedule */}
                  {(recurringTerm.monthly_value || 0) > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-3">Cronograma de cobranças mensais:</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {Array.from({ length: recurringTerm.contract_months || recurringTerm.contract_duration_months || 12 }).map((_, idx) => {
                          const rawStart = recurringTerm.first_payment_date || recurringTerm.contract_start_date || proposal?.accepted_at || proposal?.sent_at || proposal?.created_at;
                          const billingDay = recurringTerm.billing_day || recurringTerm.recurring_due_day || 10;

                          const m = typeof rawStart === 'string' ? rawStart.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
                          const today = new Date();

                          let firstDue: Date;
                          if (m) {
                            const baseYear = Number(m[1]);
                            const baseMonth = Number(m[2]);
                            const baseDay = Number(m[3]);
                            const baseDate = new Date(baseYear, baseMonth - 1, baseDay);
                            firstDue = new Date(baseYear, baseMonth - 1, billingDay);
                            if (firstDue < baseDate) {
                              firstDue = new Date(baseYear, baseMonth, billingDay);
                            }
                          } else {
                            // Fallback: next billing day from today
                            firstDue = new Date(today.getFullYear(), today.getMonth(), billingDay);
                            if (firstDue < today) {
                              firstDue = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
                            }
                          }

                          const dueDate = new Date(firstDue.getFullYear(), firstDue.getMonth() + idx, billingDay);
                          const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
                          
                          return (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {idx + 1}/{recurringTerm.contract_months || 12}
                                </Badge>
                                <span className="text-sm">{formatDateBR(dueDateStr)}</span>
                              </div>
                              <span className="font-semibold text-blue-600">{formatCurrency(recurringTerm.monthly_value || 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Layout PDF Terms - Sprint D */}
        {layout?.terms_pdf_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Termos e Condições do Contrato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={layout.terms_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors"
              >
                <FileText className="h-5 w-5" />
                Ver Termos do Contrato (PDF)
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        )}

        {/* Contract Attachments from Layout Pages - Inline PDF Viewer */}
        {layoutPages && layoutPages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentos do Contrato
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentDocPage === 0}
                    onClick={() => setCurrentDocPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground min-w-[60px] md:min-w-[80px] text-center">
                    {currentDocPage + 1} de {layoutPages.length}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentDocPage === layoutPages.length - 1}
                    onClick={() => setCurrentDocPage(p => p + 1)}
                  >
                    Próximo
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* PDF Viewer */}
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <iframe
                  src={layoutPages[currentDocPage]?.file_url}
                  className="w-full h-[400px] sm:h-[500px] md:h-[700px]"
                  title={layoutPages[currentDocPage]?.file_name || `Documento ${currentDocPage + 1}`}
                />
              </div>
              
              {/* Current document name */}
              <p className="text-center text-sm text-muted-foreground">
                {layoutPages[currentDocPage]?.file_name || `Documento ${currentDocPage + 1}`}
              </p>
              
              {/* Page navigation thumbnails */}
              <div className="flex gap-2 justify-center flex-wrap">
                {layoutPages.map((page: any, idx: number) => (
                  <button
                    key={page.id || idx}
                    onClick={() => setCurrentDocPage(idx)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      currentDocPage === idx 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background hover:bg-accent border-border"
                    }`}
                    title={page.file_name || `Documento ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Terms and Conditions */}
        {proposal.terms && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Termos e Condições
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextForDisplay(proposal.terms) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {proposal.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeRichTextForDisplay(proposal.notes) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Footer with Seller Contact + Actions */}
        <Card className="bg-slate-50 dark:bg-muted">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Seller Contact Card */}
              {sellerProfile && (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 ring-2 ring-border flex items-center justify-center overflow-hidden flex-shrink-0">
                    {sellerProfile.avatar_url ? (
                      <img src={sellerProfile.avatar_url} alt={sellerProfile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dúvidas? Fale com seu consultor:</p>
                    <p className="font-semibold">{sellerProfile.full_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {sellerProfile.phone && (
                        <a
                          href={getWhatsAppLink(sellerProfile.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      )}
                      {sellerProfile.email && (
                        <a
                          href={`mailto:${sellerProfile.email}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Mail className="h-4 w-4" />
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                  className="gap-2 w-full md:w-auto"
                >
                  {downloadingPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Baixar PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Footer for Response */}
        {canRespond && (
          <Card data-section="cta" className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
            <CardContent className="py-6 md:py-8">
              <div className="text-center space-y-4">
                <h3 className="text-xl md:text-2xl font-bold">Pronto para avançar?</h3>
                <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
                  Clique em "Aprovar Proposta" para aceitar formalmente esta oferta ou "Recusar" para nos informar sua decisão.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 pt-4">
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white px-6 sm:px-8 gap-2 w-full sm:w-auto"
                    onClick={() => setShowAcceptModal(true)}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Aprovar Proposta
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 px-6 sm:px-8 gap-2 w-full sm:w-auto"
                    onClick={() => setShowDeclineModal(true)}
                  >
                    <XCircle className="h-5 w-5" />
                    Recusar Proposta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Accept Modal - Redesigned with scroll and fixed footer */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              Aceitar Proposta
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para formalizar sua aceitação.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Section: Personal Data */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                Seus Dados
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acceptorName" className="text-sm">Nome Completo *</Label>
                  <Input
                    id="acceptorName"
                    placeholder="Seu nome"
                    value={acceptorName}
                    onChange={(e) => setAcceptorName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acceptorDocument" className="text-sm">CPF/CNPJ *</Label>
                  <Input
                    id="acceptorDocument"
                    placeholder="000.000.000-00"
                    value={acceptorDocument}
                    onChange={(e) => setAcceptorDocument(formatCPF(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acceptorPhone" className="text-sm flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                    WhatsApp *
                  </Label>
                  <Input
                    id="acceptorPhone"
                    placeholder="(00) 00000-0000"
                    value={formatPhoneInput(acceptorPhone)}
                    onChange={(e) => setAcceptorPhone(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acceptorEmail" className="text-sm flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    E-mail *
                  </Label>
                  <Input
                    id="acceptorEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={acceptorEmail}
                    onChange={(e) => setAcceptorEmail(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acceptorPosition" className="text-sm">Cargo</Label>
                  <Input
                    id="acceptorPosition"
                    placeholder="Ex: Diretor"
                    value={acceptorPosition}
                    onChange={(e) => setAcceptorPosition(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Data</Label>
                  <Input value={currentDate} disabled className="bg-muted h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Hora</Label>
                  <Input value={currentTime} disabled className="bg-muted h-9 text-sm" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Feedback (Mandatory) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                Seu Feedback
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="winReason" className="text-sm">Por que nos escolheu? *</Label>
                <Select value={winReasonId} onValueChange={setWinReasonId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {loadingWinReasons && winReasons.length === 0 ? (
                      <SelectItem value="__loading" disabled>Carregando motivos…</SelectItem>
                    ) : winReasons.length > 0 ? (
                      winReasons.map(reason => (
                        <SelectItem key={reason.id} value={reason.id}>
                          {reason.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        Nenhum motivo configurado — peça ao time para cadastrar
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Diferencial decisivo * <span className="text-xs text-muted-foreground font-normal">(selecione 1 ou mais)</span></Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'price', label: 'Preço' },
                    { id: 'product', label: 'Produto' },
                    { id: 'service', label: 'Atendimento' },
                    { id: 'brand', label: 'Marca' },
                    { id: 'relationship', label: 'Relacionamento' },
                    { id: 'timing', label: 'Timing' },
                  ].map((diff) => {
                    const isSelected = keyDifferentiators.includes(diff.id);
                    return (
                      <button
                        key={diff.id}
                        type="button"
                        onClick={() => {
                          setKeyDifferentiators(prev =>
                            prev.includes(diff.id)
                              ? prev.filter(d => d !== diff.id)
                              : [...prev, diff.id]
                          );
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white border-green-600 shadow-sm'
                            : 'bg-background hover:bg-accent border-border hover:border-green-300'
                        }`}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {diff.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customerFeedback" className="text-sm">
                  Comentário <span className="text-xs text-muted-foreground font-normal">(opcional - {customerFeedback.length}/280)</span>
                </Label>
                <Textarea
                  id="customerFeedback"
                  placeholder="Algo mais que queira compartilhar..."
                  value={customerFeedback}
                  onChange={(e) => setCustomerFeedback(e.target.value.slice(0, 280))}
                  rows={2}
                  maxLength={280}
                  className="resize-none text-sm"
                />
              </div>
            </div>

            <Separator />

            {/* Section: Signature */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileCheck className="h-4 w-4 text-muted-foreground" />
                Assinatura
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signatureName" className="text-sm">Assinatura Digital *</Label>
                <Input
                  id="signatureName"
                  placeholder="Digite seu nome completo"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="font-signature text-base h-10"
                />
                {signatureName && (
                  <div className="p-3 bg-slate-50 dark:bg-muted rounded-lg border-2 border-dashed">
                    <p className="text-center font-signature text-xl italic text-slate-700 dark:text-foreground">
                      {signatureName}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  Declaro que li, compreendi e aceito os termos desta proposta. 
                  Confirmo autoridade para aceitar em nome da empresa.
                </label>
              </div>
            </div>
          </div>

          {/* Fixed footer with buttons */}
          {(() => {
            const isFormValid = 
              acceptorName.trim() !== '' &&
              acceptorDocument.trim() !== '' &&
              winReasonId !== '' &&
              keyDifferentiators.length > 0 &&
              signatureName.trim() !== '' &&
              termsAccepted;
            
            return (
              <div className="flex gap-3 px-6 py-4 border-t bg-background shrink-0">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setShowAcceptModal(false)}
                  type="button"
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAccept}
                  disabled={processing || !isFormValid}
                  type="button"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirmar Aceite
                    </>
                  )}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Recusar Proposta
            </DialogTitle>
            <DialogDescription>
              Por favor, nos ajude a entender o motivo da sua decisão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Motivo da Recusa *</Label>
              <Select value={declineReasonId} onValueChange={setDeclineReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {declineReasons.map(reason => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional competitor field */}
            {declineReasons.find(r => r.id === declineReasonId)?.label?.toLowerCase().includes('fornecedor') && (
              <div className="space-y-2">
                <Label htmlFor="competitorName">Qual fornecedor?</Label>
                <Input
                  id="competitorName"
                  placeholder="Nome do fornecedor escolhido (opcional)"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="declineComment">Pode nos contar rapidamente o motivo? (opcional)</Label>
              <Textarea
                id="declineComment"
                placeholder="Seu feedback nos ajuda a melhorar..."
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{declineComment.length}/500</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDeclineModal(false)}
                type="button"
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDecline}
                disabled={processing || !declineReasonId}
                type="button"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{processingMessage || 'Processando...'}</span>
                  </span>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Confirmar Recusa
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}