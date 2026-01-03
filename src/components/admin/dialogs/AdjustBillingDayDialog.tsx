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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

interface AdjustBillingDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  currentBillingDay?: number;
}

export function AdjustBillingDayDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  currentBillingDay = 10,
}: AdjustBillingDayDialogProps) {
  const queryClient = useQueryClient();
  const [billingDay, setBillingDay] = useState(currentBillingDay.toString());

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const newBillingDay = parseInt(billingDay);

      // Calculate next due date
      const today = new Date();
      let nextDueDate = new Date(today.getFullYear(), today.getMonth(), newBillingDay);
      if (nextDueDate <= today) {
        nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, newBillingDay);
      }

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
            billing_day: newBillingDay,
            next_due_date: nextDueDate.toISOString().split("T")[0],
          })
          .eq("organization_id", organizationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_billing_status")
          .insert({
            organization_id: organizationId,
            billing_day: newBillingDay,
            next_due_date: nextDueDate.toISOString().split("T")[0],
          });

        if (error) throw error;
      }

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_day_adjusted",
        entity_type: "organization",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        old_value: { billing_day: currentBillingDay },
        new_value: { billing_day: newBillingDay },
      });
    },
    onSuccess: () => {
      toast.success(`Data de vencimento alterada para dia ${billingDay}`);
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing-status"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Ajustar Data de Vencimento
          </DialogTitle>
          <DialogDescription>
            Alterar o dia de vencimento mensal de <strong>{organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="billingDay">Dia do Vencimento</Label>
            <Select value={billingDay} onValueChange={setBillingDay}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia..." />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    Dia {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Datas entre 1 e 28 para evitar problemas com meses curtos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
