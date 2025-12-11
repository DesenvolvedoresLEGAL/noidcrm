import { useEffect, useState } from 'react';
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
  MessageCircle
} from 'lucide-react';
import { getProposalByToken, declineProposal, trackView } from '@/services/crm/proposals';
import { listProposalItems } from '@/services/crm/proposal-items';
import { getPaymentTerms, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';
import { downloadProposalPDF } from '@/lib/proposalPdfGenerator';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import confetti from 'canvas-confetti';

// Fallback decline reasons (used if organization has none configured)
const FALLBACK_DECLINE_REASONS = [
  { id: 'price', label: 'Preço acima do orçamento' },
  { id: 'deadline', label: 'Prazo de entrega não atende' },
  { id: 'competitor', label: 'Fechamos com outro fornecedor' },
  { id: 'cancelled', label: 'Projeto cancelado/adiado' },
  { id: 'specs', label: 'Especificações não atendem' },
  { id: 'trust', label: 'Falta de confiança na empresa' },
  { id: 'payment', label: 'Condições de pagamento não aceitas' },
  { id: 'postponed', label: 'Decisão adiada para próximo período' },
  { id: 'other', label: 'Outro motivo' },
];

export default function ProposalPublicView() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  // Acceptance modal state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptorName, setAcceptorName] = useState('');
  const [acceptorDocument, setAcceptorDocument] = useState('');
  const [acceptorPosition, setAcceptorPosition] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  
  // Decline modal state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReasonId, setDeclineReasonId] = useState('');
  const [declineComment, setDeclineComment] = useState('');
  const [declineReasons, setDeclineReasons] = useState<Array<{ id: string; label: string }>>(FALLBACK_DECLINE_REASONS);
  const [loadingReasons, setLoadingReasons] = useState(false);

  useEffect(() => {
    if (token) {
      loadProposal();
      trackProposalView();
    }
  }, [token]);

  // Load loss reasons when proposal is loaded
  useEffect(() => {
    if (proposal?.organization_id) {
      loadLossReasons();
    }
  }, [proposal?.organization_id]);

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
      const data = await getProposalByToken(token!);
      setProposal(data);
      
      if (data?.id) {
        const [itemsData, termsData] = await Promise.all([
          listProposalItems(data.id),
          getPaymentTerms(data.id),
        ]);
        setItems(itemsData);
        setPaymentTerms(termsData);
      }
    } catch (error: any) {
      toast.error('Proposta não encontrada');
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
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
      const recurringTerm = paymentTerms.find(t => t.payment_type === 'recurring');
      const pdfInstallments = oneTimeTerm ? calculateInstallments(oneTimeTerm, totalAmount) : [];
      
      // Build recurring payment data for PDF
      const recurringPaymentData = recurringTerm ? {
        monthly_value: recurringTerm.monthly_value || 0,
        contract_months: recurringTerm.contract_months || recurringTerm.contract_duration_months || 12,
        contract_total: recurringTerm.contract_total || (recurringTerm.monthly_value || 0) * (recurringTerm.contract_months || 12),
        first_payment_date: recurringTerm.first_payment_date || recurringTerm.contract_start_date,
        billing_day: recurringTerm.recurring_due_day || recurringTerm.billing_day || 10,
        payment_method: recurringTerm.payment_method,
      } : undefined;
      
      // Add payment method to proposal data
      const proposalWithPaymentMethod = {
        ...proposal,
        payment_method: oneTimeTerm?.payment_method || recurringTerm?.payment_method,
      };
      
      // Generate PDF client-side with recurring data
      await downloadProposalPDF(proposalWithPaymentMethod, items, pdfInstallments, recurringPaymentData);
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

  const getWhatsAppLink = (phone: string) => {
    const numbers = phone?.replace(/\D/g, '') || '';
    return `https://wa.me/55${numbers}`;
  };

  const handleAccept = async () => {
    if (!proposal?.id || !token) return;
    
    if (!acceptorName.trim() || !acceptorDocument.trim() || !signatureName.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você precisa concordar com os termos para aceitar a proposta');
      return;
    }
    
    setProcessing(true);
    try {
      const acceptorIp = 'N/A';
      const acceptorUserAgent = navigator.userAgent;

      const { error: fnError } = await supabase.functions.invoke(
        'generate-acceptance-proof',
        {
          body: {
            proposalId: proposal.id,
            acceptorName,
            acceptorDocument,
            acceptorPosition: acceptorPosition || 'Não informado',
            acceptorIp,
            acceptorUserAgent,
            acceptorSignature: signatureName,
          },
        }
      );

      if (fnError) throw fnError;

      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success('Proposta aceita com sucesso!');
      setShowAcceptModal(false);
      loadProposal();
    } catch (error: any) {
      console.error('Error accepting proposal:', error);
      toast.error('Erro ao aceitar proposta');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token || !declineReasonId) {
      toast.error('Por favor, selecione o motivo da recusa');
      return;
    }
    
    setProcessing(true);
    try {
      const selectedReason = declineReasons.find(r => r.id === declineReasonId);
      const fullReason = declineComment 
        ? `${selectedReason?.label}: ${declineComment}`
        : selectedReason?.label || declineReasonId;
      
      await declineProposal(token, fullReason);
      toast.success('Resposta registrada');
      setShowDeclineModal(false);
      loadProposal();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar');
    } finally {
      setProcessing(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md shadow-xl">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Proposta não encontrada</h2>
            <p className="text-muted-foreground">
              O link pode estar expirado ou inválido.
            </p>
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
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
  const recurringTerm = paymentTerms.find(t => t.payment_type === 'recurring');
  // CRITICAL: Use oneTimeTotal for installments, not totalAmount (which includes MRR items)
  const installments = oneTimeTerm ? calculateInstallments(oneTimeTerm, oneTimeTotal) : [];

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

  // Get primary contact info
  const contactPhone = contact?.telefones?.[0] || '';
  const contactEmail = contact?.emails?.[0] || '';
  const accountPhone = account?.telefones?.[0]?.numero || '';
  const accountEmail = account?.emails?.[0] || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Premium Letterhead Header */}
      <header 
        className="bg-white border-b-4 shadow-sm"
        style={{ borderBottomColor: organization?.primary_color || '#6366f1' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            {/* Left: Logo + Company Info */}
            <div className="flex items-start gap-4">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt={organization.name} className="h-16 w-auto object-contain" />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl"
                  style={{ backgroundColor: organization?.primary_color || '#6366f1' }}
                >
                  {organization?.name?.charAt(0) || 'P'}
                </div>
              )}
              <div>
                <h1 className="font-bold text-xl">{organization?.legal_name || organization?.name || 'Proposta Comercial'}</h1>
                {organization?.cnpj && (
                  <p className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(organization.cnpj)}</p>
                )}
                {orgAddress && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" />
                    {orgAddress}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {organization?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(organization.phone)}
                    </span>
                  )}
                  {organization?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {organization.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Proposal Info */}
            <div className="text-right">
              <div className="bg-slate-50 rounded-lg p-4 border">
                <p className="text-sm text-muted-foreground mb-1">PROPOSTA COMERCIAL</p>
                <p className="font-bold text-lg">
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

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Status Banner */}
        {(isAccepted || isDeclined) && (
          <Card className={`border-2 ${isAccepted ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <CardContent className="py-6 flex items-center gap-4">
              {isAccepted ? (
                <>
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-900">Proposta Aceita!</h3>
                    <p className="text-green-700">
                      Aceita em {formatDateBR(proposal.accepted_at)} por {proposal.acceptor_name}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-900">Proposta Recusada</h3>
                    <p className="text-red-700">
                      Recusada em {formatDateBR(proposal.declined_at)}
                    </p>
                    {proposal.declined_reason && (
                      <p className="text-sm text-red-600 mt-1">Motivo: {proposal.declined_reason}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Context Cards Grid - Expanded */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="font-semibold">{proposal.title || 'Proposta Comercial'}</p>
              <p className="text-sm text-muted-foreground">
                Criada em {formatDateBR(proposal.created_at)}
              </p>
              <div className="pt-2 border-t">
                <p className="text-3xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.introduction) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Items Tables - Separated by Type */}
        {items.length > 0 && (() => {
          const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
          const recurringItems = items.filter(item => item.billing_type === 'recurring');
          const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
          const recurringMRR = recurringItems.reduce((sum, item) => sum + item.total, 0);
          
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
                            <th className="text-left py-3 px-4 font-medium">Item</th>
                            <th className="text-center py-3 px-4 font-medium">Qtd</th>
                            <th className="text-right py-3 px-4 font-medium">Preço Un.</th>
                            <th className="text-right py-3 px-4 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oneTimeItems.map(item => (
                            <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="py-4 px-4">
                                <div className="font-medium">{item.name}</div>
                                {item.description && (
                                  <div 
                                    className="text-sm text-muted-foreground prose prose-sm max-w-none mt-1"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                                  />
                                )}
                              </td>
                              <td className="text-center py-4 px-4">{item.quantity}</td>
                              <td className="text-right py-4 px-4">{formatCurrency(item.unit_price)}</td>
                              <td className="text-right py-4 px-4 font-semibold">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-amber-50 dark:bg-amber-950/30">
                            <td colSpan={3} className="text-right py-4 px-4 font-bold">Subtotal Avulso</td>
                            <td className="text-right py-4 px-4 font-bold text-lg">{formatCurrency(oneTimeTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
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
                            <th className="text-left py-3 px-4 font-medium">Item</th>
                            <th className="text-center py-3 px-4 font-medium">Qtd</th>
                            <th className="text-right py-3 px-4 font-medium">Preço/mês</th>
                            <th className="text-right py-3 px-4 font-medium">Total/mês</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recurringItems.map(item => (
                            <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="py-4 px-4">
                                <div className="font-medium">{item.name}</div>
                                {item.description && (
                                  <div 
                                    className="text-sm text-muted-foreground prose prose-sm max-w-none mt-1"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                                  />
                                )}
                              </td>
                              <td className="text-center py-4 px-4">{item.quantity}</td>
                              <td className="text-right py-4 px-4">{formatCurrency(item.unit_price)}/mês</td>
                              <td className="text-right py-4 px-4 font-semibold text-emerald-600">{formatCurrency(item.total)}/mês</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50 dark:bg-emerald-950/30">
                            <td colSpan={3} className="text-right py-4 px-4 font-bold">MRR Total</td>
                            <td className="text-right py-4 px-4 font-bold text-lg text-emerald-600">{formatCurrency(recurringMRR)}/mês</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Investment Summary */}
              {(oneTimeItems.length > 0 || recurringItems.length > 0) && (
                <Card className="border-2 border-primary/20">
                  <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      Resumo do Investimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {oneTimeItems.length > 0 && (
                        <div className="flex justify-between items-center py-2 border-b">
                          <span className="text-muted-foreground">Total Avulso</span>
                          <span className="font-semibold">{formatCurrency(oneTimeTotal)}</span>
                        </div>
                      )}
                      {recurringItems.length > 0 && (
                        <>
                          <div className="flex justify-between items-center py-2 border-b">
                            <span className="text-muted-foreground">MRR (Mensal)</span>
                            <span className="font-semibold text-emerald-600">{formatCurrency(recurringMRR)}/mês</span>
                          </div>
                          {recurringTerm && (
                            <div className="flex justify-between items-center py-2 border-b">
                              <span className="text-muted-foreground">Contrato ({recurringTerm.contract_months || recurringTerm.contract_duration_months || 12} meses)</span>
                              <span className="font-semibold">{formatCurrency(recurringMRR * (recurringTerm.contract_months || recurringTerm.contract_duration_months || 12))}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center py-3 bg-primary/5 rounded-lg px-3 mt-2">
                        <span className="font-bold text-lg">VALOR TOTAL</span>
                        <span className="font-bold text-xl text-primary">
                          {formatCurrency(oneTimeTotal + (recurringItems.length > 0 && recurringTerm 
                            ? recurringMRR * (recurringTerm.contract_months || recurringTerm.contract_duration_months || 12) 
                            : recurringMRR * 12))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}

        {/* Payment Terms */}
        {paymentTerms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Condições de Pagamento
              </CardTitle>
            </CardHeader>
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
                  
                  {installments.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-3">Cronograma de pagamentos:</p>
                      <div className="space-y-2">
                        {installments.map((inst, idx) => (
                          <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                            <div className="flex items-center gap-2">
                              <Badge variant={inst.type === 'entry' ? 'default' : 'outline'} className="text-xs">
                                {inst.type === 'entry' ? 'Entrada' : `Parcela ${inst.number}`}
                              </Badge>
                              <span className="text-sm">{formatDateBR(inst.dueDate)}</span>
                            </div>
                            <span className="font-semibold">{formatCurrency(inst.amount)}</span>
                          </div>
                        ))}
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
                    Pagamento Recorrente (MRR)
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
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Prazo do Contrato</p>
                        <p className="font-semibold">{recurringTerm.contract_months || recurringTerm.contract_duration_months || 12} meses</p>
                      </div>
                      {(recurringTerm.first_payment_date || recurringTerm.contract_start_date) && (
                        <div>
                          <p className="text-muted-foreground text-xs">Início</p>
                          <p className="font-semibold">{formatDateBR(recurringTerm.first_payment_date || recurringTerm.contract_start_date)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs">Dia de Vencimento</p>
                        <p className="font-semibold">Dia {recurringTerm.recurring_due_day || recurringTerm.billing_day || 10}</p>
                      </div>
                      {recurringTerm.auto_renewal && (
                        <div>
                          <p className="text-muted-foreground text-xs">Renovação</p>
                          <p className="font-semibold text-green-600">Automática</p>
                        </div>
                      )}
                    </div>

                    {/* MRR Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">MRR</p>
                        <p className="font-bold text-xl text-blue-600">{formatCurrency(recurringTerm.monthly_value || 0)}</p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                      <div className="text-center border-x border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-muted-foreground">Contrato ({recurringTerm.contract_months || 12}m)</p>
                        <p className="font-bold text-xl">{formatCurrency(recurringTerm.contract_total || (recurringTerm.monthly_value || 0) * (recurringTerm.contract_months || 12))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">ARR</p>
                        <p className="font-bold text-xl">{formatCurrency((recurringTerm.monthly_value || 0) * 12)}</p>
                        <p className="text-xs text-muted-foreground">/ano</p>
                      </div>
                    </div>
                  </div>

                  {/* MRR Installments Schedule */}
                  {(recurringTerm.monthly_value || 0) > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-3">Cronograma de cobranças mensais:</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {Array.from({ length: recurringTerm.contract_months || recurringTerm.contract_duration_months || 12 }).map((_, idx) => {
                          const startDate = recurringTerm.first_payment_date || recurringTerm.contract_start_date;
                          const billingDay = recurringTerm.recurring_due_day || recurringTerm.billing_day || 10;
                          
                          let dueDate = new Date();
                          if (startDate) {
                            const [year, month, day] = startDate.split('-').map(Number);
                            dueDate = new Date(year, month - 1 + idx, billingDay);
                          } else {
                            dueDate.setMonth(dueDate.getMonth() + idx);
                            dueDate.setDate(billingDay);
                          }
                          
                          return (
                            <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {idx + 1}/{recurringTerm.contract_months || 12}
                                </Badge>
                                <span className="text-sm">{formatDateBR(dueDate.toISOString().split('T')[0])}</span>
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
          </Card>
        )}

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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.terms) }}
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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(proposal.notes) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Footer with Seller Contact + Actions */}
        <Card className="bg-slate-50">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Seller Contact Card */}
              {sellerProfile && (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {sellerProfile.avatar_url ? (
                      <img src={sellerProfile.avatar_url} alt={sellerProfile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-primary" />
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
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                  className="gap-2"
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
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <h3 className="text-2xl font-bold">Pronto para avançar?</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Clique em "Aprovar Proposta" para aceitar formalmente esta oferta ou "Recusar" para nos informar sua decisão.
                </p>
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white px-8 gap-2"
                    onClick={() => setShowAcceptModal(true)}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Aprovar Proposta
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 px-8 gap-2"
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

      {/* Accept Modal */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              Aceitar Proposta
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para formalizar a aceitação desta proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acceptorName">Nome Completo *</Label>
              <Input
                id="acceptorName"
                placeholder="Seu nome completo"
                value={acceptorName}
                onChange={(e) => setAcceptorName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptorDocument">CPF/CNPJ *</Label>
              <Input
                id="acceptorDocument"
                placeholder="000.000.000-00"
                value={acceptorDocument}
                onChange={(e) => setAcceptorDocument(formatCPF(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptorPosition">Cargo/Função</Label>
              <Input
                id="acceptorPosition"
                placeholder="Ex: Diretor, Gerente, Proprietário..."
                value={acceptorPosition}
                onChange={(e) => setAcceptorPosition(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Aceite</Label>
                <Input value={currentDate} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input value={currentTime} disabled className="bg-muted" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signatureName">Assinatura Digital *</Label>
              <Input
                id="signatureName"
                placeholder="Digite seu nome completo como assinatura"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="font-signature text-lg"
              />
              {signatureName && (
                <div className="p-4 bg-slate-50 rounded-lg border-2 border-dashed">
                  <p className="text-center font-signature text-2xl italic text-slate-700">
                    {signatureName}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start space-x-2 pt-4 border-t">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                Declaro que li, compreendi e aceito os termos e condições desta proposta. 
                Confirmo que tenho autoridade para aceitar esta proposta em nome da empresa.
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAcceptModal(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={processing}
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
          </div>
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

          <div className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="declineComment">Observações (opcional)</Label>
              <Textarea
                id="declineComment"
                placeholder="Conte-nos mais detalhes sobre sua decisão..."
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                rows={3}
              />
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
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
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