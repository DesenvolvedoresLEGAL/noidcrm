import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from './RichTextEditor';
import { 
  AlertTriangle, 
  CreditCard, 
  Wallet, 
  Receipt, 
  Banknote,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Zap,
  Calendar
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { PaymentTerm, Installment, calculateInstallments, calculateMRRTotal } from '@/services/crm/proposal-payment-terms';
import { ProposalItem } from '@/services/crm/proposal-items';
import { formatDateBR } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX', icon: Wallet },
  { value: 'boleto', label: 'Boleto', icon: Receipt },
  { value: 'cartao', label: 'Cartão', icon: CreditCard },
  { value: 'transferencia', label: 'Transf.', icon: Banknote },
];

const CONTRACT_MONTHS_OPTIONS = [
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
  { value: 36, label: '36 meses' },
];

// Quick presets for one-time payments
const PAYMENT_PRESETS = [
  { 
    id: 'a_vista', 
    label: 'À Vista', 
    config: { entry_percent: 0, installments: 1, installment_interval_days: 30 } 
  },
  { 
    id: '50_50', 
    label: '50% + 50%', 
    config: { entry_percent: 50, installments: 1, installment_interval_days: 30 } 
  },
  { 
    id: '30_60_90', 
    label: '30/60/90', 
    config: { entry_percent: 0, installments: 3, installment_interval_days: 30 } 
  },
  { 
    id: 'parcelado', 
    label: 'Parcelado', 
    config: null // Opens custom config
  },
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
  const [selectedPreset, setSelectedPreset] = useState<string | null>('a_vista');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMrrComments, setShowMrrComments] = useState(false);
  
  const [oneTimeTerm, setOneTimeTerm] = useState<Partial<PaymentTerm> & { payment_method?: string }>({
    payment_type: 'one_time',
    payment_method: 'boleto',
    entry_percent: 0,
    discount_percent: 0,
    installments: 1,
    installment_interval_days: 30,
    due_day: 10,
  });
  
  const [recurringTerm, setRecurringTerm] = useState<Partial<PaymentTerm> & { 
    payment_method?: string; 
    recurring_due_day?: number;
    contract_months?: number;
  }>({
    payment_type: 'recurring',
    payment_method: 'boleto',
    monthly_value: 0,
    contract_total: 0,
    recurring_due_day: 10,
    contract_months: 12,
  });

  // Calculate total from items if totalAmount is 0
  const calculatedTotal = items.reduce((sum, item) => sum + item.total, 0);
  const effectiveTotal = totalAmount > 0 ? totalAmount : calculatedTotal;

  // Calculate discount
  const discountPercent = oneTimeTerm.discount_percent || 0;
  const discountValue = effectiveTotal * (discountPercent / 100);
  const totalWithDiscount = effectiveTotal - discountValue;

  // Auto-calculate MRR total based on contract months
  const calculatedMrrTotal = (recurringTerm.monthly_value || 0) * (recurringTerm.contract_months || 12);

  // Load existing terms
  useEffect(() => {
    const oneTime = terms.find(t => t.payment_type === 'one_time');
    const recurring = terms.find(t => t.payment_type === 'recurring');
    
    if (oneTime) {
      setOneTimeTerm({ ...oneTime, payment_method: (oneTime as any).payment_method || 'boleto' });
      // Detect preset
      if (oneTime.entry_percent === 0 && oneTime.installments === 1) {
        setSelectedPreset('a_vista');
      } else if (oneTime.entry_percent === 50 && oneTime.installments === 1) {
        setSelectedPreset('50_50');
      } else if (oneTime.entry_percent === 0 && oneTime.installments === 3) {
        setSelectedPreset('30_60_90');
      } else {
        setSelectedPreset('parcelado');
        setShowAdvanced(true);
      }
      if (oneTime.comments) setShowComments(true);
    }
    
    if (recurring) {
      setRecurringTerm({ 
        ...recurring, 
        payment_method: (recurring as any).payment_method || 'boleto', 
        recurring_due_day: (recurring as any).recurring_due_day || 10,
        contract_months: (recurring as any).contract_months || 12,
      });
      if (recurring.comments) setShowMrrComments(true);
    }
  }, [terms]);

  // Auto-save on change
  const autoSave = useCallback((type: 'one_time' | 'recurring', termData: any) => {
    const newTerms = terms.filter(t => t.payment_type !== type);
    newTerms.push({ ...termData, proposal_id: proposalId, payment_type: type } as PaymentTerm);
    onChange(newTerms);
  }, [terms, proposalId, onChange]);

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PAYMENT_PRESETS.find(p => p.id === presetId);
    
    if (preset?.config) {
      const newTerm = { 
        ...oneTimeTerm, 
        ...preset.config,
        first_installment_date: oneTimeTerm.first_installment_date || getTodayDate(),
        entry_date: preset.config.entry_percent > 0 ? getTodayDate() : undefined,
      };
      setOneTimeTerm(newTerm);
      setShowAdvanced(false);
      autoSave('one_time', newTerm);
    } else {
      // Parcelado - show advanced options
      setShowAdvanced(true);
    }
  };

  // Handle one-time field changes with auto-save
  const updateOneTime = (updates: Partial<typeof oneTimeTerm>) => {
    const newTerm = { ...oneTimeTerm, ...updates };
    setOneTimeTerm(newTerm);
    autoSave('one_time', newTerm);
  };

  // Handle recurring field changes with auto-save
  const updateRecurring = (updates: Partial<typeof recurringTerm>) => {
    const newTerm = { 
      ...recurringTerm, 
      ...updates,
      // Auto-calculate contract total when months or value changes
      contract_total: (updates.monthly_value ?? recurringTerm.monthly_value ?? 0) * 
                      (updates.contract_months ?? recurringTerm.contract_months ?? 12),
    };
    setRecurringTerm(newTerm);
    autoSave('recurring', newTerm);
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const installments = calculateInstallments(oneTimeTerm as PaymentTerm, effectiveTotal);
  const mrrTotal = calculateMRRTotal(recurringTerm as PaymentTerm, recurringTerm.contract_months || 12);

  const formatCurrency = (value: number) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';
    return `${symbol} ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Condições de Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert when no value */}
        {effectiveTotal === 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              Adicione itens à proposta para calcular as parcelas.
            </AlertDescription>
          </Alert>
        )}

        {/* Compact Summary */}
        {effectiveTotal > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(effectiveTotal)}</span>
            {discountPercent > 0 && (
              <>
                <span className="text-red-600">-{discountPercent}%</span>
                <span className="font-bold text-primary">{formatCurrency(totalWithDiscount)}</span>
              </>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="one_time" className="text-sm">Avulso</TabsTrigger>
            <TabsTrigger value="recurring" className="text-sm">Recorrente</TabsTrigger>
          </TabsList>

          {/* ===== AVULSO TAB ===== */}
          <TabsContent value="one_time" className="space-y-4 pt-3">
            {/* Payment Method Chips */}
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = oneTimeTerm.payment_method === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => updateOneTime({ payment_method: method.value as PaymentTerm['payment_method'] })}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                      isSelected 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {method.label}
                  </button>
                );
              })}
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Condição
              </Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                      selectedPreset === preset.id
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Config - Always visible */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedPreset === '50_50' && (
                <div className="space-y-1">
                  <Label className="text-xs">Entrada</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={oneTimeTerm.entry_percent || 0}
                      onChange={(e) => updateOneTime({ entry_percent: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              )}
              
              {(selectedPreset === 'parcelado' || selectedPreset === '30_60_90') && (
                <div className="space-y-1">
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={oneTimeTerm.installments || 1}
                    onChange={(e) => updateOneTime({ installments: parseInt(e.target.value) || 1 })}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Início
                </Label>
                <Input
                  type="date"
                  value={oneTimeTerm.first_installment_date || ''}
                  onChange={(e) => updateOneTime({ first_installment_date: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Desconto</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={oneTimeTerm.discount_percent || 0}
                    onChange={(e) => updateOneTime({ discount_percent: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Advanced Options - Collapsible */}
            {(selectedPreset === 'parcelado' || showAdvanced) && (
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs">
                    Configurações avançadas
                    {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">Entrada %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={oneTimeTerm.entry_percent || 0}
                        onChange={(e) => updateOneTime({ entry_percent: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Intervalo (dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={oneTimeTerm.installment_interval_days || 30}
                        onChange={(e) => updateOneTime({ installment_interval_days: parseInt(e.target.value) || 30 })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={oneTimeTerm.due_day || 10}
                        onChange={(e) => updateOneTime({ due_day: parseInt(e.target.value) || 10 })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Installments Schedule - Collapsible */}
            {installments.length > 0 && effectiveTotal > 0 && (
              <Collapsible open={showSchedule} onOpenChange={setShowSchedule}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs">
                    <span className="flex items-center gap-2">
                      📋 Cronograma de Pagamento
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                        {installments.length} {installments.length === 1 ? 'parcela' : 'parcelas'}
                      </span>
                    </span>
                    {showSchedule ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs h-8">Tipo</TableHead>
                          <TableHead className="text-xs h-8">Vencimento</TableHead>
                          <TableHead className="text-xs h-8 text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {installments.map((inst, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs py-1.5">
                              <span className={inst.type === 'entry' ? 'text-green-600 font-medium' : ''}>
                                {inst.type === 'entry' ? 'Entrada' : `${inst.number}/${oneTimeTerm.installments}`}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs py-1.5">
                              {formatDateBR(inst.dueDate)}
                            </TableCell>
                            <TableCell className="text-xs py-1.5 text-right font-medium">
                              {formatCurrency(inst.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Comments Toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                {showComments ? 'Ocultar observações' : 'Adicionar observações'}
              </button>
              {showComments && (
                <RichTextEditor
                  value={oneTimeTerm.comments || ''}
                  onChange={(value) => updateOneTime({ comments: value })}
                  placeholder="Ex: Dados bancários, chave PIX..."
                  minHeight="80px"
                />
              )}
            </div>
          </TabsContent>

          {/* ===== RECORRENTE TAB ===== */}
          <TabsContent value="recurring" className="space-y-4 pt-3">
            {/* Payment Method Chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'boleto', label: 'Boleto', icon: Receipt },
                { value: 'cartao', label: 'Cartão', icon: CreditCard },
                { value: 'debito_auto', label: 'Débito Auto', icon: Banknote },
              ].map((method) => {
                const Icon = method.icon;
                const isSelected = recurringTerm.payment_method === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => updateRecurring({ payment_method: method.value as PaymentTerm['payment_method'] })}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                      isSelected 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {method.label}
                  </button>
                );
              })}
            </div>

            {/* Main Config */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor Mensal</Label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={recurringTerm.monthly_value || ''}
                    onChange={(e) => updateRecurring({ monthly_value: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm pl-7"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prazo</Label>
                <Select
                  value={String(recurringTerm.contract_months || 12)}
                  onValueChange={(v) => updateRecurring({ contract_months: parseInt(v) })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_MONTHS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Início
                </Label>
                <Input
                  type="date"
                  value={recurringTerm.first_payment_date || ''}
                  onChange={(e) => updateRecurring({ first_payment_date: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Dia Venc.</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringTerm.recurring_due_day || 10}
                  onChange={(e) => updateRecurring({ recurring_due_day: parseInt(e.target.value) || 10 })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* MRR/ARR Summary */}
            {(recurringTerm.monthly_value || 0) > 0 && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-primary/5 rounded-lg">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">MRR</p>
                  <p className="text-sm font-bold text-primary">
                    {formatCurrency(recurringTerm.monthly_value || 0)}
                  </p>
                </div>
                <div className="text-center border-x border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Total ({recurringTerm.contract_months || 12}m)
                  </p>
                  <p className="text-sm font-bold">
                    {formatCurrency(calculatedMrrTotal)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">ARR</p>
                  <p className="text-sm font-bold">
                    {formatCurrency((recurringTerm.monthly_value || 0) * 12)}
                  </p>
                </div>
              </div>
            )}

            {/* Comments Toggle */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMrrComments(!showMrrComments)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                {showMrrComments ? 'Ocultar observações' : 'Adicionar observações'}
              </button>
              {showMrrComments && (
                <RichTextEditor
                  value={recurringTerm.comments || ''}
                  onChange={(value) => updateRecurring({ comments: value })}
                  placeholder="Ex: Condições de reajuste, vigência..."
                  minHeight="80px"
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
