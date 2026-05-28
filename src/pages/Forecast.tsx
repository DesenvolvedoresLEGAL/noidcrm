import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ForecastFilters } from '@/components/forecast/ForecastFilters';
import { ForecastKPICards } from '@/components/forecast/ForecastKPICards';
import { ForecastScenariosCard } from '@/components/forecast/ForecastScenariosCard';
import { ForecastWaterfallChart } from '@/components/forecast/ForecastWaterfallChart';
import { ForecastDataQuality } from '@/components/forecast/ForecastDataQuality';
import { SellerForecastTable } from '@/components/forecast/SellerForecastTable';
import { SellerPerformanceSection } from '@/components/forecast/seller-performance/SellerPerformanceSection';
import { DealInspectionTable } from '@/components/forecast/DealInspectionTable';
import { ForecastRisksPanel } from '@/components/forecast/ForecastRisksPanel';
import { ForecastRiskCenterPanel } from '@/components/forecast/risk-center/ForecastRiskCenterPanel';
import { ForecastV2HealthPanel } from '@/components/forecast/health/ForecastV2HealthPanel';
import { useUserRole } from '@/hooks/useUserRole';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { AIForecastInsightsPanel } from '@/components/forecast/AIForecastInsightsPanel';
import { ForecastIntelligencePanel } from '@/components/forecast/ForecastIntelligencePanel';
import { AccuracyDashboard } from '@/components/forecast/AccuracyDashboard';
import { useForecastData, useDefaultFilters, ForecastFilters as FilterType } from '@/hooks/useForecastData';
import { useForecastSalesPipeline } from '@/hooks/forecast/useForecastSalesPipeline';
import { BarChart3, Users, Search, Sparkles, AlertTriangle, ShieldCheck, Target, TrendingUp, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RevenueSsotBanner } from '@/components/revenue/RevenueSsotBanner';

export default function Forecast() {
  const defaultFilters = useDefaultFilters();
  const [filters, setFilters] = useState<FilterType>(defaultFilters);
  const { isAdmin, isManager } = useUserRole();
  const { isOwner, organization } = useCurrentOrganization();
  const { isPlatformAdmin } = usePlatformAdmin();
  const showHealth = isAdmin || isManager || isOwner || isPlatformAdmin;

  // Sprint F2.10 — Forecast V2 é exclusivo do pipeline oficial de vendas
  const {
    salesPipelineId,
    salesPipelineName,
    pipelineFound,
    requiresConfiguration,
    isLoading: salesPipelineLoading,
  } = useForecastSalesPipeline({ organizationId: organization?.id ?? null });

  // Trava filters.pipelineId no pipeline oficial assim que resolvido
  useEffect(() => {
    if (salesPipelineId && filters.pipelineId !== salesPipelineId) {
      setFilters((prev) => ({ ...prev, pipelineId: salesPipelineId }));
    }
  }, [salesPipelineId, filters.pipelineId]);

  const effectiveFilters: FilterType = useMemo(
    () => ({ ...filters, pipelineId: salesPipelineId ?? filters.pipelineId }),
    [filters, salesPipelineId],
  );

  const { kpis, scenarios, opportunities, sellerForecasts, isLoading, isFetching, dataUpdatedAt, refetch } =
    useForecastData(effectiveFilters);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <PageHeader
          icon={TrendingUp}
          title="Forecast de Vendas"
          subtitle="Previsão de receita e análise de pipeline para RevOps"
          variant="teal"
          badge={{ label: 'AI', icon: Sparkles }}
          actions={
            kpis && kpis.nrhsAverage !== undefined && kpis.nrhsAverage > 0 ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 border',
                      kpis.nrhsConfidence === 'high' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                      kpis.nrhsConfidence === 'moderate' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                      kpis.nrhsConfidence === 'low' ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' :
                      'bg-red-500/10 text-red-500 border-red-500/30'
                    )}>
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        Confiança: {kpis.nrhsAverage.toFixed(0)}%
                      </span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Forecast Confidence Index</p>
                    <p className="text-xs text-muted-foreground">
                      Baseado na higiene operacional (NRHS) dos deals incluídos no forecast.
                      {kpis.excludedByNrhsCount > 0 && (
                        <span className="block mt-1 text-red-400">
                          {kpis.excludedByNrhsCount} deals excluídos por NRHS baixo.
                        </span>
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : undefined
          }
        />

        {/* Filters */}
        <ForecastFilters
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refetch}
          isLoading={isLoading}
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
        />

        <RevenueSsotBanner variant="migrated" surface="Forecast — Receita Fechada via commercial_won_revenue_view" />

        {/* KPI Cards */}
        <ForecastKPICards kpis={kpis} isLoading={isLoading} />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <TabsList className={cn(
              'inline-flex w-max md:w-auto md:grid gap-1 p-1 min-w-max',
              showHealth ? 'md:grid-cols-8' : 'md:grid-cols-7'
            )}>
              <TabsTrigger value="overview" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Geral</span>
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Qualidade</span>
              </TabsTrigger>
              <TabsTrigger value="accuracy" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <Target className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Acurácia</span>
              </TabsTrigger>
              <TabsTrigger value="sellers" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Vendedor</span>
              </TabsTrigger>
              <TabsTrigger value="deals" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <Search className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Deals</span>
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>AI</span>
              </TabsTrigger>
              <TabsTrigger value="risks" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span>Riscos</span>
              </TabsTrigger>
              {showHealth && (
                <TabsTrigger value="health" className="gap-1.5 px-3 py-2 text-xs md:text-sm whitespace-nowrap">
                  <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span>Saúde V2</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {kpis && <ForecastWaterfallChart kpis={kpis} />}
              <ForecastScenariosCard 
                scenarios={scenarios} 
                goal={kpis?.goal || 0} 
                opportunities={opportunities}
                closedRevenue={kpis?.closedRevenue || 0}
              />
            </div>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <ForecastDataQuality opportunities={opportunities} goal={kpis?.goal || 0} kpis={kpis} />
              <ForecastScenariosCard 
                scenarios={scenarios} 
                goal={kpis?.goal || 0}
                opportunities={opportunities}
                closedRevenue={kpis?.closedRevenue || 0}
              />
            </div>
          </TabsContent>

          {/* Accuracy Tab */}
          <TabsContent value="accuracy" className="mt-6">
            <AccuracyDashboard pipelineId={filters.pipelineId} userId={filters.userId} />
          </TabsContent>

          {/* Sellers Tab */}
          <TabsContent value="sellers" className="mt-6">
            <SellerPerformanceSection
              periodStart={filters.periodStart}
              periodEnd={filters.periodEnd}
              pipelineId={filters.pipelineId}
              legacySellers={sellerForecasts}
            />
          </TabsContent>

          {/* Deal Inspection Tab */}
          <TabsContent value="deals" className="mt-6">
            <DealInspectionTable opportunities={opportunities} filterCategory="all" />
          </TabsContent>

          {/* AI Insights Tab — F2.6 HUMANOID Forecast Intelligence */}
          <TabsContent value="insights" className="mt-6 space-y-6">
            <ForecastIntelligencePanel
              periodStart={filters.periodStart}
              periodEnd={filters.periodEnd}
              pipelineId={filters.pipelineId}
              sellerId={filters.userId ?? null}
            />
            {kpis && (
              <details className="border rounded-md p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Ver insights legados (heurísticas locais)</summary>
                <div className="mt-3">
                  <AIForecastInsightsPanel kpis={kpis} opportunities={opportunities} pipelineId={filters.pipelineId} />
                </div>
              </details>
            )}
          </TabsContent>

          {/* Risks Tab — F2.7 Risk Center */}
          <TabsContent value="risks" className="mt-6">
            <ForecastRiskCenterPanel
              periodStart={filters.periodStart}
              periodEnd={filters.periodEnd}
              pipelineId={filters.pipelineId}
              sellerId={filters.userId ?? null}
              opportunitiesFallback={opportunities}
            />
          </TabsContent>

          {/* Health Tab — F2.8 Saúde V2 (admin/manager) */}
          {showHealth && (
            <TabsContent value="health" className="mt-6">
              <ForecastV2HealthPanel
                periodStart={filters.periodStart}
                periodEnd={filters.periodEnd}
                pipelineId={filters.pipelineId}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
