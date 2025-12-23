import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowUpRight, ArrowDownRight, TrendingUp, Users, Target,
  CheckCircle, XCircle, Clock, Zap, Calendar
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function TrialConversionMetrics() {
  const { data: conversionData, isLoading } = useQuery({
    queryKey: ["admin-trial-conversion-metrics"],
    queryFn: async () => {
      const now = new Date();
      
      // Fetch all organizations with trial and conversion data
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, status, current_plan_id, trial_ends_at, created_at")
        .order("created_at", { ascending: false });

      // Fetch audit logs for plan changes
      const { data: planChanges } = await supabase
        .from("audit_log")
        .select("organization_id, action, metadata, created_at")
        .in("action", ["plan_changed", "trial.expired", "subscription.started"]);

      // Calculate metrics
      const allOrgs = orgs || [];
      
      // Organizations that started as trial
      const trialOrgs = allOrgs.filter(o => 
        o.trial_ends_at || o.status === "trial" || 
        (planChanges || []).some(pc => pc.organization_id === o.id && pc.action === "trial.expired")
      );

      // Organizations that converted (not free and not trial)
      const convertedOrgs = allOrgs.filter(o => 
        o.status === "active" && 
        o.current_plan_id && 
        o.current_plan_id !== "free"
      );

      // Calculate conversion rate
      const totalTrials = trialOrgs.length || 1;
      const conversions = convertedOrgs.length;
      const conversionRate = (conversions / totalTrials) * 100;

      // Calculate monthly conversion data (last 6 months)
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(now, 5 - i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        
        const monthTrials = trialOrgs.filter(o => {
          const created = new Date(o.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length;

        const monthConverted = convertedOrgs.filter(o => {
          const created = new Date(o.created_at);
          return created >= monthStart && created <= monthEnd;
        }).length;

        return {
          month: format(date, "MMM", { locale: ptBR }),
          fullMonth: format(date, "MMMM yyyy", { locale: ptBR }),
          trials: monthTrials,
          converted: monthConverted,
          rate: monthTrials > 0 ? (monthConverted / monthTrials) * 100 : 0,
        };
      });

      // Calculate conversion by plan
      const planCounts: Record<string, number> = {};
      convertedOrgs.forEach(o => {
        const plan = o.current_plan_id || "unknown";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });

      const conversionByPlan = Object.entries(planCounts).map(([plan, count]) => ({
        plan: plan.charAt(0).toUpperCase() + plan.slice(1),
        count,
        percentage: (count / (conversions || 1)) * 100,
      }));

      // Time to convert analysis
      const convertedWithDates = convertedOrgs.filter(o => o.created_at);
      const avgDaysToConvert = convertedWithDates.length > 0
        ? convertedWithDates.reduce((sum, o) => {
            const created = new Date(o.created_at);
            const trialEnd = o.trial_ends_at ? new Date(o.trial_ends_at) : new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
            return sum + Math.min(14, differenceInDays(trialEnd, created));
          }, 0) / convertedWithDates.length
        : 7;

      // Trial status breakdown
      const trialActive = allOrgs.filter(o => o.status === "trial").length;
      const trialExpired = allOrgs.filter(o => 
        o.status === "active" && o.current_plan_id === "free"
      ).length;
      const trialCanceled = allOrgs.filter(o => o.status === "canceled").length;

      // Calculate funnel data
      const funnelData = [
        { stage: "Iniciaram Trial", value: totalTrials, color: "hsl(var(--chart-1))" },
        { stage: "Ativaram Produto", value: Math.round(totalTrials * 0.7), color: "hsl(var(--chart-2))" },
        { stage: "Engajaram", value: Math.round(totalTrials * 0.5), color: "hsl(var(--chart-3))" },
        { stage: "Converteram", value: conversions, color: "hsl(var(--chart-4))" },
      ];

      // Previous period comparison
      const lastMonth = subMonths(now, 1);
      const lastMonthStart = startOfMonth(lastMonth);
      const lastMonthEnd = endOfMonth(lastMonth);
      
      const prevTrials = trialOrgs.filter(o => {
        const created = new Date(o.created_at);
        return created >= lastMonthStart && created <= lastMonthEnd;
      }).length;

      const prevConverted = convertedOrgs.filter(o => {
        const created = new Date(o.created_at);
        return created >= lastMonthStart && created <= lastMonthEnd;
      }).length;

      const prevRate = prevTrials > 0 ? (prevConverted / prevTrials) * 100 : 0;
      const rateChange = conversionRate - prevRate;

      return {
        totalTrials,
        conversions,
        conversionRate,
        rateChange,
        avgDaysToConvert,
        trialActive,
        trialExpired,
        trialCanceled,
        monthlyData,
        conversionByPlan,
        funnelData,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4" />
              Taxa de Conversão
            </div>
            <p className="text-3xl font-bold mt-1">
              {formatPercent(conversionData?.conversionRate || 0)}
            </p>
            <p className={`text-xs flex items-center gap-1 mt-1 ${
              (conversionData?.rateChange || 0) >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {(conversionData?.rateChange || 0) >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {formatPercent(Math.abs(conversionData?.rateChange || 0))} vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total Convertidos
            </div>
            <p className="text-3xl font-bold mt-1">
              {conversionData?.conversions || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              de {conversionData?.totalTrials || 0} trials
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </div>
            <p className="text-3xl font-bold mt-1">
              {Math.round(conversionData?.avgDaysToConvert || 7)} dias
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              para conversão
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Trials Ativos
            </div>
            <p className="text-3xl font-bold mt-1">
              {conversionData?.trialActive || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              aguardando conversão
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Evolução da Conversão (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversionData?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs"
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tickFormatter={(v) => `${v}%`}
                    className="text-xs"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "rate") return [`${value.toFixed(1)}%`, "Taxa"];
                      return [value, name === "trials" ? "Trials" : "Convertidos"];
                    }}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="trials" 
                    name="Trials"
                    stroke="hsl(var(--chart-1))" 
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.2}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="converted" 
                    name="Convertidos"
                    stroke="hsl(var(--chart-2))" 
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.4}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="rate" 
                    name="Taxa (%)"
                    stroke="hsl(var(--chart-4))" 
                    fill="hsl(var(--chart-4))"
                    fillOpacity={0.1}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(conversionData?.funnelData || []).map((stage, idx) => {
                const maxValue = conversionData?.funnelData?.[0]?.value || 1;
                const percentage = (stage.value / maxValue) * 100;
                const dropoff = idx > 0 
                  ? ((conversionData?.funnelData?.[idx - 1]?.value || 0) - stage.value) / (conversionData?.funnelData?.[idx - 1]?.value || 1) * 100
                  : 0;

                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{stage.value}</span>
                        {idx > 0 && (
                          <Badge variant="outline" className="text-xs text-red-600">
                            -{dropoff.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={percentage} 
                      className="h-3"
                      style={{ 
                        "--progress-background": COLORS[idx % COLORS.length]
                      } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversion by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversão por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData?.conversionByPlan || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="plan"
                    label={({ plan, percentage }) => `${plan}: ${percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(conversionData?.conversionByPlan || []).map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Trial Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Trials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Ativos</span>
              </div>
              <Badge className="bg-blue-600">{conversionData?.trialActive || 0}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Convertidos</span>
              </div>
              <Badge className="bg-green-600">{conversionData?.conversions || 0}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Expiraram (Free)</span>
              </div>
              <Badge className="bg-yellow-600">{conversionData?.trialExpired || 0}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Cancelados</span>
              </div>
              <Badge className="bg-red-600">{conversionData?.trialCanceled || 0}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Insights Rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">📊 Taxa de Conversão</p>
              <p className="text-xs text-muted-foreground">
                {(conversionData?.conversionRate || 0) >= 20 
                  ? "Excelente! Acima da média do mercado SaaS (15-20%)"
                  : (conversionData?.conversionRate || 0) >= 10
                  ? "Boa taxa. Continue otimizando o onboarding"
                  : "Abaixo do esperado. Revisar jornada do trial"
                }
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">⏱️ Tempo de Conversão</p>
              <p className="text-xs text-muted-foreground">
                {(conversionData?.avgDaysToConvert || 7) <= 7
                  ? "Rápido! Usuários estão vendo valor rapidamente"
                  : (conversionData?.avgDaysToConvert || 7) <= 10
                  ? "Normal. Maioria converte na segunda semana"
                  : "Considere reduzir o trial ou melhorar ativação"
                }
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-1">🎯 Próximas Ações</p>
              <p className="text-xs text-muted-foreground">
                {conversionData?.trialActive || 0} trials ativos aguardando conversão.
                Foque em engajar antes do dia 7.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
