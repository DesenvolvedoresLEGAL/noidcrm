import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, FileText, Loader2, Eye } from 'lucide-react';
import { getProposalByToken, acceptProposal, declineProposal, trackView } from '@/services/crm/proposals';
import { listProposalItems } from '@/services/crm/proposal-items';
import { getPaymentTerms, calculateInstallments } from '@/services/crm/proposal-payment-terms';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ProposalPublicView() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

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
    if (!token) return;
    
    setProcessing(true);
    try {
      await acceptProposal(token);
      toast.success('Proposta aceita com sucesso!');
      loadProposal();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aceitar proposta');
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
  const installments = oneTimeTerm ? calculateInstallments(oneTimeTerm, totalAmount) : [];

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
                    Aceita em {format(new Date(proposal.accepted_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 mx-auto mb-3 text-red-600" />
                  <h3 className="text-xl font-bold text-red-900 mb-2">Proposta Recusada</h3>
                  <p className="text-red-700">
                    Recusada em {format(new Date(proposal.declined_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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

        {/* Proposal Info */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {proposal.client_name && (
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{proposal.client_name}</p>
                </div>
              )}
              {proposal.created_at && (
                <div>
                  <Label className="text-muted-foreground">Data de Criação</Label>
                  <p className="font-medium">
                    {format(new Date(proposal.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
              {proposal.expires_at && (
                <div>
                  <Label className="text-muted-foreground">Validade</Label>
                  <p className="font-medium">
                    {format(new Date(proposal.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
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
              <div>
                <Label className="text-muted-foreground">Introdução</Label>
                <div 
                  className="prose prose-sm max-w-none mt-2"
                  dangerouslySetInnerHTML={{ __html: proposal.introduction }}
                />
              </div>
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
                          R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right font-medium">
                          R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={3} className="text-right py-3">Total:</td>
                      <td className="text-right text-lg">
                        R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Terms */}
        {installments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Condições de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
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
                      <td>{format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className="text-right font-medium">
                        R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              {!showDeclineForm ? (
                <div className="flex gap-4">
                  <Button
                    onClick={handleAccept}
                    disabled={processing}
                    className="flex-1"
                    size="lg"
                  >
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        Aceitar Proposta
                      </>
                    )}
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
              ) : (
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
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
