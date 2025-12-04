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
  AlertCircle
} from 'lucide-react';
import { getProposalByToken, declineProposal, trackView } from '@/services/crm/proposals';
import { listProposalItems } from '@/services/crm/proposal-items';
import { getPaymentTerms, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';
import confetti from 'canvas-confetti';

// Decline reasons for proposals
const DECLINE_REASONS = [
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

  useEffect(() => {
    if (token) {
      loadProposal();
      trackProposalView();
    }
  }, [token]);

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
      if (token) {
        const proposal = await getProposalByToken(token);
        if (proposal?.id) {
          await trackView(proposal.id, {
            userAgent: navigator.userAgent,
          });
        }
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
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
      const selectedReason = DECLINE_REASONS.find(r => r.id === declineReasonId);
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

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
  const recurringTerm = paymentTerms.find(t => t.payment_type === 'recurring');
  const installments = oneTimeTerm ? calculateInstallments(oneTimeTerm, totalAmount) : [];

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

  const account = (proposal as any).opportunity?.account || (proposal as any).opportunity?.accounts;
  const contact = (proposal as any).opportunity?.contact || (proposal as any).opportunity?.contacts;
  const organization = (proposal as any).organization;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Premium Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt={organization.name} className="h-10 w-auto" />
              ) : (
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-lg">{organization?.name || 'Proposta Comercial'}</h1>
                <p className="text-sm text-muted-foreground">
                  {proposal.proposal_number && `Nº ${proposal.proposal_number}`}
                  {proposal.proposal_version && ` • v${proposal.proposal_version}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {proposal.expires_at && (
                <Badge variant={new Date(proposal.expires_at) < new Date() ? 'destructive' : 'secondary'} className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Válida até {formatDateBR(proposal.expires_at)}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Eye className="h-3 w-3" />
                {proposal.views_count || 0} visualizações
              </Badge>
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

        {/* Context Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Supplier Card */}
          {organization && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-semibold">{organization.legal_name || organization.name}</p>
                {organization.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {organization.cnpj}</p>}
                {organization.email && (
                  <p className="text-sm flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {organization.email}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Client Card */}
          {(account || proposal.client_name) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-semibold">{proposal.client_name || account?.nome_fantasia || account?.razao_social}</p>
                {account?.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {account.cnpj}</p>}
                {contact && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium">{contact.nome}</p>
                    {contact.cargo && <p className="text-xs text-muted-foreground">{contact.cargo}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Proposal Info Card */}
          <Card>
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
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</p>
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
                dangerouslySetInnerHTML={{ __html: proposal.introduction }}
              />
            </CardContent>
          </Card>
        )}

        {/* Items Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Itens da Proposta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium">Item</th>
                      <th className="text-center py-3 px-4 font-medium">Qtd</th>
                      <th className="text-right py-3 px-4 font-medium">Preço Un.</th>
                      <th className="text-right py-3 px-4 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div 
                              className="text-sm text-muted-foreground prose prose-sm max-w-none mt-1"
                              dangerouslySetInnerHTML={{ __html: item.description }}
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
                    <tr className="bg-primary/5">
                      <td colSpan={3} className="text-right py-4 px-4 font-bold text-lg">Total:</td>
                      <td className="text-right py-4 px-4 font-bold text-xl text-primary">
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Terms */}
        {(installments.length > 0 || recurringTerm) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Condições de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {installments.length > 0 && oneTimeTerm && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {PAYMENT_METHODS[(oneTimeTerm as any).payment_method || 'boleto']?.icon && (
                      (() => {
                        const Icon = PAYMENT_METHODS[(oneTimeTerm as any).payment_method || 'boleto']?.icon;
                        return <Icon className="h-5 w-5 text-muted-foreground" />;
                      })()
                    )}
                    <h4 className="font-semibold">
                      {PAYMENT_METHODS[(oneTimeTerm as any).payment_method || 'boleto']?.label || 'Boleto Bancário'}
                    </h4>
                    {oneTimeTerm.discount_percent && oneTimeTerm.discount_percent > 0 && (
                      <Badge variant="secondary" className="text-green-600">
                        {oneTimeTerm.discount_percent}% desconto
                      </Badge>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4 font-medium text-sm">Tipo</th>
                          <th className="text-left py-2 px-4 font-medium text-sm">Vencimento</th>
                          <th className="text-right py-2 px-4 font-medium text-sm">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {installments.map((inst, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-3 px-4">
                              {inst.type === 'entry' ? 'Entrada' : `Parcela ${inst.number}`}
                            </td>
                            <td className="py-3 px-4">{formatDateBR(inst.dueDate)}</td>
                            <td className="text-right py-3 px-4 font-medium">
                              {formatCurrency(inst.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {recurringTerm && recurringTerm.monthly_value && recurringTerm.monthly_value > 0 && (
                <div className="space-y-4">
                  {installments.length > 0 && <Separator />}
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Mensalidade Recorrente</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground text-xs">Valor Mensal</Label>
                      <p className="text-xl font-bold text-primary">{formatCurrency(recurringTerm.monthly_value)}</p>
                    </div>
                    {(recurringTerm as any).recurring_due_day && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Dia de Vencimento</Label>
                        <p className="font-medium">Dia {(recurringTerm as any).recurring_due_day}</p>
                      </div>
                    )}
                    {recurringTerm.contract_total && recurringTerm.contract_total > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Total do Contrato</Label>
                        <p className="font-medium">{formatCurrency(recurringTerm.contract_total)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Terms */}
        {proposal.terms && (
          <Card>
            <CardHeader>
              <CardTitle>Termos e Condições</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: proposal.terms }}
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
                dangerouslySetInnerHTML={{ __html: proposal.notes }}
              />
            </CardContent>
          </Card>
        )}

        {/* CTA Footer */}
        {canRespond && (
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="py-8">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">O que deseja fazer?</h3>
                <p className="text-muted-foreground">
                  Revise todos os detalhes acima e escolha uma opção abaixo.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                <Button
                  onClick={() => setShowAcceptModal(true)}
                  size="lg"
                  className="flex-1 h-14 text-lg gap-2"
                >
                  <CheckCircle2 className="h-6 w-6" />
                  Aprovar Proposta
                </Button>
                <Button
                  onClick={() => setShowDeclineModal(true)}
                  variant="outline"
                  size="lg"
                  className="flex-1 h-14 text-lg gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <XCircle className="h-6 w-6" />
                  Recusar Proposta
                </Button>
              </div>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline-block mr-1" />
                Aceite eletrônico com validade jurídica (Lei nº 14.063/2020)
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Footer */}
        <div className="text-center py-6 border-t">
          <p className="text-sm text-muted-foreground mb-2">Dúvidas? Entre em contato:</p>
          <div className="flex items-center justify-center gap-4 text-sm">
            {organization?.email && (
              <a href={`mailto:${organization.email}`} className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-4 w-4" />
                {organization.email}
              </a>
            )}
          </div>
        </div>
      </main>

      {/* Accept Modal */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileCheck className="h-6 w-6 text-primary" />
              Aceitar Proposta
            </DialogTitle>
            <DialogDescription>
              Preencha seus dados para formalizar o aceite. Estas informações terão validade jurídica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome Completo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={acceptorName}
                onChange={(e) => {
                  setAcceptorName(e.target.value);
                  setSignatureName(e.target.value);
                }}
                placeholder="Digite seu nome completo"
              />
            </div>

            {/* Document */}
            <div className="space-y-2">
              <Label htmlFor="document">
                CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                id="document"
                value={acceptorDocument}
                onChange={(e) => setAcceptorDocument(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="position">Cargo/Função</Label>
              <Input
                id="position"
                value={acceptorPosition}
                onChange={(e) => setAcceptorPosition(e.target.value)}
                placeholder="Ex: Diretor, Gerente, Sócio"
              />
            </div>

            {/* Date/Time (readonly) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Aceite</Label>
                <Input value={currentDate} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input value={currentTime} readOnly className="bg-muted" />
              </div>
            </div>

            {/* Digital Signature */}
            <div className="space-y-2">
              <Label htmlFor="signature">
                Assinatura Digital <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signature"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Digite seu nome para assinar"
              />
              {signatureName && (
                <div className="p-4 border rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Preview da assinatura:</p>
                  <p 
                    className="text-2xl text-primary" 
                    style={{ fontFamily: "'Dancing Script', cursive" }}
                  >
                    {signatureName}
                  </p>
                </div>
              )}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/30">
              <Checkbox
                id="accept-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
                Li e concordo com todos os termos e condições apresentados nesta proposta. 
                Entendo que este aceite possui validade jurídica conforme Lei nº 14.063/2020.
                <span className="text-destructive"> *</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAcceptModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAccept}
              disabled={
                processing ||
                !acceptorName.trim() ||
                !acceptorDocument.trim() ||
                !signatureName.trim() ||
                !termsAccepted
              }
              className="flex-1"
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Confirmar Aceite
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-6 w-6 text-destructive" />
              Recusar Proposta
            </DialogTitle>
            <DialogDescription>
              Sentimos muito! Por favor, nos ajude a melhorar informando o motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Reason Select */}
            <div className="space-y-2">
              <Label htmlFor="decline-reason">
                Motivo da Recusa <span className="text-destructive">*</span>
              </Label>
              <Select value={declineReasonId} onValueChange={setDeclineReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo principal..." />
                </SelectTrigger>
                <SelectContent>
                  {DECLINE_REASONS.map((reason) => (
                    <SelectItem key={reason.id} value={reason.id}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="decline-comment">Observações (opcional)</Label>
              <Textarea
                id="decline-comment"
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Conte-nos mais detalhes para podermos melhorar..."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeclineModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={processing || !declineReasonId}
              className="flex-1"
            >
              {processing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Confirmar Recusa'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Fonts for signature */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap" rel="stylesheet" />
    </div>
  );
}