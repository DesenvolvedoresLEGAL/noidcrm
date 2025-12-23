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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: {
    id: string;
    name: string;
    current_plan_id: string | null;
  };
}

const PLANS = [
  { id: "free", name: "Free", description: "Plano gratuito básico" },
  { id: "neural", name: "Neural", description: "Plano para equipes em crescimento" },
  { id: "autonomous", name: "Autonomous", description: "Plano completo com IA avançada" },
  { id: "enterprise", name: "Enterprise", description: "Plano personalizado para grandes empresas" },
];

export function ChangePlanDialog({ open, onOpenChange, organization }: ChangePlanDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState(organization.current_plan_id || "free");
  const [resetTrial, setResetTrial] = useState(false);
  const [justification, setJustification] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Update organization plan
      const updateData: Record<string, any> = {
        current_plan_id: selectedPlan,
      };

      if (resetTrial) {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);
        updateData.trial_ends_at = trialEndsAt.toISOString();
        updateData.status = "trial";
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update(updateData)
        .eq("id", organization.id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("audit_log").insert({
        organization_id: organization.id,
        action: "plan_changed",
        entity_type: "organization",
        entity_id: organization.id,
        actor_user_id: userData.user?.id,
        old_value: { plan: organization.current_plan_id },
        new_value: { plan: selectedPlan, reset_trial: resetTrial },
        metadata: { justification },
      });

      // If trial was reset, also unblock if blocked
      if (resetTrial) {
        await supabase
          .from("trial_blocks")
          .update({ unblocked_at: new Date().toISOString(), unblocked_by: userData.user?.id })
          .eq("organization_id", organization.id)
          .is("unblocked_at", null);
      }
    },
    onSuccess: () => {
      toast.success("Plano alterado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-organization", organization.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao alterar plano: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Alterar Plano
          </DialogTitle>
          <DialogDescription>
            Alterar o plano de {organization.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Plano Atual</Label>
            <div className="text-sm text-muted-foreground">
              {PLANS.find(p => p.id === organization.current_plan_id)?.name || "Free"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Novo Plano</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <div>
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-xs text-muted-foreground">{plan.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reset-trial"
              checked={resetTrial}
              onCheckedChange={(checked) => setResetTrial(checked as boolean)}
            />
            <Label htmlFor="reset-trial" className="text-sm font-normal">
              Resetar trial para 14 dias
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justificativa (obrigatório)</Label>
            <Textarea
              id="justification"
              placeholder="Motivo da alteração..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !justification.trim() || selectedPlan === organization.current_plan_id}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
