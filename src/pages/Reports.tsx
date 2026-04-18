import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { ReportTabs } from '@/components/reports/ReportTabs';
import { CompactFilters } from '@/components/reports/CompactFilters';
import { GeneralOverviewWrapper } from '@/components/reports/wrappers/GeneralOverviewWrapper';
import { ProcessedOpportunities } from '@/components/reports/ProcessedOpportunities';
import { LostReasonsWrapper } from '@/components/reports/wrappers/LostReasonsWrapper';
import { AccumulatedOpportunities } from '@/components/reports/AccumulatedOpportunities';
import { FunnelBalance } from '@/components/reports/FunnelBalance';
import { ConversionRate } from '@/components/reports/ConversionRate';
import { RevenueForecastWrapper } from '@/components/reports/wrappers/RevenueForecastWrapper';
import { SDRPerformanceReport } from '@/components/reports/SDRPerformanceReport';
import { CloserPerformanceWrapper } from '@/components/reports/wrappers/CloserPerformanceWrapper';
import { StageConversionReport } from '@/components/reports/StageConversionReport';
import { HandoffReport } from '@/components/reports/HandoffReport';
import { AIInsightsPanel } from '@/components/reports/AIInsightsPanel';
import { TeamPerformanceWrapper } from '@/components/reports/wrappers/TeamPerformanceWrapper';
import { OriginReport } from '@/components/reports/OriginReport';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { ReportFiltersProvider, useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { PageHeader } from '@/components/ui/page-header';
import { BarChart3, Sparkles } from 'lucide-react';

function ReportsContent() {
  const { pipelines: availablePipelines, loading: loadingPipelines } = useOrganizationPipelines();
  const { users: availableUsers, loading: loadingUsers } = useOrganizationUsers();
  
  const [activeReport, setActiveReport] = useState('general');
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
      case 'general':
        return <GeneralOverviewWrapper />;
      case 'ai-insights':
        return <AIInsightsPanel />;
      case 'processed':
        return <ProcessedOpportunities />;
      case 'lost-reasons':
        return <LostReasonsWrapper />;
      case 'accumulated':
        return <AccumulatedOpportunities />;
      case 'origins':
        return <OriginReport />;
      case 'funnel-balance':
        return <FunnelBalance />;
      case 'conversion-rate':
        return <ConversionRate />;
      case 'stage-conversion':
        return <StageConversionReport />;
      case 'forecast':
        return <RevenueForecastWrapper />;
      case 'sdr-performance':
        return <SDRPerformanceReport />;
      case 'closer-performance':
        return <CloserPerformanceWrapper />;
      case 'team-performance':
        return <TeamPerformanceWrapper />;
      case 'handoff':
        return <HandoffReport />;
      default:
        return <GeneralOverviewWrapper />;
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