import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, TrendingDown, Clock, DollarSign, 
  Users, Ban, Calendar, ArrowUpRight, ArrowDownRight,
  AlertCircle, CheckCircle, XCircle
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const COLORS = {
  current: "hsl(var(--primary))",
  overdue_1_30: "#f59e0b",
  overdue_31_60: "#f97316", 
  overdue_61_90: "#ef4444",
  overdue_90_plus: "#991b1b",
};

export function RevenueHealthTab() {
  // Fetch billing status data
  const { data: billingData, isLoading } = useQuery({
    queryKey: ["admin-revenue-health"],
    queryFn: async () => {
      // Get all billing statuses
      const { data: billingStatuses } = await supabase
        .from("organization_billing_status")
        .select(`
          *,
          organizations!inner(id, name, status, current_plan_id, calculated_mrr)
        `);

      // Get all organizations for comparison
      const { data: allOrgs } = await supabase
        .from("organizations")
        .select("id, name, status, current_plan_id, calculated_mrr")
        .not("current_plan_id", "eq", "internal_full")
        .not("current_plan_id", "eq", "freemium");

      // Get cancellation reasons for churn analysis from audit_log
      const { data: cancelLogs } = await supabase
        .from("audit_log")
        .select("entity_id, metadata, created_at")
        .eq("action", "cancel")
        .eq("entity_type", "organization")
        .order("created_at", { ascending: false });

      // Get canceled orgs
      const { data: canceledOrgs } = await supabase
        .from("organizations")
        .select("id, name, status")
        .eq("status", "canceled");

      // Get payment history for trend analysis
      const { data: payments } = await supabase
        .from("billing_payments")
        .select("*")
        .order("payment_date", { ascending: false });

      return {
        billingStatuses: billingStatuses || [],
        allOrgs: allOrgs || [],
        canceledOrgs: canceledOrgs || [],
        cancelLogs: cancelLogs || [],
        payments: payments || [],
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  // Calculate metrics
  const metrics = (() => {
    if (!billingData) return null;
    
    const { billingStatuses, allOrgs, canceledOrgs, cancelLogs, payments } = billingData;

    // Inadimplência metrics - check if blocked_at is set (indicates blocked)
    const overdue = billingStatuses.filter(b => b.payment_status === 'overdue');
    const blocked = billingStatuses.filter(b => b.blocked_at !== null);
    const totalPayingOrgs = allOrgs.filter(o => o.status === 'active').length;

    // Aging buckets
    const agingBuckets = {
      current: billingStatuses.filter(b => b.payment_status === 'paid' || b.payment_status === 'pending').length,
      overdue_1_30: overdue.filter(b => (b.days_overdue || 0) >= 1 && (b.days_overdue || 0) <= 30).length,
      overdue_31_60: overdue.filter(b => (b.days_overdue || 0) >= 31 && (b.days_overdue || 0) <= 60).length,
      overdue_61_90: overdue.filter(b => (b.days_overdue || 0) >= 61 && (b.days_overdue || 0) <= 90).length,
      overdue_90_plus: overdue.filter(b => (b.days_overdue || 0) > 90).length,
    };

    // MRR at risk
    const mrrAtRisk = overdue.reduce((sum, b) => {
      const org = b.organizations as any;
      return sum + (org?.calculated_mrr || b.amount_due || 0);
    }, 0);

    const mrrBlocked = blocked.reduce((sum, b) => {
      const org = b.organizations as any;
      return sum + (org?.calculated_mrr || b.amount_due || 0);
    }, 0);

    // Churn analysis (payment-related) - check audit logs metadata
    const paymentRelatedChurn = cancelLogs.filter(log => {
      const metadata = log.metadata as any;
      const reason = metadata?.reason?.toLowerCase() || '';
      return reason.includes('pagamento') ||
        reason.includes('inadimpl') ||
        reason.includes('financeiro') ||
        reason.includes('não pagou');
    });

    // Aging amounts
    const agingAmounts = {
      current: billingStatuses
        .filter(b => b.payment_status === 'paid' || b.payment_status === 'pending')
        .reduce((sum, b) => sum + (b.amount_due || 0), 0),
      overdue_1_30: overdue
        .filter(b => (b.days_overdue || 0) >= 1 && (b.days_overdue || 0) <= 30)
        .reduce((sum, b) => sum + (b.amount_due || 0), 0),
      overdue_31_60: overdue
        .filter(b => (b.days_overdue || 0) >= 31 && (b.days_overdue || 0) <= 60)
        .reduce((sum, b) => sum + (b.amount_due || 0), 0),
      overdue_61_90: overdue
        .filter(b => (b.days_overdue || 0) >= 61 && (b.days_overdue || 0) <= 90)
        .reduce((sum, b) => sum + (b.amount_due || 0), 0),
      overdue_90_plus: overdue
        .filter(b => (b.days_overdue || 0) > 90)
        .reduce((sum, b) => sum + (b.amount_due || 0), 0),
    };

    const totalReceivables = Object.values(agingAmounts).reduce((a, b) => a + b, 0);

    // Payment trend (last 6 months) - all payments are confirmed (manual registration)
    const now = new Date();
    const paymentTrend = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(now, 5 - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthPayments = payments.filter(p => {
        const paymentDate = new Date(p.payment_date);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });

      const received = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      return {
        month: format(date, "MMM", { locale: ptBR }),
        received,
        pending: 0, // Manual payments are always confirmed
      };
    });

    return {
      totalPayingOrgs,
      overdueCount: overdue.length,
      blockedCount: blocked.length,
      overdueRate: totalPayingOrgs > 0 ? (overdue.length / totalPayingOrgs) * 100 : 0,
      mrrAtRisk,
      mrrBlocked,
      agingBuckets,
      agingAmounts,
      totalReceivables,
      paymentRelatedChurn: paymentRelatedChurn.length,
      totalChurn: canceledOrgs.length,
      churnByPaymentRate: canceledOrgs.length > 0 
        ? (paymentRelatedChurn.length / canceledOrgs.length) * 100 
        : 0,
      paymentTrend,
      overdueOrgs: overdue.map(b => ({
        id: (b.organizations as any)?.id,
        name: (b.organizations as any)?.name,
        daysOverdue: b.days_overdue || 0,
        amount: b.amount_due || 0,
        isBlocked: b.blocked_at !== null,
      })).sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  })();

  const agingChartData = metrics ? [
    { name: "Em dia", value: metrics.agingBuckets.current, amount: metrics.agingAmounts.current, fill: COLORS.current },
    { name: "1-30 dias", value: metrics.agingBuckets.overdue_1_30, amount: metrics.agingAmounts.overdue_1_30, fill: COLORS.overdue_1_30 },
    { name: "31-60 dias", value: metrics.agingBuckets.overdue_31_60, amount: metrics.agingAmounts.overdue_31_60, fill: COLORS.overdue_31_60 },
    { name: "61-90 dias", value: metrics.agingBuckets.overdue_61_90, amount: metrics.agingAmounts.overdue_61_90, fill: COLORS.overdue_61_90 },
    { name: ">90 dias", value: metrics.agingBuckets.overdue_90_plus, amount: metrics.agingAmounts.overdue_90_plus, fill: COLORS.overdue_90_plus },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Inadimplência
            </div>
            <p className="text-2xl font-bold mt-1">
              {metrics.overdueCount} <span className="text-base font-normal text-muted-foreground">orgs</span>
            </p>
            <p className="text-sm text-destructive flex items-center gap-1 mt-1">
              {metrics.overdueRate.toFixed(1)}% da base pagante
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4 text-orange-500" />
              MRR em Risco
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(metrics.mrrAtRisk)}
            </p>
            <p className="text-sm text-orange-600 mt-1">
              Receita com atraso
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Ban className="h-4 w-4 text-red-700" />
              Bloqueados
            </div>
            <p className="text-2xl font-bold mt-1">
              {metrics.blockedCount} <span className="text-base font-normal text-muted-foreground">orgs</span>
            </p>
            <p className="text-sm text-red-700 mt-1">
              {formatCurrency(metrics.mrrBlocked)} MRR suspenso
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4 text-purple-500" />
              Churn por Pagamento
            </div>
            <p className="text-2xl font-bold mt-1">
              {metrics.paymentRelatedChurn} <span className="text-base font-normal text-muted-foreground">de {metrics.totalChurn}</span>
            </p>
            <p className="text-sm text-purple-600 mt-1">
              {metrics.churnByPaymentRate.toFixed(1)}% do churn total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aging de Recebíveis - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aging de Recebíveis
            </CardTitle>
            <CardDescription>
              Distribuição por dias de atraso (contas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value} orgs (${formatCurrency(props.payload.amount)})`,
                      "Quantidade"
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Aging Summary */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total a receber</span>
                <span className="font-semibold">{formatCurrency(metrics.totalReceivables)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-muted-foreground">Em atraso</span>
                <span className="font-semibold text-destructive">
                  {formatCurrency(
                    metrics.agingAmounts.overdue_1_30 + 
                    metrics.agingAmounts.overdue_31_60 + 
                    metrics.agingAmounts.overdue_61_90 + 
                    metrics.agingAmounts.overdue_90_plus
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aging por Valor - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Composição do Recebível
            </CardTitle>
            <CardDescription>
              Distribuição por valor (R$)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agingChartData.filter(d => d.amount > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="amount"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {agingChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Histórico de Recebimentos
          </CardTitle>
          <CardDescription>
            Pagamentos recebidos vs pendentes (últimos 6 meses)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.paymentTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="received" name="Recebido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Organizações Inadimplentes
          </CardTitle>
          <CardDescription>
            Ordenado por dias de atraso (maior primeiro)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.overdueOrgs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Nenhuma organização inadimplente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead className="text-center">Dias em Atraso</TableHead>
                  <TableHead className="text-right">Valor Devido</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.overdueOrgs.slice(0, 15).map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <Link 
                        to={`/admin/organizations/${org.id}`}
                        className="font-medium hover:underline text-primary"
                      >
                        {org.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline"
                        className={
                          org.daysOverdue > 90 ? "border-red-700 text-red-700" :
                          org.daysOverdue > 60 ? "border-destructive text-destructive" :
                          org.daysOverdue > 30 ? "border-orange-500 text-orange-600" :
                          "border-yellow-500 text-yellow-600"
                        }
                      >
                        {org.daysOverdue} dias
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(org.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {org.isBlocked ? (
                        <Badge className="bg-red-700 text-white">
                          <Ban className="h-3 w-3 mr-1" />
                          Bloqueado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Inadimplente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
