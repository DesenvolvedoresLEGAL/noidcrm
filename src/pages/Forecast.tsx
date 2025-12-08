import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForecastFilters } from '@/components/forecast/ForecastFilters';
import { ForecastKPICards } from '@/components/forecast/ForecastKPICards';
import { ForecastScenariosCard } from '@/components/forecast/ForecastScenariosCard';
import { ForecastWaterfallChart } from '@/components/forecast/ForecastWaterfallChart';
import { SellerForecastTable } from '@/components/forecast/SellerForecastTable';
import { DealInspectionTable } from '@/components/forecast/DealInspectionTable';
import { ForecastRisksPanel } from '@/components/forecast/ForecastRisksPanel';
import { AIForecastInsightsPanel } from '@/components/forecast/AIForecastInsightsPanel';
import { useForecastData, useDefaultFilters, ForecastFilters as FilterType } from '@/hooks/useForecastData';
import { BarChart3, Users, Search, Sparkles, AlertTriangle } from 'lucide-react';

export default function Forecast() {
  const defaultFilters = useDefaultFilters();
  const [filters, setFilters] = useState<FilterType>(defaultFilters);
  
  const { kpis, scenarios, opportunities, sellerForecasts, isLoading, refetch } = useForecastData(filters);

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Forecast de Vendas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Previsão de receita e análise de pipeline para RevOps
          </p>
        </div>

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
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4 hidden sm:inline" />
              Visão Geral
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
              <ForecastScenariosCard scenarios={scenarios} goal={kpis?.goal || 0} />
            </div>
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
