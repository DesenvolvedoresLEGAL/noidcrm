import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, FileText, Loader2, Eye, Building2, User, Calendar, CreditCard, Wallet, Receipt, Banknote } from 'lucide-react';
import { getProposalByToken, declineProposal, trackView } from '@/services/crm/proposals';
import { listProposalItems } from '@/services/crm/proposal-items';
import { getPaymentTerms, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateBR } from '@/lib/dateUtils';

export default function ProposalPublicView() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  
  // Acceptance form fields
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [acceptorName, setAcceptorName] = useState('');
  const [acceptorDocument, setAcceptorDocument] = useState('');
  const [acceptorPosition, setAcceptorPosition] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

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

  const handleAccept = async () => {
    if (!proposal?.id || !token) return;
    
    // Validate form
    if (!acceptorName.trim() || !acceptorDocument.trim() || !acceptorPosition.trim()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (!termsAccepted) {
      toast.error('Você precisa concordar com os termos para aceitar a proposta');
      return;
    }
    
    setProcessing(true);
    try {
      // Get client IP (approximation via browser)
      const acceptorIp = 'N/A'; // In production, get from server
      const acceptorUserAgent = navigator.userAgent;

      // Call edge function to record acceptance and generate proof
      const { error: fnError } = await supabase.functions.invoke(
        'generate-acceptance-proof',
        {
          body: {
            proposalId: proposal.id,
            acceptorName,
            acceptorDocument,
            acceptorPosition,
            acceptorIp,
            acceptorUserAgent,
          },
        }
      );

      if (fnError) throw fnError;

      toast.success('Proposta aceita com sucesso! Um contrato foi criado automaticamente.');
      loadProposal();
      setShowAcceptForm(false);
    } catch (error: any) {
      console.error('Error accepting proposal:', error);
      toast.error('Erro ao aceitar proposta');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token || !declineReason.trim()) {
      toast.error('Por favor, informe o motivo da recusa');
      return;
    }
    
    setProcessing(true);
    try {
      await declineProposal(token, declineReason);
      toast.success('Resposta registrada');
      loadProposal();
      setShowDeclineForm(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Proposta não encontrada</h2>
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

  // Get client data from opportunity if available
  const account = (proposal as any).opportunity?.account || (proposal as any).opportunity?.accounts;
  const contact = (proposal as any).opportunity?.contact || (proposal as any).opportunity?.contacts;
  const organization = (proposal as any).organization;

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Proposta Comercial</h1>
            </div>
            <p className="text-muted-foreground">
              {proposal.title || 'Proposta sem título'}
            </p>
          </CardHeader>
        </Card>

        {/* Status Banner */}
        {(isAccepted || isDeclined) && (
          <Card className={isAccepted ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
            <CardContent className="pt-6 text-center">
              {isAccepted ? (
                <>
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-600" />
                  <h3 className="text-xl font-bold text-green-900 mb-2">Proposta Aceita!</h3>
                  <p className="text-green-700">
                    Aceita em {formatDateBR(proposal.accepted_at)}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-red-600" />
                  <h3 className="text-xl font-bold text-red-900 mb-2">Proposta Recusada</h3>
                  <p className="text-red-700">
                    Recusada em {formatDateBR(proposal.declined_at)}
                  </p>
                  {proposal.declined_reason && (
                    <p className="text-sm text-red-600 mt-2">
                      Motivo: {proposal.declined_reason}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company Info */}
        {organization && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                {organization.logo_url && (
                  <img src={organization.logo_url} alt={organization.name} className="h-16 w-auto" />
                )}
                <div>
                  <h2 className="text-xl font-bold">{organization.name}</h2>
                  {organization.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {organization.cnpj}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Proposal Info */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(proposal.client_name || account?.razao_social || account?.nome_fantasia) && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-4 w-4" /> Cliente
                  </Label>
                  <p className="font-medium">{proposal.client_name || account?.nome_fantasia || account?.razao_social}</p>
                  {account?.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {account.cnpj}</p>}
                </div>
              )}
              {contact && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <User className="h-4 w-4" /> Contato
                  </Label>
                  <p className="font-medium">{contact.nome}</p>
                  {contact.cargo && <p className="text-sm text-muted-foreground">{contact.cargo}</p>}
                </div>
              )}
              {proposal.proposal_number && (
                <div>
                  <Label className="text-muted-foreground">Proposta Nº</Label>
                  <p className="font-medium">{proposal.proposal_number}</p>
                </div>
              )}
              {proposal.created_at && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Data de Criação
                  </Label>
                  <p className="font-medium">{formatDateBR(proposal.created_at)}</p>
                </div>
              )}
              {proposal.expires_at && (
                <div>
                  <Label className="text-muted-foreground">Validade</Label>
                  <p className="font-medium">{formatDateBR(proposal.expires_at)}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Visualizações</Label>
                <p className="font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {proposal.views_count || 0}
                </p>
              </div>
            </div>

            {proposal.introduction && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Apresentação</Label>
                  <div 
                    className="prose prose-sm max-w-none mt-2"
                    dangerouslySetInnerHTML={{ __html: proposal.introduction }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Itens da Proposta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2">Qtd</th>
                      <th className="text-right py-2">Preço Un.</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          )}
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="text-right font-medium">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={3} className="text-right py-3">Total:</td>
                      <td className="text-right text-lg">
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tbody>
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
              {/* One-time payment */}
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
                      <span className="text-sm text-green-600 font-medium ml-2">
                        ({oneTimeTerm.discount_percent}% desconto)
                      </span>
                    )}
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Tipo</th>
                        <th className="text-left py-2">Vencimento</th>
                        <th className="text-right py-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installments.map((inst, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">
                            {inst.type === 'entry' ? 'Entrada' : `Parcela ${inst.number}`}
                          </td>
                          <td>{formatDateBR(inst.dueDate)}</td>
                          <td className="text-right font-medium">
                            {formatCurrency(inst.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {oneTimeTerm.comments && (
                    <div className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: oneTimeTerm.comments }} />
                  )}
                </div>
              )}

              {/* Recurring payment */}
              {recurringTerm && recurringTerm.monthly_value && recurringTerm.monthly_value > 0 && (
                <div className="space-y-4">
                  {installments.length > 0 && <Separator />}
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <h4 className="font-semibold">Mensalidade Recorrente</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                    <div>
                      <Label className="text-muted-foreground text-xs">Valor Mensal</Label>
                      <p className="text-lg font-bold text-primary">{formatCurrency(recurringTerm.monthly_value)}</p>
                    </div>
                    {recurringTerm.first_payment_date && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Primeira Cobrança</Label>
                        <p className="font-medium">{formatDateBR(recurringTerm.first_payment_date)}</p>
                      </div>
                    )}
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
                  {recurringTerm.comments && (
                    <div className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: recurringTerm.comments }} />
                  )}
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

        {/* Action Buttons */}
        {canRespond && (
          <Card>
            <CardContent className="pt-6">
              {!showAcceptForm && !showDeclineForm ? (
                <div className="flex gap-4">
                  <Button
                    onClick={() => setShowAcceptForm(true)}
                    disabled={processing}
                    className="flex-1"
                    size="lg"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Aceitar Proposta
                  </Button>
                  <Button
                    onClick={() => setShowDeclineForm(true)}
                    variant="destructive"
                    className="flex-1"
                    size="lg"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Recusar Proposta
                  </Button>
                </div>
              ) : showAcceptForm ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg mb-4">
                    <h3 className="font-semibold mb-2">📝 Dados para Aceite Formal</h3>
                    <p className="text-sm text-muted-foreground">
                      Preencha seus dados para formalizar o aceite. Estas informações serão 
                      usadas para gerar um comprovante com validade jurídica.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acceptor-name">
                      Nome Completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acceptor-name"
                      value={acceptorName}
                      onChange={(e) => setAcceptorName(e.target.value)}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acceptor-document">
                      CPF/CNPJ <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acceptor-document"
                      value={acceptorDocument}
                      onChange={(e) => setAcceptorDocument(e.target.value)}
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acceptor-position">
                      Cargo/Função <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="acceptor-position"
                      value={acceptorPosition}
                      onChange={(e) => setAcceptorPosition(e.target.value)}
                      placeholder="Ex: Diretor, Gerente, Sócio, etc."
                      required
                    />
                  </div>

                  <div className="flex items-start space-x-2 py-4">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <label
                      htmlFor="terms"
                      className="text-sm leading-relaxed cursor-pointer"
                    >
                      Li e concordo com todos os termos e condições apresentados nesta proposta. 
                      Entendo que este aceite possui validade jurídica e será registrado com 
                      data, hora e hash de verificação. <span className="text-destructive">*</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setShowAcceptForm(false);
                        setAcceptorName('');
                        setAcceptorDocument('');
                        setAcceptorPosition('');
                        setTermsAccepted(false);
                      }}
                      variant="outline"
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
                        !acceptorPosition.trim() ||
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
                </div>
              ) : showDeclineForm ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Motivo da Recusa</Label>
                    <Textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Por favor, informe o motivo da recusa..."
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowDeclineForm(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleDecline}
                      disabled={processing || !declineReason.trim()}
                      variant="destructive"
                      className="flex-1"
                    >
                      {processing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Confirmar Recusa'
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
