import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { CompactFilters } from '@/components/reports/CompactFilters';
import { ReportFiltersProvider, useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { TeamPerformanceWrapper } from '@/components/reports/wrappers/TeamPerformanceWrapper';
import { SDRPerformanceWrapper } from '@/components/reports/wrappers/SDRPerformanceWrapper';
import { CloserPerformanceWrapper } from '@/components/reports/wrappers/CloserPerformanceWrapper';
import { HandoffWrapper } from '@/components/reports/wrappers/HandoffWrapper';
import { QualificationQualityReportV2 } from '@/components/reports/qualification/QualificationQualityReportV2';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { Trophy, Users, UserCheck, Award, Handshake, CheckCircle2, BarChart3, Sparkles } from 'lucide-react';

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
      case 'visao-geral': return <TeamPerformanceWrapper />;
      case 'sdr': return <SDRPerformanceWrapper />;
      case 'closers': return <CloserPerformanceWrapper />;
      case 'handoff': return <HandoffWrapper />;
      case 'qualidade': return <QualificationQualityReportV2 />;
      case 'ranking':
        return (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground">Ranking consolidado</p>
              <p className="text-sm mt-1">Tabela unificada SDR + Closers em breve.</p>
            </CardContent>
          </Card>
        );
      default: return <TeamPerformanceWrapper />;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="p-4 md:px-6 md:pt-6 md:pb-4">
          <PageHeader
            icon={BarChart3}
            title="Desempenho"
            subtitle="Performance comercial, produtividade individual e qualidade operacional"
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
                <Award className="h-4 w-4 mr-2" />Closers
              </TabsTrigger>
              <TabsTrigger value="handoff" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <Handshake className="h-4 w-4 mr-2" />Handoff
              </TabsTrigger>
              <TabsTrigger value="qualidade" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                <CheckCircle2 className="h-4 w-4 mr-2" />Qualidade Qualif.
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
