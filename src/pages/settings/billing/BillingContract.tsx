import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Calendar,
  CreditCard,
  Clock,
  RefreshCw,
  Building2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BillingContract() {
  const { organization } = useCurrentUser();

  // Fetch SLG conversion and proposal
  const { data: contractData, isLoading } = useQuery({
    queryKey: ["billing-contract", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      // Get SLG conversion
      const { data: slgConversion, error: slgError } = await supabase
        .from("slg_conversions")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (slgError) throw slgError;
      if (!slgConversion) return null;

      // Get proposal details
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", slgConversion.proposal_id)
        .single();

      if (proposalError) throw proposalError;

      // Get payment terms
      const { data: paymentTerms, error: termsError } = await supabase
        .from("proposal_payment_terms")
        .select("*")
        .eq("proposal_id", slgConversion.proposal_id)
        .maybeSingle();

      if (termsError) throw termsError;

      // Get history from audit_log
      const { data: history, error: historyError } = await supabase
        .from("audit_log")
        .select("*")
        .eq("organization_id", organization.id)
        .or("action.ilike.%proposal%,action.ilike.%contract%,action.ilike.%slg%,action.ilike.%billing%")
        .order("created_at", { ascending: false })
        .limit(10);

      if (historyError) throw historyError;

      return {
        slgConversion,
        proposal,
        paymentTerms,
        history,
      };
    },
    enabled: !!organization?.id,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contractData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Contrato Vinculado</h2>
          <p className="text-muted-foreground">Detalhes do seu contrato comercial</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum contrato vinculado</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Sua organização não possui um contrato comercial vinculado.
              A cobrança é realizada via assinatura no gateway de pagamento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { slgConversion, proposal, paymentTerms, history } = contractData;

  // Calculate contract dates
  const contractStart = slgConversion?.converted_at 
    ? new Date(slgConversion.converted_at)
    : proposal?.accepted_at
      ? new Date(proposal.accepted_at)
      : null;

  const contractDuration = paymentTerms?.contract_duration_months || 12;
  const contractEnd = contractStart 
    ? addMonths(contractStart, contractDuration)
    : null;

  const billingDay = paymentTerms?.billing_day || paymentTerms?.recurring_due_day || 5;
  const autoRenewal = paymentTerms?.auto_renewal !== false;

  // Payment method label
  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "boleto": return "Boleto Bancário";
      case "pix": return "PIX";
      case "credit_card": return "Cartão de Crédito";
      case "transfer": return "Transferência Bancária";
      default: return method || "Não definido";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Contrato Vinculado</h2>
        <p className="text-muted-foreground">Detalhes do seu contrato comercial</p>
      </div>

      {/* Contract Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Proposta #{proposal?.proposal_number || "—"}
                </CardTitle>
                <CardDescription>
                  Contrato comercial ativo
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant="default" 
              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Plan */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Plano
              </p>
              <p className="font-medium capitalize">
                {organization?.current_plan_id || "—"}
              </p>
            </div>

            {/* MRR */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor Mensal
              </p>
              <p className="font-medium text-emerald-600">
                {slgConversion?.mrr_value 
                  ? formatCurrency(slgConversion.mrr_value)
                  : formatCurrency(proposal?.total_amount || 0)
                }
              </p>
            </div>

            {/* Billing Day */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dia de Vencimento
              </p>
              <p className="font-medium">Dia {billingDay}</p>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Forma de Pagamento
              </p>
              <p className="font-medium">
                {getPaymentMethodLabel(paymentTerms?.payment_method)}
              </p>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duração
              </p>
              <p className="font-medium">{contractDuration} meses</p>
            </div>

            {/* Auto Renewal */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Auto-renovação
              </p>
              <Badge variant={autoRenewal ? "default" : "secondary"}>
                {autoRenewal ? "Sim" : "Não"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Início do Contrato</p>
              <p className="font-medium">
                {contractStart 
                  ? format(contractStart, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "—"
                }
              </p>
              {contractStart && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(contractStart, { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Término do Contrato</p>
              <p className="font-medium">
                {contractEnd 
                  ? format(contractEnd, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : "—"
                }
              </p>
              {contractEnd && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(contractEnd, { addSuffix: true, locale: ptBR })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico do Contrato</CardTitle>
          <CardDescription>
            Eventos e alterações relacionadas ao contrato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history && history.length > 0 ? (
                history.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.action?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.field_name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.created_at && formatDistanceToNow(new Date(log.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum evento registrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
