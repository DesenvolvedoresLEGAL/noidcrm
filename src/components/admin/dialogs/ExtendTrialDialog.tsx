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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExtendTrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: {
    id: string;
    name: string;
    trial_ends_at: string | null;
  };
}

const EXTENSION_OPTIONS = [
  { value: "7", label: "+7 dias" },
  { value: "14", label: "+14 dias" },
  { value: "30", label: "+30 dias" },
  { value: "custom", label: "Personalizado" },
];

export function ExtendTrialDialog({ open, onOpenChange, organization }: ExtendTrialDialogProps) {
  const [extensionType, setExtensionType] = useState("7");
  const [customDays, setCustomDays] = useState("7");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const getDaysToAdd = () => {
    if (extensionType === "custom") {
      return parseInt(customDays, 10) || 7;
    }
    return parseInt(extensionType, 10);
  };

  const getNewTrialEndDate = () => {
    const baseDate = organization.trial_ends_at 
      ? new Date(organization.trial_ends_at) 
      : new Date();
    return addDays(baseDate, getDaysToAdd());
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const newTrialEndsAt = getNewTrialEndDate();

      // Update organization
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          trial_ends_at: newTrialEndsAt.toISOString(),
          status: "trial",
        })
        .eq("id", organization.id);

      if (updateError) throw updateError;

      // Unblock if blocked
      await supabase
        .from("trial_blocks")
        .update({ 
          unblocked_at: new Date().toISOString(), 
          unblocked_by: userData.user?.id,
          unblock_reason: `Trial extended by ${getDaysToAdd()} days: ${reason}`
        })
        .eq("organization_id", organization.id)
        .is("unblocked_at", null);

      // Log the action
      await supabase.from("audit_log").insert({
        organization_id: organization.id,
        action: "trial_extended",
        entity_type: "organization",
        entity_id: organization.id,
        actor_user_id: userData.user?.id,
        old_value: { trial_ends_at: organization.trial_ends_at },
        new_value: { trial_ends_at: newTrialEndsAt.toISOString(), days_added: getDaysToAdd() },
        metadata: { reason },
      });
    },
    onSuccess: () => {
      toast.success(`Trial estendido por ${getDaysToAdd()} dias`);
      queryClient.invalidateQueries({ queryKey: ["admin-organization", organization.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-trial-orgs"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao estender trial: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Estender Trial
          </DialogTitle>
          <DialogDescription>
            Estender o período de trial de {organization.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Trial atual expira em</Label>
            <div className="text-sm text-muted-foreground">
              {organization.trial_ends_at 
                ? format(new Date(organization.trial_ends_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
                : "Não definido"}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Período de extensão</Label>
            <RadioGroup value={extensionType} onValueChange={setExtensionType}>
              {EXTENSION_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="font-normal">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {extensionType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-days">Dias</Label>
              <Input
                id="custom-days"
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm">Nova data de expiração</Label>
            <div className="text-lg font-semibold text-primary">
              {format(getNewTrialEndDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (obrigatório)</Label>
            <Textarea
              id="reason"
              placeholder="Motivo da extensão..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !reason.trim()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Estender Trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
