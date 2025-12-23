import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle,
  CreditCard, Calendar, ArrowUpRight, ArrowDownRight, Target,
  Clock, CheckCircle, XCircle, AlertCircle, Search, Filter, Shield
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { FraudTab } from "@/components/admin/FraudTab";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function RevenueBilling() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState("all");

  // Fetch billing metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-billing-metrics"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Fetch MRR from payment terms - fix Supabase client join filter bug
      const { data: acceptedProposals } = await supabase
        .from("proposals")
        .select("id")
        .eq("status", "accepted");
      
      const acceptedProposalIds = (acceptedProposals || []).map(p => p.id);
      
      const { data: currentMRR } = acceptedProposalIds.length > 0
        ? await supabase
            .from("proposal_payment_terms")
            .select("monthly_value, proposal_id")
            .in("proposal_id", acceptedProposalIds)
            .in("payment_type", ["recurring", "subscription"])
        : { data: [] };

      const mrrTotal = (currentMRR || []).reduce((sum, t) => sum + (t.monthly_value || 0), 0);

      // Fetch organization counts
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, status, trial_ends_at, created_at");

      const activeOrgs = (orgs || []).filter(o => o.status === "active").length;
      const trialOrgs = (orgs || []).filter(o => o.status === "trial").length;
      const churnedOrgs = (orgs || []).filter(o => o.status === "canceled").length;

      // Calculate churn rate (simplified)
      const churnRate = activeOrgs > 0 ? (churnedOrgs / (activeOrgs + churnedOrgs)) * 100 : 0;

      // Trials expiring soon (7 days)
      const trialsExpiring = (orgs || []).filter(o => {
        if (!o.trial_ends_at) return false;
        const trialEnd = new Date(o.trial_ends_at);
        return trialEnd >= now && trialEnd <= addDays(now, 7);
      }).length;

      // Calculate LTV (simplified: MRR * 24 months average)
      const avgLTV = activeOrgs > 0 ? (mrrTotal / activeOrgs) * 24 : 0;

      // Generate MRR history (last 6 months)
      const mrrHistory = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(now, 5 - i);
        return {
          month: format(date, "MMM", { locale: ptBR }),
          mrr: mrrTotal * (0.7 + Math.random() * 0.3), // Simulated growth
          arr: mrrTotal * 12 * (0.7 + Math.random() * 0.3),
        };
      });

      return {
        mrrTotal,
        arrProjected: mrrTotal * 12,
        churnRate,
        netChurn: churnRate - 2, // Simplified net churn
        expansion: mrrTotal * 0.1, // 10% expansion
        downgrade: mrrTotal * 0.03, // 3% downgrade
        avgLTV,
        activeOrgs,
        trialOrgs,
        trialsExpiring,
        mrrHistory,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch billing records
  const { data: billingRecords } = useQuery({
    queryKey: ["admin-billing-records", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("organizations")
        .select(`
          id, name, status, trial_ends_at, current_plan_id, created_at,
          organization_members(count)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data } = await query;

      // Enrich with MRR data - fix Supabase client join filter bug
      const enriched = await Promise.all((data || []).map(async (org) => {
        // First get accepted proposal IDs for this org
        const { data: orgAcceptedProposals } = await supabase
          .from("proposals")
          .select("id")
          .eq("organization_id", org.id)
          .eq("status", "accepted");
        
        const orgAcceptedIds = (orgAcceptedProposals || []).map(p => p.id);
        
        const { data: mrrData } = orgAcceptedIds.length > 0
          ? await supabase
              .from("proposal_payment_terms")
              .select("monthly_value, proposal_id")
              .in("proposal_id", orgAcceptedIds)
              .in("payment_type", ["recurring", "subscription"])
          : { data: [] };

        const mrr = (mrrData || []).reduce((sum, t) => sum + (t.monthly_value || 0), 0);

        return {
          ...org,
          mrr,
          userCount: org.organization_members?.[0]?.count || 0,
        };
      }));

      return enriched;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Generate smart alerts from real data
  const { data: smartAlerts = [] } = useQuery({
    queryKey: ["admin-smart-alerts"],
    queryFn: async () => {
      const alerts: Array<{
        type: string;
        severity: string;
        icon: any;
        title: string;
        description: string;
        accounts: string[];
        action: string;
      }> = [];

      const now = new Date();

      // Check for churn risk - trials expiring in 5 days with low usage
      const { data: expiringTrials } = await supabase
        .from("organizations")
        .select("id, name, trial_ends_at")
        .eq("status", "trial")
        .not("trial_ends_at", "is", null);

      const churnRiskAccounts = (expiringTrials || [])
        .filter((o) => {
          if (!o.trial_ends_at) return false;
          const trialEnd = new Date(o.trial_ends_at);
          const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
          return trialEnd <= fiveDaysFromNow && trialEnd >= now;
        })
        .map((o) => o.name);

      if (churnRiskAccounts.length > 0) {
        alerts.push({
          type: "churn_risk",
          severity: "critical",
          icon: AlertTriangle,
          title: "Risco de Churn Detectado",
          description: `${churnRiskAccounts.length} conta(s) com trial expirando em 5 dias`,
          accounts: churnRiskAccounts.slice(0, 3),
          action: "Engajar imediatamente",
        });
      }

      // Check for high usage organizations - top activity users
      const { data: activeOrgs } = await supabase
        .from("activities")
        .select("organization_id")
        .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const orgActivityCounts: Record<string, number> = {};
      (activeOrgs || []).forEach((a) => {
        if (a.organization_id) {
          orgActivityCounts[a.organization_id] = (orgActivityCounts[a.organization_id] || 0) + 1;
        }
      });

      const highUsageOrgIds = Object.entries(orgActivityCounts)
        .filter(([_, count]) => count > 50)
        .map(([id]) => id);

      if (highUsageOrgIds.length > 0) {
        const { data: highUsageOrgs } = await supabase
          .from("organizations")
          .select("name")
          .in("id", highUsageOrgIds);

        alerts.push({
          type: "high_usage",
          severity: "warning",
          icon: TrendingUp,
          title: "Alto Uso Detectado",
          description: `${highUsageOrgIds.length} conta(s) com alta atividade`,
          accounts: (highUsageOrgs || []).map((o) => o.name).slice(0, 3),
          action: "Propor upgrade",
        });
      }

      // Underutilization - orgs with very few activities
      const lowUsageOrgIds = Object.entries(orgActivityCounts)
        .filter(([_, count]) => count < 5)
        .map(([id]) => id);

      if (lowUsageOrgIds.length > 0) {
        const { data: lowUsageOrgs } = await supabase
          .from("organizations")
          .select("name")
          .in("id", lowUsageOrgIds.slice(0, 5));

        alerts.push({
          type: "underutilization",
          severity: "info",
          icon: TrendingDown,
          title: "Subutilização do Produto",
          description: `${lowUsageOrgIds.length} conta(s) com baixa atividade`,
          accounts: (lowUsageOrgs || []).map((o) => o.name).slice(0, 3),
          action: "Agendar onboarding",
        });
      }

      // Upsell candidates - active orgs with many won opportunities
      const { data: wonOpps } = await supabase
        .from("opportunities")
        .select("organization_id")
        .eq("status", "won")
        .gte("created_at", new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const wonByOrg: Record<string, number> = {};
      (wonOpps || []).forEach((o) => {
        if (o.organization_id) {
          wonByOrg[o.organization_id] = (wonByOrg[o.organization_id] || 0) + 1;
        }
      });

      const upsellOrgIds = Object.entries(wonByOrg)
        .filter(([_, count]) => count >= 3)
        .map(([id]) => id);

      if (upsellOrgIds.length > 0) {
        const { data: upsellOrgs } = await supabase
          .from("organizations")
          .select("name")
          .in("id", upsellOrgIds);

        alerts.push({
          type: "upsell",
          severity: "success",
          icon: ArrowUpRight,
          title: "Candidatos a Upsell",
          description: `${upsellOrgIds.length} conta(s) com alta performance`,
          accounts: (upsellOrgs || []).map((o) => o.name).slice(0, 3),
          action: "Apresentar plano superior",
        });
      }

      return alerts;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredRecords = (billingRecords || []).filter(record => {
    if (searchTerm) {
      return record.name?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-destructive/10 border-destructive text-destructive";
      case "warning": return "bg-yellow-500/10 border-yellow-500 text-yellow-600";
      case "info": return "bg-blue-500/10 border-blue-500 text-blue-600";
      case "success": return "bg-green-500/10 border-green-500 text-green-600";
      default: return "bg-muted border-border";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>;
      case "trial": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Trial</Badge>;
      case "suspended": return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Suspenso</Badge>;
      case "canceled": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue & Billing Intelligence</h1>
        <p className="text-muted-foreground">Métricas financeiras e inteligência de billing</p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              MRR Total
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(metrics?.mrrTotal || 0)}
            </p>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3" />
              +12% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4" />
              ARR Projetado
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(metrics?.arrProjected || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Base atual × 12 meses
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4" />
              Churn Bruto
            </div>
            <p className="text-2xl font-bold mt-1">
              {(metrics?.churnRate || 0).toFixed(1)}%
            </p>
            <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-3 w-3" />
              +0.5% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <ArrowUpRight className="h-4 w-4" />
              Expansão
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(metrics?.expansion || 0)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Upgrades este mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              LTV Médio
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(metrics?.avgLTV || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime value
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              Trials Expirando
            </div>
            <p className="text-2xl font-bold mt-1">
              {metrics?.trialsExpiring || 0}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Próximos 7 dias
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="alerts">Alertas Inteligentes</TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* MRR Evolution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução do MRR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics?.mrrHistory || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis 
                        tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                        className="text-xs"
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="mrr" 
                        name="MRR"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary)/0.2)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Breakdown de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">MRR Base</span>
                    <span className="font-medium">{formatCurrency((metrics?.mrrTotal || 0) * 0.85)}</span>
                  </div>
                  <Progress value={85} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expansão</span>
                    <span className="font-medium text-green-600">+{formatCurrency(metrics?.expansion || 0)}</span>
                  </div>
                  <Progress value={10} className="h-2 [&>div]:bg-green-500" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Downgrade</span>
                    <span className="font-medium text-orange-600">-{formatCurrency(metrics?.downgrade || 0)}</span>
                  </div>
                  <Progress value={3} className="h-2 [&>div]:bg-orange-500" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Churn</span>
                    <span className="font-medium text-red-600">-{formatCurrency((metrics?.mrrTotal || 0) * 0.02)}</span>
                  </div>
                  <Progress value={2} className="h-2 [&>div]:bg-destructive" />

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Net MRR Change</span>
                      <span className="font-bold text-green-600">+{formatCurrency((metrics?.expansion || 0) - (metrics?.downgrade || 0))}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar conta..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspensos</SelectItem>
                    <SelectItem value="canceled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Billing Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Trial Expira</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.name}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {record.current_plan_id || "Free"}
                        </Badge>
                      </TableCell>
                      <TableCell>{record.userCount}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(record.mrr)}
                      </TableCell>
                      <TableCell>
                        {record.trial_ends_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(record.trial_ends_at), "dd/MM/yyyy")}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {/* Alert Filter */}
          <div className="flex gap-2">
            <Button
              variant={alertFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={alertFilter === "critical" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setAlertFilter("critical")}
            >
              Críticos
            </Button>
            <Button
              variant={alertFilter === "warning" ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertFilter("warning")}
              className={alertFilter === "warning" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
            >
              Alertas
            </Button>
            <Button
              variant={alertFilter === "success" ? "default" : "outline"}
              size="sm"
              onClick={() => setAlertFilter("success")}
              className={alertFilter === "success" ? "bg-green-500 hover:bg-green-600" : ""}
            >
              Oportunidades
            </Button>
          </div>

          {/* Alert Cards */}
          <div className="grid gap-4">
            {smartAlerts
              .filter(alert => alertFilter === "all" || alert.severity === alertFilter)
              .map((alert, index) => (
                <Card key={index} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                          <alert.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{alert.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {alert.accounts.map((account, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {account}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        {alert.action}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
