import { 
  Building2, 
  Users, 
  DollarSign, 
  Activity, 
  Zap, 
  Target,
  FileText,
  TrendingUp,
  TrendingDown,
  UserCheck,
  UserMinus,
  Clock,
  Brain
} from "lucide-react";
import { AdminKPICard } from "@/components/admin/AdminKPICard";
import { AlertFeed } from "@/components/admin/AlertFeed";
import { useAdminMetrics, useAdminAlerts } from "@/hooks/admin/useAdminMetrics";
import { useAdminCharts } from "@/hooks/admin/useAdminCharts";
import { ReleaseNotesAutomationCard } from "@/components/admin/ReleaseNotesAutomationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

export default function CommandCenter() {
  const { data: metrics, isLoading: metricsLoading } = useAdminMetrics();
  const { data: alerts = [], isLoading: alertsLoading } = useAdminAlerts();
  const { data: charts, isLoading: chartsLoading } = useAdminCharts();

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

      {/* Main KPIs Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminKPICard
          title="Organizações"
          value={metrics?.totalOrganizations || 0}
          subtitle={`${metrics?.activeOrganizations || 0} ativas`}
          icon={Building2}
          variant="default"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Em Trial"
          value={metrics?.trialOrganizations || 0}
          subtitle="Expirando em breve"
          icon={Clock}
          variant="warning"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Suspensas"
          value={metrics?.suspendedOrganizations || 0}
          subtitle="Requer atenção"
          icon={UserMinus}
          variant="danger"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="MRR Global"
          value={formatCurrency(metrics?.totalMRR || 0)}
          subtitle={`ARR: ${formatCurrency(metrics?.totalARR || 0)}`}
          icon={DollarSign}
          trend={{ value: 15, label: "vs mês anterior" }}
          variant="success"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Churn Rate"
          value={`${metrics?.churnRate || 0}%`}
          subtitle="Últimos 30 dias"
          icon={TrendingDown}
          variant={metrics?.churnRate && metrics.churnRate > 5 ? "danger" : "success"}
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Growth Rate"
          value={`${metrics?.growthRate || 0}%`}
          subtitle="MoM"
          icon={TrendingUp}
          variant="success"
          loading={metricsLoading}
        />
      </div>

      {/* Main KPIs Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminKPICard
          title="Usuários Total"
          value={metrics?.totalUsers || 0}
          subtitle="Registrados"
          icon={Users}
          variant="info"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="DAU (Hoje)"
          value={metrics?.activeUsersToday || 0}
          subtitle="Usuários ativos"
          icon={UserCheck}
          variant="success"
          loading={metricsLoading}
        />
        <AdminKPICard
          title="MAU (7 dias)"
          value={metrics?.activeUsersWeek || 0}
          subtitle="Ativos na semana"
          icon={Activity}
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
        <AdminKPICard
          title="Oportunidades"
          value={metrics?.totalOpportunities?.toLocaleString() || "0"}
          subtitle="No sistema"
          icon={Target}
          loading={metricsLoading}
        />
        <AdminKPICard
          title="Propostas"
          value={metrics?.totalProposals?.toLocaleString() || "0"}
          subtitle="Criadas"
          icon={FileText}
          loading={metricsLoading}
        />
      </div>

      {/* Charts Row 1 */}
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
              {chartsLoading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.revenueData || []}>
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {chartsLoading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts?.planDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(charts?.planDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value}%`, "Contas"]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signups Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Novos Signups</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Últimos 7 dias
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {chartsLoading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.signupsData || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="date" 
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
                      dataKey="signups" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Usage by Feature */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Uso de IA por Feature
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {chartsLoading ? (
                <Skeleton className="w-full h-full" />
              ) : charts?.aiUsageByFeature?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.aiUsageByFeature} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      type="number"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      type="category"
                      dataKey="feature"
                      className="text-xs fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toLocaleString()} VOLTS`, ""]}
                    />
                    <Bar 
                      dataKey="volts" 
                      fill="hsl(45, 93%, 47%)" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum uso de IA registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <AlertFeed alerts={alerts} loading={alertsLoading} />
      </div>

      {/* Operações da Plataforma */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReleaseNotesAutomationCard />
      </div>

      {/* Organization Status & MRR by Channel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usuários Ativos por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {chartsLoading ? (
                <Skeleton className="w-full h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.usageData || []}>
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
              )}
            </div>
          </CardContent>
        </Card>

        {/* MRR by Channel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">MRR por Canal de Aquisição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartsLoading ? (
                <Skeleton className="w-full h-[200px]" />
              ) : (
                <>
                  {(charts?.mrrByChannel || []).map((channel) => (
                    <div 
                      key={channel.channel} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{ 
                        backgroundColor: `${channel.color}10`, 
                        borderColor: `${channel.color}30` 
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: channel.color }}
                        />
                        <div>
                          <span className="text-sm font-medium">{channel.channel}</span>
                          <p className="text-xs text-muted-foreground">{channel.count} clientes</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold">{formatCurrency(channel.mrr)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Total MRR</span>
                      <span className="text-lg font-bold">
                        {formatCurrency((charts?.mrrByChannel || []).reduce((sum, c) => sum + c.mrr, 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status das Organizações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Ativas (Pagas)</span>
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
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                  <span className="text-sm font-medium">Canceladas</span>
                </div>
                <span className="text-lg font-bold">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
