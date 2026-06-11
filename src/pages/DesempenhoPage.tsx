import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { CompactFilters } from '@/components/reports/CompactFilters';
import { ReportFiltersProvider, useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { SDRPerformanceWrapper } from '@/components/reports/wrappers/SDRPerformanceWrapper';
import { CloserPerformanceWrapper } from '@/components/reports/wrappers/CloserPerformanceWrapper';
import { HandoffWrapper } from '@/components/reports/wrappers/HandoffWrapper';
import { QualificationQualityReportV2 } from '@/components/reports/qualification/QualificationQualityReportV2';
import { PerformanceOverviewTab } from '@/components/objetivos/desempenho/PerformanceOverviewTab';
import { PerformanceRankingTab } from '@/components/objetivos/desempenho/PerformanceRankingTab';
import { PerformanceSectionShell } from '@/components/objetivos/desempenho/PerformanceSectionShell';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import {
  Trophy, UserCheck, Award, Handshake, CheckCircle2, BarChart3, Sparkles,
} from 'lucide-react';

function DesempenhoContent() {
  const { pipelines: availablePipelines, loading: loadingPipelines } = useOrganizationPipelines();
  const { users: availableUsers, loading: loadingUsers } = useOrganizationUsers();
  const { filters, isGenerating, updateFilters, togglePipeline, generateReport, setFilters } = useReportFiltersContext();
  const [activeTab, setActiveTab] = useState('visao-geral');

  useEffect(() => {
    if (!loadingPipelines && availablePipelines.length > 0 && filters.pipelines.length === 0) {
      setFilters(prev => ({ ...prev, pipelines: availablePipelines.map(p => p.id) }));
    }
  }, [loadingPipelines, availablePipelines, filters.pipelines.length, setFilters]);

  const renderTab = () => {
    switch (activeTab) {
      case 'visao-geral':
        return <PerformanceOverviewTab />;
      case 'sdr':
        return (
          <PerformanceSectionShell
            icon={UserCheck}
            title="Produtividade de pré-vendas"
            description="Leads trabalhados, qualificados, taxa de qualificação e tempo médio por SDR."
            accent="indigo"
          >
            <SDRPerformanceWrapper />
          </PerformanceSectionShell>
        );
      case 'closers':
        return (
          <PerformanceSectionShell
            icon={Award}
            title="Eficiência de fechamento"
            description="Conversão, ciclo médio e produtividade comercial por Closer. Receita, comissão e OTE em Resultados."
            accent="primary"
          >
            <CloserPerformanceWrapper />
          </PerformanceSectionShell>
        );
      case 'handoff':
        return (
          <PerformanceSectionShell
            icon={Handshake}
            title="Passagem de bastão SDR → Closer"
            description="Tempo de primeiro contato, SLA e taxa de aceite das oportunidades qualificadas."
            accent="teal"
          >
            <HandoffWrapper />
          </PerformanceSectionShell>
        );
      case 'qualidade':
        return (
          <PerformanceSectionShell
            icon={CheckCircle2}
            title="Qualidade da qualificação"
            description="SQLs com proposta, ganhos, perdidos e mortos sem proposta. Sinal de qualidade real do pipeline."
            accent="emerald"
          >
            <QualificationQualityReportV2 />
          </PerformanceSectionShell>
        );
      case 'ranking':
        return <PerformanceRankingTab />;
      default:
        return <PerformanceOverviewTab />;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="p-4 md:px-6 md:pt-6 md:pb-4">
          <PageHeader
            icon={BarChart3}
            title="Desempenho"
            subtitle="Performance de pessoas, produtividade comercial e qualidade da operação"
            variant="indigo"
            badge={{ label: 'Performance', icon: Sparkles }}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b bg-card px-4 md:px-6">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger value="visao-geral" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <BarChart3 className="h-4 w-4 mr-2" />Visão Geral
              </TabsTrigger>
              <TabsTrigger value="sdr" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <UserCheck className="h-4 w-4 mr-2" />SDR
              </TabsTrigger>
              <TabsTrigger value="closers" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <Award className="h-4 w-4 mr-2" />Closer
              </TabsTrigger>
              <TabsTrigger value="handoff" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <Handshake className="h-4 w-4 mr-2" />Handoff
              </TabsTrigger>
              <TabsTrigger value="qualidade" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <CheckCircle2 className="h-4 w-4 mr-2" />Qualidade
              </TabsTrigger>
              <TabsTrigger value="ranking" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <Trophy className="h-4 w-4 mr-2" />Ranking
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

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

        <div className="flex-1 overflow-auto p-4 md:px-6 md:py-6">
          <div className="animate-fade-in">{renderTab()}</div>
        </div>
      </div>
    </Layout>
  );
}

export default function DesempenhoPage() {
  return (
    <ReportFiltersProvider>
      <DesempenhoContent />
    </ReportFiltersProvider>
  );
}
