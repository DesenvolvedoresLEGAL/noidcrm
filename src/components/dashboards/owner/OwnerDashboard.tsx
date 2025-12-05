import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { OwnerKPICards } from "./OwnerKPICards";
import { SalesTrendChart } from "./SalesTrendChart";
import { AIForecastChart } from "./AIForecastChart";
import { SellerProductivityChart } from "./SellerProductivityChart";
import { CRMHeatmapChart } from "./CRMHeatmapChart";
import { OwnerSmartLists } from "./OwnerSmartLists";
import { HumanoidInsights } from "./HumanoidInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Crown } from "lucide-react";

export function OwnerDashboard() {
  const { data, isLoading, error } = useOwnerDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-80 col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-medium">Erro ao carregar dashboard</p>
          <p className="text-sm text-muted-foreground">Tente novamente mais tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Crown className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Cockpit Executivo</h1>
          <p className="text-muted-foreground">
            Visão estratégica • Receita • Previsibilidade • AI Insights
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <OwnerKPICards data={data} />

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenue">Receita & Forecast</TabsTrigger>
          <TabsTrigger value="team">Time & Produtividade</TabsTrigger>
          <TabsTrigger value="strategic">Estratégico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* HUMANOID Insights */}
          <HumanoidInsights insights={data.humanoidInsights} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SalesTrendChart 
              data={data.salesTrend} 
              yearlyGoal={data.revenue.yearlyGoal} 
            />
            <AIForecastChart 
              forecast={data.forecast} 
              yearlyGoal={data.revenue.yearlyGoal} 
            />
          </div>

          {/* Smart Lists */}
          <OwnerSmartLists data={data} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SalesTrendChart 
              data={data.salesTrend} 
              yearlyGoal={data.revenue.yearlyGoal} 
            />
            <AIForecastChart 
              forecast={data.forecast} 
              yearlyGoal={data.revenue.yearlyGoal} 
            />
          </div>
          
          {/* Revenue metrics breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.metrics.avgTicketByProduct.slice(0, 6).map((item, i) => (
              <div key={i} className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">{item.product}</p>
                <p className="text-xl font-bold">
                  R${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SellerProductivityChart data={data.sellerProductivity} />
            <CRMHeatmapChart data={data.crmHeatmap} />
          </div>

          {/* Team performance table */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="font-medium mb-4">Ranking de Produtividade</h3>
            <div className="space-y-2">
              {data.sellerProductivity.slice(0, 10).map((seller, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-background rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">
                      #{i + 1}
                    </span>
                    <span className="font-medium">{seller.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{seller.deals} deals</span>
                    <span className={seller.winRate >= 50 ? 'text-green-600' : 'text-muted-foreground'}>
                      {seller.winRate.toFixed(0)}% conversão
                    </span>
                    <span className="font-bold">
                      R${seller.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="strategic" className="space-y-4">
          <HumanoidInsights insights={data.humanoidInsights} />
          <OwnerSmartLists data={data} />
          <CRMHeatmapChart data={data.crmHeatmap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
