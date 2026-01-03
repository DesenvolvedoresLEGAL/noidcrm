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
import { CheckCircle2, Unlock } from "lucide-react";
import { toast } from "sonner";

interface UnblockBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function UnblockBillingDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: UnblockBillingDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const unblockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("organization_billing_status")
        .update({
          payment_status: "current",
          blocked_at: null,
          blocked_by: null,
          block_reason: null,
          unblocked_at: new Date().toISOString(),
          unblocked_by: userData.user?.id,
          unblock_reason: reason || "Pagamento regularizado",
          amount_due: 0,
          overdue_since: null,
          days_overdue: 0,
        })
        .eq("organization_id", organizationId);

      if (error) throw error;

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_unblocked",
        entity_type: "organization",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        metadata: {
          reason: reason || "Pagamento regularizado",
        },
      });
    },
    onSuccess: () => {
      toast.success("Acesso desbloqueado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-status"] });
      onOpenChange(false);
      setReason("");
    },
    onError: (error: any) => {
      toast.error(`Erro ao desbloquear: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-600">
            <Unlock className="h-5 w-5" />
            Desbloquear Acesso
          </DialogTitle>
          <DialogDescription>
            Restaurar o acesso de <strong>{organizationName}</strong> após regularização do pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-600">Acesso será restaurado</p>
                <p className="text-muted-foreground mt-1">
                  Todos os usuários desta organização terão acesso imediato ao sistema.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Desbloqueio</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Pagamento confirmado via PIX..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => unblockMutation.mutate()}
            disabled={unblockMutation.isPending}
          >
            {unblockMutation.isPending ? "Desbloqueando..." : "Confirmar Desbloqueio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
