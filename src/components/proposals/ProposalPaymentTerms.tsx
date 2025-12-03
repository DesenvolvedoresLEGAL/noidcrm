import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RichTextEditor } from './RichTextEditor';
import { Calendar as CalendarIcon, Plus, Trash2, AlertTriangle } from 'lucide-react';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProposalPaymentTermsProps {
  proposalId: string;
  totalAmount: number;
  terms: PaymentTerm[];
  onChange: (terms: PaymentTerm[]) => void;
  items?: ProposalItem[];
}

export function ProposalPaymentTerms({
  proposalId,
  totalAmount,
  terms,
  onChange,
  items = [],
}: ProposalPaymentTermsProps) {
  const [activeTab, setActiveTab] = useState<'one_time' | 'recurring'>('one_time');
  const [oneTimeTerm, setOneTimeTerm] = useState<Partial<PaymentTerm>>({
    payment_type: 'one_time',
    entry_percent: 0,
    discount_percent: 0,
    installments: 1,
    installment_interval_days: 30,
    due_day: 10,
  });
  const [recurringTerm, setRecurringTerm] = useState<Partial<PaymentTerm>>({
    payment_type: 'recurring',
    monthly_value: 0,
    contract_total: 0,
  });

  // Calculate total from items if totalAmount is 0
  const calculatedTotal = items.reduce((sum, item) => sum + item.total, 0);
  const effectiveTotal = totalAmount > 0 ? totalAmount : calculatedTotal;

  // Load existing terms
  useEffect(() => {
    const oneTime = terms.find(t => t.payment_type === 'one_time');
    const recurring = terms.find(t => t.payment_type === 'recurring');
    
    if (oneTime) setOneTimeTerm(oneTime);
    if (recurring) setRecurringTerm(recurring);
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
        entry_percent: 0,
        discount_percent: 0,
        installments: 1,
        installment_interval_days: 30,
        due_day: 10,
      });
    } else {
      setRecurringTerm({
        payment_type: 'recurring',
        monthly_value: 0,
        contract_total: 0,
      });
    }
  };

  const installments = calculateInstallments(oneTimeTerm as PaymentTerm, effectiveTotal);
  const mrrTotal = calculateMRRTotal(recurringTerm as PaymentTerm, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formas de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Alert when no value */}
        {effectiveTotal === 0 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Nenhum valor definido. Adicione itens à proposta ou defina um valor para calcular as parcelas.
            </AlertDescription>
          </Alert>
        )}

        {/* Show effective total */}
        {effectiveTotal > 0 && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor base para cálculo:</span>
              <span className="text-lg font-bold">
                R$ {effectiveTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="one_time">P&S (Pagamento Único)</TabsTrigger>
            <TabsTrigger value="recurring">MRR (Recorrente)</TabsTrigger>
          </TabsList>

          {/* P&S Form */}
          <TabsContent value="one_time" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data da Entrada</Label>
                <Input
                  type="date"
                  value={oneTimeTerm.entry_date || ''}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, entry_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Entrada (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={oneTimeTerm.entry_percent || 0}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, entry_percent: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Desconto Financeiro (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={oneTimeTerm.discount_percent || 0}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, discount_percent: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número de Parcelas</Label>
                <Input
                  type="number"
                  min="1"
                  value={oneTimeTerm.installments || 1}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, installments: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  value={oneTimeTerm.installment_interval_days || 30}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, installment_interval_days: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data 1ª Parcela</Label>
                <Input
                  type="date"
                  value={oneTimeTerm.first_installment_date || ''}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, first_installment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia de Vencimento</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={oneTimeTerm.due_day || 10}
                  onChange={(e) => setOneTimeTerm({ ...oneTimeTerm, due_day: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comentários</Label>
              <RichTextEditor
                value={oneTimeTerm.comments || ''}
                onChange={(value) => setOneTimeTerm({ ...oneTimeTerm, comments: value })}
                placeholder="Adicione comentários sobre esta forma de pagamento..."
                minHeight="120px"
              />
            </div>

            {/* Installments Preview */}
            {installments.length > 0 && effectiveTotal > 0 && (
              <div className="space-y-2">
                <Label>Preview das Parcelas</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nº</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{inst.type === 'entry' ? 'Entrada' : 'Parcela'}</TableCell>
                        <TableCell>{inst.type === 'entry' ? '-' : inst.number}</TableCell>
                        <TableCell>
                          {format(new Date(inst.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {inst.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right">
                        R$ {installments.reduce((sum, i) => sum + i.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => handleSaveTerm('one_time')} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Salvar P&S
              </Button>
              {terms.some(t => t.payment_type === 'one_time') && (
                <Button variant="destructive" onClick={() => handleDeleteTerm('one_time')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>

          {/* MRR Form */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data 1ª Parcela</Label>
                <Input
                  type="date"
                  value={recurringTerm.first_payment_date || ''}
                  onChange={(e) => setRecurringTerm({ ...recurringTerm, first_payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Mensal (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={recurringTerm.monthly_value || 0}
                  onChange={(e) => setRecurringTerm({ ...recurringTerm, monthly_value: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total do Contrato (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={recurringTerm.contract_total || 0}
                onChange={(e) => setRecurringTerm({ ...recurringTerm, contract_total: parseFloat(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">
                MRR (12 meses): R$ {mrrTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Comentários</Label>
              <RichTextEditor
                value={recurringTerm.comments || ''}
                onChange={(value) => setRecurringTerm({ ...recurringTerm, comments: value })}
                placeholder="Adicione comentários sobre esta forma de pagamento..."
                minHeight="120px"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSaveTerm('recurring')} className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Salvar MRR
              </Button>
              {terms.some(t => t.payment_type === 'recurring') && (
                <Button variant="destructive" onClick={() => handleDeleteTerm('recurring')}>
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
