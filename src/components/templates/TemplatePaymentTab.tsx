import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { CreditCard, RefreshCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PaymentData {
  payment_method_default?: string;
  installments_default?: number;
  entry_percent_default?: number;
  discount_percent_default?: number;
  entry_days_default?: number;
  installment_interval_days?: number;
  due_day_default?: number;
  payment_comment?: string;
  mrr_payment_method?: string;
  mrr_first_payment_days?: number;
  mrr_due_day?: number;
  mrr_comment?: string;
}

interface TemplatePaymentTabProps {
  data: PaymentData;
  onChange: (field: string, value: any) => void;
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto Bancário' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

export function TemplatePaymentTab({ data, onChange }: TemplatePaymentTabProps) {
  return (
    <div className="space-y-6">
      {/* Avulso - One-time Payment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Pagamento Único (Avulso)</CardTitle>
              <CardDescription>Configurações para vendas de produtos e serviços pontuais</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={data.payment_method_default || ''}
                onValueChange={(value) => onChange('payment_method_default', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entrada (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={data.entry_percent_default || 0}
                onChange={(e) => onChange('entry_percent_default', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data da Entrada (dias)</Label>
              <Input
                type="number"
                min={0}
                value={data.entry_days_default || 0}
                onChange={(e) => onChange('entry_days_default', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número de Parcelas</Label>
              <Input
                type="number"
                min={1}
                max={48}
                value={data.installments_default || 1}
                onChange={(e) => onChange('installments_default', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Intervalo entre Parcelas (dias)</Label>
              <Input
                type="number"
                min={1}
                value={data.installment_interval_days || 30}
                onChange={(e) => onChange('installment_interval_days', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={data.discount_percent_default || 0}
                onChange={(e) => onChange('discount_percent_default', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dia de Vencimento</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={data.due_day_default || ''}
                onChange={(e) => onChange('due_day_default', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Comentário sobre Forma de Pagamento</Label>
            <RichTextEditor
              value={data.payment_comment || ''}
              onChange={(value) => onChange('payment_comment', value)}
              placeholder="Ex: Pagamento via PIX com 5% de desconto..."
              minHeight="100px"
            />
          </div>
        </CardContent>
      </Card>

      {/* MRR - Recurring Payment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Pagamento Recorrente (MRR)</CardTitle>
              <CardDescription>Configurações para assinaturas e mensalidades</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={data.mrr_payment_method || ''}
                onValueChange={(value) => onChange('mrr_payment_method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>1ª Parcela (dias após aprovação)</Label>
              <Input
                type="number"
                min={0}
                value={data.mrr_first_payment_days || 30}
                onChange={(e) => onChange('mrr_first_payment_days', Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Dia de Vencimento Mensal</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={data.mrr_due_day || ''}
                onChange={(e) => onChange('mrr_due_day', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 5"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Comentário sobre Recorrência</Label>
            <RichTextEditor
              value={data.mrr_comment || ''}
              onChange={(value) => onChange('mrr_comment', value)}
              placeholder="Ex: Mensalidade cobrada automaticamente via cartão de crédito..."
              minHeight="100px"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
