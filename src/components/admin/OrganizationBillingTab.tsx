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
  RefreshCw,
  Ban,
  Calendar,
  Receipt,
  History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/dateUtils";
import { ActivateGatewayBillingDialog } from "./dialogs/ActivateGatewayBillingDialog";
import { RelinkProposalDialog } from "./dialogs/RelinkProposalDialog";
import { BlockForNonPaymentDialog } from "./dialogs/BlockForNonPaymentDialog";
import { UnblockBillingDialog } from "./dialogs/UnblockBillingDialog";
import { RegisterPaymentDialog } from "./dialogs/RegisterPaymentDialog";
import { AdjustBillingDayDialog } from "./dialogs/AdjustBillingDayDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

// Format currency already in reais (not cents)
const formatCurrencyReais = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Format currency in cents
const formatCurrencyCents = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(cents / 100);
};

export function OrganizationBillingTab({ organizationId, organization }: OrganizationBillingTabProps) {
  const queryClient = useQueryClient();
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showRelinkDialog, setShowRelinkDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showBillingDayDialog, setShowBillingDayDialog] = useState(false);

  // Fetch billing status
  const { data: billingStatus } = useQuery({
    queryKey: ["admin-billing-status", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_billing_status")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch payment history
  const { data: paymentHistory } = useQuery({
    queryKey: ["admin-billing-payments", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select("*")
        .eq("organization_id", organizationId)
        .order("payment_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

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

  // Fetch member count for MRR calculation
  const { data: memberCount } = useQuery({
    queryKey: ["admin-org-members-count", organizationId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (error) throw error;
      return count || 0;
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
      
      // MRR from slg_conversions is already in REAIS
      let newMRR = 0;
      if (slgConversion?.mrr_value) {
        newMRR = slgConversion.mrr_value; // Already in reais
      } else if (subscription?.amount) {
        newMRR = subscription.amount / 100; // Convert from cents to reais
      }

      const { error } = await supabase
        .from("organizations")
        .update({ calculated_mrr: newMRR })
        .eq("id", organizationId);
      
      if (error) throw error;

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
      toast.success(`MRR recalculado: ${formatCurrencyReais(newMRR)}`);
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

  // Check if blocked by billing
  const isBlockedByBilling = billingStatus?.payment_status === "blocked";

  // Calculate displayed MRR - mrr_value from slg_conversions is already in REAIS
  const displayedMRR = slgConversion?.mrr_value 
    ? formatCurrencyReais(slgConversion.mrr_value)
    : subscription?.amount
      ? formatCurrencyCents(subscription.amount)
      : "R$ 0,00";

  // Plan prices per user (in reais)
  const planPrices: Record<string, number> = {
    neural: 199.90,
    autonomous: 299.90,
  };
  
  const planPrice = organization.current_plan_id ? planPrices[organization.current_plan_id] || 0 : 0;
  const calculatedMonthlyValue = planPrice * (memberCount || 0);

  // Get payment status badge
  const getPaymentStatusBadge = () => {
    const status = billingStatus?.payment_status || "current";
    switch (status) {
      case "current":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Em dia</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Inadimplente</Badge>;
      case "blocked":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Bloqueado</Badge>;
      default:
        return <Badge variant="outline">Não definido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Billing Block Alert */}
      {isBlockedByBilling && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Acesso Bloqueado por Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-1">
              <p><strong>Motivo:</strong> {billingStatus?.block_reason || "Inadimplência"}</p>
              {billingStatus?.amount_due && billingStatus.amount_due > 0 && (
                <p><strong>Valor em aberto:</strong> {formatCurrencyReais(billingStatus.amount_due)}</p>
              )}
              {billingStatus?.blocked_at && (
                <p><strong>Bloqueado em:</strong> {format(new Date(billingStatus.blocked_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowUnblockDialog(true)}
            >
              <Unlock className="h-4 w-4 mr-2" />
              Desbloquear Acesso
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* Payment Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Status de Cobrança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              {getPaymentStatusBadge()}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="text-sm font-medium">
                {billingStatus?.next_due_date 
                  ? formatDateBR(billingStatus.next_due_date)
                  : `Dia ${billingStatus?.billing_day || paymentTerms?.billing_day || paymentTerms?.recurring_due_day || 10}`
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Último Pagamento</p>
              <p className="text-sm font-medium">
                {billingStatus?.last_payment_date 
                  ? formatDateBR(billingStatus.last_payment_date)
                  : "—"
                }
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Valor em Aberto</p>
              <p className="text-sm font-medium">
                {billingStatus?.amount_due && billingStatus.amount_due > 0
                  ? formatCurrencyReais(billingStatus.amount_due)
                  : "R$ 0,00"
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Informações do Contrato
          </CardTitle>
          <CardDescription>
            Detalhes da assinatura e valores
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
            <Badge variant="outline" className="capitalize">{organization.current_plan_id || "free"}</Badge>
          </div>

          {/* Users */}
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Usuários Ativos</span>
            <span className="text-sm font-medium">{memberCount || 0}</span>
          </div>

          {/* Price per user */}
          {planPrice > 0 && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Valor por Usuário</span>
              <span className="text-sm font-medium">{formatCurrencyReais(planPrice)}/mês</span>
            </div>
          )}

          {/* Calculated Monthly Value */}
          {planPrice > 0 && (
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Valor Mensal Calculado</span>
              <span className="text-sm font-medium text-muted-foreground">
                {memberCount || 0} × {formatCurrencyReais(planPrice)} = {formatCurrencyReais(calculatedMonthlyValue)}
              </span>
            </div>
          )}

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

          {/* MRR */}
          <div className="flex justify-between items-center py-2">
            <span className="text-muted-foreground">MRR</span>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600">
                {displayedMRR}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentHistory && paymentHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDateBR(payment.payment_date)}</TableCell>
                    <TableCell className="font-medium">{formatCurrencyReais(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.payment_method || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.reference || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum pagamento registrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Administrative Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações Administrativas</CardTitle>
          <CardDescription>
            Ferramentas para gerenciamento de cobrança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Block for Non-Payment */}
            {!isBlockedByBilling && (
              <Button
                variant="outline"
                className="justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setShowBlockDialog(true)}
              >
                <Ban className="h-4 w-4" />
                Bloquear por Inadimplência
              </Button>
            )}

            {/* Unblock */}
            {isBlockedByBilling && (
              <Button
                className="justify-start gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setShowUnblockDialog(true)}
              >
                <Unlock className="h-4 w-4" />
                Desbloquear Acesso
              </Button>
            )}

            {/* Register Payment */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowPaymentDialog(true)}
            >
              <DollarSign className="h-4 w-4" />
              Registrar Pagamento
            </Button>

            {/* Adjust Billing Day */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setShowBillingDayDialog(true)}
            >
              <Calendar className="h-4 w-4" />
              Ajustar Vencimento
            </Button>

            {/* Recalculate MRR */}
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => recalculateMRRMutation.mutate()}
              disabled={recalculateMRRMutation.isPending}
            >
              {recalculateMRRMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Recalcular MRR
            </Button>

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

      <BlockForNonPaymentDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        organizationId={organizationId}
        organizationName={organization.name}
        currentAmountDue={billingStatus?.amount_due || 0}
      />

      <UnblockBillingDialog
        open={showUnblockDialog}
        onOpenChange={setShowUnblockDialog}
        organizationId={organizationId}
        organizationName={organization.name}
      />

      <RegisterPaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        organizationId={organizationId}
        organizationName={organization.name}
      />

      <AdjustBillingDayDialog
        open={showBillingDayDialog}
        onOpenChange={setShowBillingDayDialog}
        organizationId={organizationId}
        organizationName={organization.name}
        currentBillingDay={billingStatus?.billing_day || paymentTerms?.billing_day || paymentTerms?.recurring_due_day || 10}
      />
    </div>
  );
}
