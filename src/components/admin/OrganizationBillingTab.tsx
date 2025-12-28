import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  FileText, 
  Unlock, 
  Calculator, 
  Link2, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ActivateGatewayBillingDialog } from "./dialogs/ActivateGatewayBillingDialog";
import { RelinkProposalDialog } from "./dialogs/RelinkProposalDialog";

interface OrganizationBillingTabProps {
  organizationId: string;
  organization: {
    id: string;
    name: string;
    current_plan_id: string | null;
    is_plan_locked: boolean | null;
    status: string | null;
    calculated_mrr?: number | null;
  };
}

export function OrganizationBillingTab({ organizationId, organization }: OrganizationBillingTabProps) {
  const queryClient = useQueryClient();
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showRelinkDialog, setShowRelinkDialog] = useState(false);

  // Fetch billing subscription
  const { data: subscription } = useQuery({
    queryKey: ["admin-org-subscription", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch SLG conversion
  const { data: slgConversion } = useQuery({
    queryKey: ["admin-org-slg", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slg_conversions")
        .select("*, proposals(proposal_number, total_amount, status)")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch payment terms if proposal exists
  const { data: paymentTerms } = useQuery({
    queryKey: ["admin-org-payment-terms", slgConversion?.proposal_id],
    queryFn: async () => {
      if (!slgConversion?.proposal_id) return null;
      const { data, error } = await supabase
        .from("proposal_payment_terms")
        .select("*")
        .eq("proposal_id", slgConversion.proposal_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slgConversion?.proposal_id,
  });

  // Remove plan lock mutation
  const removePlanLockMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("organizations")
        .update({ is_plan_locked: false })
        .eq("id", organizationId);
      
      if (error) throw error;

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_plan_unlocked",
        entity_type: "organization",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        old_value: { is_plan_locked: true },
        new_value: { is_plan_locked: false },
      });
    },
    onSuccess: () => {
      toast.success("Plano desbloqueado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Recalculate MRR mutation
  const recalculateMRRMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get MRR from slg_conversions or subscription
      let newMRR = 0;
      if (subscription?.amount) {
        newMRR = subscription.amount;
      } else if (slgConversion?.mrr_value) {
        newMRR = slgConversion.mrr_value;
      }

      const { error } = await supabase
        .from("organizations")
        .update({ calculated_mrr: newMRR })
        .eq("id", organizationId);
      
      if (error) throw error;

      // Log action
      await supabase.from("audit_log").insert({
        organization_id: organizationId,
        action: "billing_mrr_recalculated",
        entity_type: "organization",
        entity_id: organizationId,
        actor_user_id: userData.user?.id,
        old_value: { calculated_mrr: organization.calculated_mrr },
        new_value: { calculated_mrr: newMRR },
      });

      return newMRR;
    },
    onSuccess: (newMRR) => {
      toast.success(`MRR recalculado: R$ ${(newMRR / 100).toFixed(2)}`);
      queryClient.invalidateQueries({ queryKey: ["admin-organization"] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Determine billing source
  const hasActiveSubscription = !!subscription;
  const isBilledViaProposal = !!slgConversion && !hasActiveSubscription;
  const billingSource = hasActiveSubscription 
    ? "gateway" 
    : isBilledViaProposal 
      ? "proposal" 
      : "none";

  // Check for inconsistencies
  const inconsistencies: string[] = [];
  if (organization.is_plan_locked && !isBilledViaProposal && organization.current_plan_id !== 'internal_full') {
    inconsistencies.push("is_plan_locked ativo sem proposta vinculada");
  }
  if (isBilledViaProposal && !slgConversion?.mrr_value) {
    inconsistencies.push("Proposta vinculada sem valor de MRR");
  }
  if (!hasActiveSubscription && !isBilledViaProposal && organization.current_plan_id && organization.current_plan_id !== 'free') {
    inconsistencies.push("Plano pago sem fonte de cobrança definida");
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* Inconsistencies Alert */}
      {inconsistencies.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Inconsistências Detectadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-amber-600">
              {inconsistencies.map((issue, idx) => (
                <li key={idx}>• {issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Billing Diagnosis Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Diagnóstico de Cobrança
          </CardTitle>
          <CardDescription>
            Status detalhado da configuração de faturamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Billing Source */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Fonte de Cobrança</span>
            <Badge 
              variant={billingSource === "gateway" ? "default" : billingSource === "proposal" ? "secondary" : "outline"}
              className={
                billingSource === "gateway" 
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                  : billingSource === "proposal"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : ""
              }
            >
              {billingSource === "gateway" && "Assinatura (Gateway)"}
              {billingSource === "proposal" && "Proposta/Contrato"}
              {billingSource === "none" && "Sem Cobrança"}
            </Badge>
          </div>

          {/* Plan */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Plano Atual</span>
            <Badge variant="outline">{organization.current_plan_id || "free"}</Badge>
          </div>

          {/* Plan Locked */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">is_plan_locked</span>
            <Badge 
              variant={organization.is_plan_locked ? "default" : "outline"}
              className={organization.is_plan_locked ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : ""}
            >
              {organization.is_plan_locked ? "✓ Ativo" : "✗ Inativo"}
            </Badge>
          </div>

          {/* Subscription Status */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Assinatura Gateway</span>
            {hasActiveSubscription ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  {formatCurrency(subscription?.amount || 0)}/mês
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Não configurada</span>
            )}
          </div>

          {/* SLG Conversion */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Conversão SLG</span>
            {slgConversion ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                  Proposta #{slgConversion.proposals?.proposal_number || slgConversion.proposal_id?.slice(0, 8)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Não vinculada</span>
            )}
          </div>

          {/* Payment Terms */}
          {paymentTerms && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Dia de Vencimento</span>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Dia {paymentTerms.billing_day || paymentTerms.recurring_due_day || "—"}</span>
              </div>
            </div>
          )}

          {/* MRR */}
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">MRR</span>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">
                {slgConversion?.mrr_value 
                  ? formatCurrency(slgConversion.mrr_value)
                  : subscription?.amount
                    ? formatCurrency(subscription.amount)
                    : "R$ 0,00"
                }
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações de Correção</CardTitle>
          <CardDescription>
            Ferramentas para corrigir inconsistências de cobrança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Remove Plan Lock */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => removePlanLockMutation.mutate()}
              disabled={!organization.is_plan_locked || removePlanLockMutation.isPending}
            >
              <Unlock className="h-4 w-4" />
              Remover is_plan_locked
            </Button>

            {/* Recalculate MRR */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => recalculateMRRMutation.mutate()}
              disabled={recalculateMRRMutation.isPending}
            >
              <Calculator className="h-4 w-4" />
              {recalculateMRRMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Recalcular MRR"
              )}
            </Button>

            {/* Relink Proposal */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowRelinkDialog(true)}
            >
              <Link2 className="h-4 w-4" />
              Relinkar Proposta
            </Button>

            {/* Activate Gateway Billing */}
            <Button
              variant="default"
              className="justify-start gap-2"
              onClick={() => setShowActivateDialog(true)}
              disabled={hasActiveSubscription}
            >
              <CreditCard className="h-4 w-4" />
              Ativar Cobrança Automática
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ActivateGatewayBillingDialog
        open={showActivateDialog}
        onOpenChange={setShowActivateDialog}
        organization={organization}
        currentMRR={slgConversion?.mrr_value}
      />

      <RelinkProposalDialog
        open={showRelinkDialog}
        onOpenChange={setShowRelinkDialog}
        organizationId={organizationId}
        currentProposalId={slgConversion?.proposal_id}
      />
    </div>
  );
}
