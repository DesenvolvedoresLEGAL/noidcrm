import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { manualPaymentSchema, type ManualPaymentInput } from '@/lib/proposals/proposalPayments';
import { useValidateManualPayment } from '@/hooks/proposals/useProposalPayments';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  paymentIntentId: string;
  expectedAmount?: number | null;
}

export function ManualPaymentValidationDialog({
  open,
  onOpenChange,
  proposalId,
  paymentIntentId,
  expectedAmount,
}: Props) {
  const validate = useValidateManualPayment(proposalId);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ManualPaymentInput>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: {
      paid_amount: expectedAmount ?? 0,
      paid_at: new Date().toISOString().slice(0, 16),
      payment_reference: '',
      notes: '',
    },
  });

  async function onSubmit(values: ManualPaymentInput) {
    setSubmitting(true);
    try {
      await validate.mutateAsync({
        paymentIntentId,
        paidAmount: Number(values.paid_amount),
        paidAt: new Date(values.paid_at).toISOString(),
        paymentReference: values.payment_reference ?? null,
      });
      onOpenChange(false);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Validar pagamento manual</DialogTitle>
          <DialogDescription>
            O sistema irá comparar com o valor vigente na data informada e calcular eventual
            diferença.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>Valor pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              {...form.register('paid_amount', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label>Data do pagamento</Label>
            <Input type="datetime-local" {...form.register('paid_at')} />
          </div>
          <div className="space-y-1">
            <Label>Referência (opcional)</Label>
            <Input {...form.register('payment_reference')} placeholder="ID Pix, comprovante…" />
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={2} {...form.register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              Validar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
