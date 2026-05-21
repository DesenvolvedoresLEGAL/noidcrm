import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { ReportTabs } from '@/components/reports/ReportTabs';
import { CompactFilters } from '@/components/reports/CompactFilters';
import { VendasRealizadasWrapper } from '@/components/reports/wrappers/VendasRealizadasWrapper';
import { GeneralOverviewWrapper } from '@/components/reports/wrappers/GeneralOverviewWrapper';
import { ProcessedOpportunitiesWrapper } from '@/components/reports/wrappers/ProcessedOpportunitiesWrapper';
import { LostReasonsWrapper } from '@/components/reports/wrappers/LostReasonsWrapper';
import { AccumulatedOpportunitiesWrapper } from '@/components/reports/wrappers/AccumulatedOpportunitiesWrapper';
import { FunnelBalanceWrapper } from '@/components/reports/wrappers/FunnelBalanceWrapper';
import { ConversionRateWrapper } from '@/components/reports/wrappers/ConversionRateWrapper';
import { RevenueForecastWrapper } from '@/components/reports/wrappers/RevenueForecastWrapper';
import { SDRPerformanceWrapper } from '@/components/reports/wrappers/SDRPerformanceWrapper';
import { CloserPerformanceWrapper } from '@/components/reports/wrappers/CloserPerformanceWrapper';
import { StageConversionWrapper } from '@/components/reports/wrappers/StageConversionWrapper';
import { HandoffWrapper } from '@/components/reports/wrappers/HandoffWrapper';
import { AIInsightsPanel } from '@/components/reports/AIInsightsPanel';
import { TeamPerformanceWrapper } from '@/components/reports/wrappers/TeamPerformanceWrapper';
import { OriginReportWrapper } from '@/components/reports/wrappers/OriginReportWrapper';
import { EnrichedDecisionMakersWrapper } from '@/components/reports/wrappers/EnrichedDecisionMakersWrapper';
import { ProductsReport } from '@/components/reports/ProductsReport';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { ReportFiltersProvider, useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, Sparkles } from 'lucide-react';

function ReportsContent() {
  const { pipelines: availablePipelines, loading: loadingPipelines } = useOrganizationPipelines();
  const { users: availableUsers, loading: loadingUsers } = useOrganizationUsers();
  
  const [activeReport, setActiveReport] = useState('vendas-realizadas');
  const { filters, isGenerating, updateFilters, togglePipeline, generateReport, setFilters } = useReportFiltersContext();

  // Auto-select all pipelines when loaded
  useEffect(() => {
    if (!loadingPipelines && availablePipelines.length > 0 && filters.pipelines.length === 0) {
      setFilters(prev => ({
        ...prev,
        pipelines: availablePipelines.map(p => p.id)
      }));
    }
  }, [loadingPipelines, availablePipelines, filters.pipelines.length, setFilters]);

  const renderReport = () => {
    switch (activeReport) {
      case 'vendas-realizadas':
        return <VendasRealizadasWrapper />;
      case 'general':
        return <GeneralOverviewWrapper />;
      case 'ai-insights':
        return <AIInsightsPanel />;
      case 'processed':
        return <ProcessedOpportunitiesWrapper />;
      case 'lost-reasons':
        return <LostReasonsWrapper />;
      case 'accumulated':
        return <AccumulatedOpportunitiesWrapper />;
      case 'origins':
        return <OriginReportWrapper />;
      case 'funnel-balance':
        return <FunnelBalanceWrapper />;
      case 'conversion-rate':
        return <ConversionRateWrapper />;
      case 'stage-conversion':
        return <StageConversionWrapper />;
      case 'forecast':
        return <RevenueForecastWrapper />;
      case 'sdr-performance':
        return <SDRPerformanceWrapper />;
      case 'closer-performance':
        return <CloserPerformanceWrapper />;
      case 'team-performance':
        return <TeamPerformanceWrapper />;
      case 'handoff':
        return <HandoffWrapper />;
      case 'enriched-decision-makers':
        return <EnrichedDecisionMakersWrapper />;
      case 'products':
        return <ProductsReport />;
      default:
        return <VendasRealizadasWrapper />;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:px-6 md:pt-6 md:pb-4">
          <PageHeader
            icon={BarChart3}
            title="Dashboard de BI"
            subtitle="Análises inteligentes e métricas de performance em tempo real"
            variant="indigo"
            badge={{ label: 'BI', icon: Sparkles }}
          />
        </div>

        {/* Tabs de navegação */}
        <ReportTabs activeReport={activeReport} onSelectReport={setActiveReport} />

        {/* Filtros compactos */}
        <CompactFilters
          filters={filters}
          availablePipelines={availablePipelines.map(p => ({ id: p.id, name: p.name }))}
          availableUsers={availableUsers}
          onFiltersChange={updateFilters}
          onTogglePipeline={togglePipeline}
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          loading={loadingPipelines || loadingUsers}
        />

        {/* Conteúdo do relatório */}
        <div className="flex-1 overflow-auto p-4 md:px-6 md:py-6">
          <div className="animate-fade-in">
            {renderReport()}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function Reports() {
  return (
    <ReportFiltersProvider>
      <ReportsContent />
    </ReportFiltersProvider>
  );
}