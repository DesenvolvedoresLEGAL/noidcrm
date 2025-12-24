import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { BarChart3, Users, Search, Sparkles, AlertTriangle, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export default function Forecast() {
  const defaultFilters = useDefaultFilters();
  const [filters, setFilters] = useState<FilterType>(defaultFilters);
  
  const { kpis, scenarios, opportunities, sellerForecasts, isLoading, refetch } = useForecastData(filters);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <PageHeader
          icon={TrendingUp}
          title="Forecast de Vendas"
          subtitle="Previsão de receita e análise de pipeline para RevOps"
          variant="teal"
          badge={{ label: 'AI', icon: Sparkles }}
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
              <ForecastDataQuality opportunities={opportunities} goal={kpis?.goal || 0} />
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
