import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportTabs } from '@/components/reports/ReportTabs';
import { CompactFilters } from '@/components/reports/CompactFilters';
import { GeneralOverview } from '@/components/reports/GeneralOverview';
import { ProcessedOpportunities } from '@/components/reports/ProcessedOpportunities';
import { LostReasons } from '@/components/reports/LostReasons';
import { AccumulatedOpportunities } from '@/components/reports/AccumulatedOpportunities';
import { FunnelBalance } from '@/components/reports/FunnelBalance';
import { ConversionRate } from '@/components/reports/ConversionRate';
import { RevenueForecast } from '@/components/reports/RevenueForecast';

export default function Reports() {
  const [activeReport, setActiveReport] = useState('general');
  const [filters, setFilters] = useState({
    pipelines: ['AERO: VENDAS', 'AI: VENDAS', 'ALUGUE: VENDAS', 'ASSINATURA: VENDAS'],
    users: 'all',
    period: 'this-month',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const togglePipeline = (pipeline: string) => {
    setFilters(prev => ({
      ...prev,
      pipelines: prev.pipelines.includes(pipeline)
        ? prev.pipelines.filter(p => p !== pipeline)
        : [...prev.pipelines, pipeline]
    }));
  };

  const renderReport = () => {
    switch (activeReport) {
      case 'general':
        return <GeneralOverview data={null} />;
      case 'processed':
        return <ProcessedOpportunities />;
      case 'lost-reasons':
        return <LostReasons />;
      case 'accumulated':
        return <AccumulatedOpportunities />;
      case 'funnel-balance':
        return <FunnelBalance />;
      case 'conversion-rate':
        return <ConversionRate />;
      case 'forecast':
        return <RevenueForecast />;
      case 'team-performance':
        return (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Este relatório estará disponível em breve.
            </CardContent>
          </Card>
        );
      default:
        return <GeneralOverview data={null} />;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:px-6 md:pt-6 md:pb-4 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">
            Dashboard de BI
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Análises inteligentes e métricas de performance em tempo real
          </p>
        </div>

        {/* Tabs de navegação */}
        <ReportTabs activeReport={activeReport} onSelectReport={setActiveReport} />

        {/* Filtros compactos */}
        <CompactFilters
          filters={filters}
          onFiltersChange={setFilters}
          onTogglePipeline={togglePipeline}
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
