import { motion } from "framer-motion";
import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { OwnerKPICards } from "./OwnerKPICards";
import { SalesTrendChart } from "./SalesTrendChart";
import { AIForecastChart } from "./AIForecastChart";
import { SellerProductivityChart } from "./SellerProductivityChart";
import { CRMHeatmapChart } from "./CRMHeatmapChart";
import { OwnerSmartLists } from "./OwnerSmartLists";
import { HumanoidInsights } from "./HumanoidInsights";
import { PipelineSnapshotChart } from "./PipelineSnapshotChart";
import { WinLossDonutChart } from "./WinLossDonutChart";
import { KeyDealsSummary } from "./KeyDealsSummary";
import { RevenueComparisonChart } from "./RevenueComparisonChart";
import { DashboardHeader } from "../shared/DashboardHeader";
import { 
  DashboardHeaderSkeleton, 
  KPIGridSkeleton, 
  ChartCardSkeleton,
  SmartListSkeleton 
} from "../shared/ShimmerSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LayoutDashboard, TrendingUp, Users, AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
};

export function OwnerDashboard() {
  const { data, isLoading, error, refetch } = useOwnerDashboard();

  if (isLoading) {
    return <OwnerDashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-96 text-center"
      >
        <div className="p-4 rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Erro ao carregar dashboard</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          Não foi possível carregar os dados. Tente novamente.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Premium Header */}
      <DashboardHeader
        role="owner"
        title="Cockpit Executivo"
        subtitle="Visão estratégica"
      />

      {/* KPI Cards */}
      <motion.div variants={sectionVariants}>
        <OwnerKPICards data={data} />
      </motion.div>

      {/* Tabs for different views */}
      <motion.div variants={sectionVariants}>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
              <LayoutDashboard className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2 data-[state=active]:bg-background">
              <TrendingUp className="h-4 w-4" />
              Receita & Forecast
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              Time & Produtividade
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-background">
              <AlertTriangle className="h-4 w-4" />
              Alertas & Riscos
            </TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL - Strategic Snapshot with UNIQUE charts */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* AI Insights at top */}
            <HumanoidInsights insights={data.humanoidInsights} />
            
            {/* Unique charts grid - Pipeline Snapshot + Win/Loss Ratio + Key Deals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PipelineSnapshotChart data={data.crmHeatmap} />
              <WinLossDonutChart 
                wonCount={data.metrics.wonDealsCount}
                lostCount={data.metrics.lostDealsCount}
                openCount={data.metrics.openDealsCount}
              />
              <KeyDealsSummary 
                enterpriseDeals={data.keyDeals.enterprise}
                closingThisMonth={data.keyDeals.closingThisMonth}
                churnRisk={data.keyDeals.churnRisk}
              />
            </div>
          </TabsContent>

          {/* RECEITA & FORECAST - Financial Analysis */}
          <TabsContent value="revenue" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SalesTrendChart 
                data={data.salesTrend} 
                yearlyGoal={data.revenue.yearlyGoal} 
              />
              <AIForecastChart 
                forecast={data.forecast} 
                yearlyGoal={data.revenue.yearlyGoal} 
              />
            </div>
            
            {/* Revenue Comparison Chart */}
            <RevenueComparisonChart data={data.revenueComparison} />
            
            {/* Ticket by product with proper wrapper */}
            {data.metrics.avgTicketByProduct.length > 0 && (
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ticket Médio por Produto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {data.metrics.avgTicketByProduct.slice(0, 8).map((item, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground truncate" title={item.product}>
                          {item.product}
                        </p>
                        <p className="text-lg font-bold">
                          R${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TIME & PRODUTIVIDADE */}
          <TabsContent value="team" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SellerProductivityChart data={data.sellerProductivity} />
              <CRMHeatmapChart data={data.crmHeatmap} />
            </div>

            {/* Team performance table */}
            {data.sellerProductivity.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl p-4"
              >
                <h3 className="font-semibold mb-4">Ranking de Produtividade (Vendedores)</h3>
                <div className="space-y-2">
                  {data.sellerProductivity.slice(0, 10).map((seller, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold w-6 ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          #{i + 1}
                        </span>
                        <span className="font-medium">{seller.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{seller.deals} deals</span>
                        <span className={seller.winRate >= 50 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {seller.winRate.toFixed(0)}% conversão
                        </span>
                        <span className="font-bold">
                          R${seller.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {data.sellerProductivity.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum vendedor com negócios fechados ainda
                  </p>
                )}
              </motion.div>
            )}
          </TabsContent>

          {/* ALERTAS & RISCOS */}
          <TabsContent value="alerts" className="space-y-4 mt-4">
            <OwnerSmartLists data={data} />
            
            {/* System Errors Card */}
            {data.systemErrors.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Erros de Automação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.systemErrors.map((error, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium capitalize">{error.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{error.count} ocorrências</p>
                      </div>
                      <Badge 
                        variant={error.impact === 'Alto' ? 'destructive' : error.impact === 'Médio' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {error.impact}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

function OwnerDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <DashboardHeaderSkeleton />
      
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
      
      <div className="h-12 rounded-lg bg-muted/30 w-[500px]" />
      
      <SmartListSkeleton />
      
      <div className="grid grid-cols-3 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
