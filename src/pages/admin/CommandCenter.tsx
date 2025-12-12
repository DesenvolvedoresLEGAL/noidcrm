import { 
  Building2, 
  Users, 
  DollarSign, 
  Activity, 
  Zap, 
  Target,
  FileText,
  CalendarCheck,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { AdminKPICard } from "@/components/admin/AdminKPICard";
import { AlertFeed } from "@/components/admin/AlertFeed";
import { useAdminMetrics, useAdminAlerts } from "@/hooks/admin/useAdminMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

// Mock data for charts (would come from analytics)
const revenueData = [
  { month: "Jul", mrr: 4200 },
  { month: "Ago", mrr: 5800 },
  { month: "Set", mrr: 7200 },
  { month: "Out", mrr: 8500 },
  { month: "Nov", mrr: 9800 },
  { month: "Dez", mrr: 12500 },
];

const usageData = [
  { day: "Seg", users: 45 },
  { day: "Ter", users: 52 },
  { day: "Qua", users: 48 },
  { day: "Qui", users: 61 },
  { day: "Sex", users: 55 },
  { day: "Sab", users: 22 },
  { day: "Dom", users: 18 },
];

export default function CommandCenter() {
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();
  const { data: alerts = [], isLoading: alertsLoading } = useAdminAlerts();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">
            Overview executivo do NOID Revenue OS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Tempo Real
          </Badge>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminKPICard
          title="Organizações"
          value={metrics?.totalOrganizations || 0}
          subtitle={`${metrics?.activeOrganizations || 0} ativas • ${metrics?.trialOrganizations || 0} trial`}
          icon={Building2}
          variant="default"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Usuários"
          value={metrics?.totalUsers || 0}
          subtitle={`${metrics?.activeUsersToday || 0} ativos hoje`}
          icon={Users}
          trend={{ value: 12, label: "vs semana passada" }}
          variant="info"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="MRR"
          value={formatCurrency(metrics?.totalMRR || 0)}
          subtitle={`ARR: ${formatCurrency(metrics?.totalARR || 0)}`}
          icon={DollarSign}
          trend={{ value: 15, label: "vs mês anterior" }}
          variant="success"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="VOLTS Consumidos"
          value={metrics?.totalVoltsConsumed?.toLocaleString() || "0"}
          subtitle="Ações de IA"
          icon={Zap}
          variant="warning"
          loading={metricsLoading}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminKPICard
          title="Oportunidades"
          value={metrics?.totalOpportunities?.toLocaleString() || "0"}
          subtitle="Total no sistema"
          icon={Target}
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Propostas"
          value={metrics?.totalProposals?.toLocaleString() || "0"}
          subtitle="Total criadas"
          icon={FileText}
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Atividades"
          value={metrics?.totalActivities?.toLocaleString() || "0"}
          subtitle="Total registradas"
          icon={CalendarCheck}
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Taxa de Crescimento"
          value={`${metrics?.growthRate || 0}%`}
          subtitle="MoM"
          icon={TrendingUp}
          variant="success"
          loading={metricsLoading}
        />
      </div>

      {/* Charts & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Evolução MRR</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Últimos 6 meses
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [formatCurrency(value), "MRR"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#mrrGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <AlertFeed alerts={alerts} loading={alertsLoading} />
      </div>

      {/* Usage Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Usuários Ativos por Dia</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Última semana
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="day" 
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar 
                    dataKey="users" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Organization Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status das Organizações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Ativas</span>
                </div>
                <span className="text-lg font-bold">{metrics?.activeOrganizations || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium">Em Trial</span>
                </div>
                <span className="text-lg font-bold">{metrics?.trialOrganizations || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm font-medium">Suspensas</span>
                </div>
                <span className="text-lg font-bold">{metrics?.suspendedOrganizations || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
