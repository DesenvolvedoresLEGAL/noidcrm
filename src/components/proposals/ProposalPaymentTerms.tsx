import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from './RichTextEditor';
import { Plus, Trash2, AlertTriangle, CreditCard, Wallet, Receipt, Banknote } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaymentTerm, Installment, calculateInstallments, calculateMRRTotal } from '@/services/crm/proposal-payment-terms';
import { ProposalItem } from '@/services/crm/proposal-items';
import { formatDateBR, parseDateOnly } from '@/lib/dateUtils';

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX', icon: Wallet },
  { value: 'boleto', label: 'Boleto Bancário', icon: Receipt },
  { value: 'cartao', label: 'Cartão de Crédito', icon: CreditCard },
  { value: 'transferencia', label: 'Transferência Bancária', icon: Banknote },
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
];

interface ProposalPaymentTermsProps {
  proposalId: string;
  totalAmount: number;
  terms: PaymentTerm[];
  onChange: (terms: PaymentTerm[]) => void;
  items?: ProposalItem[];
  currency?: string;
}

export function ProposalPaymentTerms({
  proposalId,
  totalAmount,
  terms,
  onChange,
  items = [],
  currency = 'BRL',
}: ProposalPaymentTermsProps) {
  const [activeTab, setActiveTab] = useState<'one_time' | 'recurring'>('one_time');
  const [oneTimeTerm, setOneTimeTerm] = useState<Partial<PaymentTerm> & { payment_method?: string }>({
    payment_type: 'one_time',
    payment_method: 'boleto',
    entry_percent: 0,
    discount_percent: 0,
    installments: 1,
    installment_interval_days: 30,
    due_day: 10,
  });
  const [recurringTerm, setRecurringTerm] = useState<Partial<PaymentTerm> & { payment_method?: string; recurring_due_day?: number }>({
    payment_type: 'recurring',
    payment_method: 'boleto',
    monthly_value: 0,
    contract_total: 0,
    recurring_due_day: 10,
  });

  // Calculate total from items if totalAmount is 0
  const calculatedTotal = items.reduce((sum, item) => sum + item.total, 0);
  const effectiveTotal = totalAmount > 0 ? totalAmount : calculatedTotal;

  // Calculate discount
  const discountPercent = oneTimeTerm.discount_percent || 0;
  const discountValue = effectiveTotal * (discountPercent / 100);
  const totalWithDiscount = effectiveTotal - discountValue;

  // Load existing terms
  useEffect(() => {
    const oneTime = terms.find(t => t.payment_type === 'one_time');
    const recurring = terms.find(t => t.payment_type === 'recurring');
    
    if (oneTime) setOneTimeTerm({ ...oneTime, payment_method: (oneTime as any).payment_method || 'boleto' });
    if (recurring) setRecurringTerm({ ...recurring, payment_method: (recurring as any).payment_method || 'boleto', recurring_due_day: (recurring as any).recurring_due_day || 10 });
  }, [terms]);

  const handleSaveTerm = (type: 'one_time' | 'recurring') => {
    const term = type === 'one_time' ? oneTimeTerm : recurringTerm;
    const newTerms = terms.filter(t => t.payment_type !== type);
    newTerms.push({ ...term, proposal_id: proposalId, payment_type: type } as PaymentTerm);
    onChange(newTerms);
  };

  const handleDeleteTerm = (type: 'one_time' | 'recurring') => {
    const newTerms = terms.filter(t => t.payment_type !== type);
    onChange(newTerms);
    
    if (type === 'one_time') {
      setOneTimeTerm({
        payment_type: 'one_time',
        payment_method: 'boleto',
        entry_percent: 0,
        discount_percent: 0,
        installments: 1,
        installment_interval_days: 30,
        due_day: 10,
      });
    } else {
      setRecurringTerm({
        payment_type: 'recurring',
        payment_method: 'boleto',
        monthly_value: 0,
        contract_total: 0,
        recurring_due_day: 10,
      });
    }
  };

  const installments = calculateInstallments(oneTimeTerm as PaymentTerm, effectiveTotal);
  const mrrTotal = calculateMRRTotal(recurringTerm as PaymentTerm, 12);

  const formatCurrency = (value: number) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';
    return `${symbol} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Condições de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert when no value */}
        {effectiveTotal === 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Adicione itens à proposta para calcular as parcelas automaticamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Card */}
        {effectiveTotal > 0 && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
              <p className="text-lg font-semibold">{formatCurrency(effectiveTotal)}</p>
            </div>
            <div className="text-center border-x">
              <p className="text-xs text-muted-foreground mb-1">Desconto</p>
              <p className="text-lg font-semibold text-red-600">
                {discountPercent > 0 ? `- ${formatCurrency(discountValue)}` : '-'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalWithDiscount)}</p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="one_time">Avulso</TabsTrigger>
            <TabsTrigger value="recurring">Recorrente (MRR)</TabsTrigger>
          </TabsList>

          {/* Avulso Form */}
          <TabsContent value="one_time" className="space-y-4 pt-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={oneTimeTerm.payment_method || 'boleto'}
                onValueChange={(v) => setOneTimeTerm({ ...oneTimeTerm, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <method.icon className="h-4 w-4" />
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Entry Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entrada (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={oneTimeTerm.entry_percent || 0}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, entry_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Entrada</Label>
                <Input
                  type="date"
                  value={oneTimeTerm.entry_date || ''}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, entry_date: e.target.value })}
                  disabled={!oneTimeTerm.entry_percent || oneTimeTerm.entry_percent === 0}
                />
              </div>
            </div>

            {/* Installments Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Nº Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  max="48"
                  value={oneTimeTerm.installments || 1}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, installments: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data 1ª Parcela</Label>
                <Input
                  type="date"
                  value={oneTimeTerm.first_installment_date || ''}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, first_installment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={oneTimeTerm.installment_interval_days || 30}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, installment_interval_days: parseInt(e.target.value) || 30 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={oneTimeTerm.due_day || 10}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, due_day: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            {/* Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desconto Financeiro (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={oneTimeTerm.discount_percent || 0}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, discount_percent: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Valor do Desconto</Label>
                <div className="h-10 px-3 flex items-center bg-muted rounded-md text-sm">
                  {discountPercent > 0 ? formatCurrency(discountValue) : '-'}
                </div>
              </div>
            </div>

            {/* Installments Preview */}
            {installments.length > 0 && effectiveTotal > 0 && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Previsão de Parcelas</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead className="w-16">Nº</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((inst, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <span className={inst.type === 'entry' ? 'text-green-600 font-medium' : ''}>
                              {inst.type === 'entry' ? 'Entrada' : 'Parcela'}
                            </span>
                          </TableCell>
                          <TableCell>{inst.type === 'entry' ? '-' : `${inst.number}/${oneTimeTerm.installments}`}</TableCell>
                          <TableCell>
                            {formatDateBR(inst.dueDate)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(inst.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-2">
              <Label>Observações do Pagamento</Label>
              <RichTextEditor
                value={oneTimeTerm.comments || ''}
                onChange={(value) => setOneTimeTerm({ ...oneTimeTerm, comments: value })}
                placeholder="Ex: Dados bancários, chave PIX, condições especiais..."
                minHeight="100px"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleSaveTerm('one_time')} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Salvar Condições
              </Button>
              {terms.some(t => t.payment_type === 'one_time') && (
                <Button variant="destructive" size="icon" onClick={() => handleDeleteTerm('one_time')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>

          {/* MRR Form */}
          <TabsContent value="recurring" className="space-y-4 pt-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Forma de Cobrança</Label>
              <Select
                value={recurringTerm.payment_method || 'boleto'}
                onValueChange={(v) => setRecurringTerm({ ...recurringTerm, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Boleto Recorrente
                    </div>
                  </SelectItem>
                  <SelectItem value="cartao">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão Recorrente
                    </div>
                  </SelectItem>
                  <SelectItem value="debito_auto">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      Débito Automático
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={recurringTerm.monthly_value || 0}
                  onChange={(e) => setRecurringTerm({ ...recurringTerm, monthly_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data 1ª Cobrança</Label>
                <Input
                  type="date"
                  value={recurringTerm.first_payment_date || ''}
                  onChange={(e) => setRecurringTerm({ ...recurringTerm, first_payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringTerm.recurring_due_day || 10}
                  onChange={(e) => setRecurringTerm({ ...recurringTerm, recurring_due_day: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total do Contrato (opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={recurringTerm.contract_total || 0}
                onChange={(e) => setRecurringTerm({ ...recurringTerm, contract_total: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: valor total para contratos com prazo definido"
              />
            </div>

            {/* MRR Summary */}
            {(recurringTerm.monthly_value || 0) > 0 && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">MRR (Mensal)</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(recurringTerm.monthly_value || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ARR (12 meses)</p>
                  <p className="text-lg font-bold">
                    {formatCurrency(mrrTotal)}
                  </p>
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <RichTextEditor
                value={recurringTerm.comments || ''}
                onChange={(value) => setRecurringTerm({ ...recurringTerm, comments: value })}
                placeholder="Ex: Condições de reajuste, vigência do contrato..."
                minHeight="100px"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleSaveTerm('recurring')} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Salvar MRR
              </Button>
              {terms.some(t => t.payment_type === 'recurring') && (
                <Button variant="destructive" size="icon" onClick={() => handleDeleteTerm('recurring')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
