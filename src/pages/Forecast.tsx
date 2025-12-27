import { useState } from 'react';
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
import { DealInspectionTable } from '@/components/forecast/DealInspectionTable';
import { ForecastRisksPanel } from '@/components/forecast/ForecastRisksPanel';
import { AIForecastInsightsPanel } from '@/components/forecast/AIForecastInsightsPanel';
import { AccuracyDashboard } from '@/components/forecast/AccuracyDashboard';
import { useForecastData, useDefaultFilters, ForecastFilters as FilterType } from '@/hooks/useForecastData';
import { BarChart3, Users, Search, Sparkles, AlertTriangle, ShieldCheck, Target, TrendingUp, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

export default function Forecast() {
  const defaultFilters = useDefaultFilters();
  const [filters, setFilters] = useState<FilterType>(defaultFilters);
  
  const { kpis, scenarios, opportunities, sellerForecasts, isLoading, refetch } = useForecastData(filters);

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
        />

        {/* KPI Cards */}
        <ForecastKPICards kpis={kpis} isLoading={isLoading} />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4 hidden sm:inline" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-2">
              <ShieldCheck className="h-4 w-4 hidden sm:inline" />
              Qualidade
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="gap-2">
              <Target className="h-4 w-4 hidden sm:inline" />
              Acurácia
            </TabsTrigger>
            <TabsTrigger value="sellers" className="gap-2">
              <Users className="h-4 w-4 hidden sm:inline" />
              Por Vendedor
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-2">
              <Search className="h-4 w-4 hidden sm:inline" />
              Deal Inspection
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Sparkles className="h-4 w-4 hidden sm:inline" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="risks" className="gap-2">
              <AlertTriangle className="h-4 w-4 hidden sm:inline" />
              Riscos
            </TabsTrigger>
          </TabsList>

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
            <SellerForecastTable sellers={sellerForecasts} />
          </TabsContent>

          {/* Deal Inspection Tab */}
          <TabsContent value="deals" className="mt-6">
            <DealInspectionTable opportunities={opportunities} filterCategory="all" />
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="mt-6">
            {kpis && (
              <AIForecastInsightsPanel kpis={kpis} opportunities={opportunities} />
            )}
          </TabsContent>

          {/* Risks Tab */}
          <TabsContent value="risks" className="mt-6">
            <ForecastRisksPanel opportunities={opportunities} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
