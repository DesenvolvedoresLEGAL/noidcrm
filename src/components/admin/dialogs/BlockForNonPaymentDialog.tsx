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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";

interface BlockForNonPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  currentAmountDue?: number;
}

export function BlockForNonPaymentDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  currentAmountDue = 0,
}: BlockForNonPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [amountDue, setAmountDue] = useState(currentAmountDue.toString());

  const blockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      // Check if billing status exists, create or update
      const { data: existingStatus } = await supabase
        .from("organization_billing_status")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingStatus) {
        const { error } = await supabase
          .from("organization_billing_status")
          .update({
            payment_status: "blocked",
            blocked_at: new Date().toISOString(),
            blocked_by: userData.user?.id,
            block_reason: reason || "Inadimplência",
            amount_due: parseFloat(amountDue) || 0,
            unblocked_at: null,
            unblocked_by: null,
            unblock_reason: null,
          })
          .eq("organization_id", organizationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_billing_status")
          .insert({
            organization_id: organizationId,
            payment_status: "blocked",
            blocked_at: new Date().toISOString(),
            blocked_by: userData.user?.id,
            block_reason: reason || "Inadimplência",
            amount_due: parseFloat(amountDue) || 0,
          });

        if (error) throw error;
      }

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_blocked_for_nonpayment",
        entity_type: "organization",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        metadata: {
          reason: reason || "Inadimplência",
          amount_due: parseFloat(amountDue) || 0,
        },
      });
    },
    onSuccess: () => {
      toast.success("Organização bloqueada por inadimplência");
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-status"] });
      onOpenChange(false);
      setReason("");
    },
    onError: (error: any) => {
      toast.error(`Erro ao bloquear: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Bloquear por Inadimplência
          </DialogTitle>
          <DialogDescription>
            Bloquear o acesso de todos os usuários de <strong>{organizationName}</strong> por falta de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Atenção!</p>
                <p className="text-muted-foreground mt-1">
                  Os usuários desta organização não conseguirão acessar o sistema até que o bloqueio seja removido.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountDue">Valor em Aberto (R$)</Label>
            <Input
              id="amountDue"
              type="number"
              step="0.01"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Bloqueio</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo do bloqueio..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => blockMutation.mutate()}
            disabled={blockMutation.isPending}
          >
            {blockMutation.isPending ? "Bloqueando..." : "Confirmar Bloqueio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
