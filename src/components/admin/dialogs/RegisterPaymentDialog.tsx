import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: RegisterPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      // Insert payment record
      const { error: paymentError } = await supabase
        .from("billing_payments")
        .insert({
          organization_id: organizationId,
          amount: parseFloat(amount),
          payment_date: paymentDate,
          payment_method: paymentMethod || null,
          reference: reference || null,
          notes: notes || null,
          recorded_by: userData.user?.id,
        });

      if (paymentError) throw paymentError;

      // Update billing status
      const { data: existingStatus } = await supabase
        .from("organization_billing_status")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingStatus) {
        const { error } = await supabase
          .from("organization_billing_status")
          .update({
            last_payment_date: new Date(paymentDate).toISOString(),
            last_payment_amount: parseFloat(amount),
            payment_status: "current",
            amount_due: 0,
            overdue_since: null,
            days_overdue: 0,
          })
          .eq("organization_id", organizationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_billing_status")
          .insert({
            organization_id: organizationId,
            last_payment_date: new Date(paymentDate).toISOString(),
            last_payment_amount: parseFloat(amount),
            payment_status: "current",
          });

        if (error) throw error;
      }

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_payment_registered",
        entity_type: "billing_payment",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        metadata: {
          amount: parseFloat(amount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference: reference,
        },
      });
    },
    onSuccess: () => {
      toast.success("Pagamento registrado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-payments"] });
      onOpenChange(false);
      setAmount("");
      setPaymentMethod("");
      setReference("");
      setNotes("");
    },
    onError: (error: any) => {
      toast.error(`Erro ao registrar pagamento: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Registrar Pagamento
          </DialogTitle>
          <DialogDescription>
            Registrar pagamento recebido de <strong>{organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto Bancário</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Referência / Comprovante</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ID da transação, nº do comprovante..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => registerMutation.mutate()}
            disabled={!amount || !paymentDate || registerMutation.isPending}
          >
            {registerMutation.isPending ? "Registrando..." : "Registrar Pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
