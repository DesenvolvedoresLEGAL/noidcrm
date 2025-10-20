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
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { ReportSidebar } from '@/components/reports/ReportSidebar';
import { GeneralOverview } from '@/components/reports/GeneralOverview';
import { ProcessedOpportunities } from '@/components/reports/ProcessedOpportunities';
import { LostReasons } from '@/components/reports/LostReasons';
import { AccumulatedOpportunities } from '@/components/reports/AccumulatedOpportunities';
import { FunnelBalance } from '@/components/reports/FunnelBalance';
import { ConversionRate } from '@/components/reports/ConversionRate';

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
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <ReportSidebar activeReport={activeReport} onSelectReport={setActiveReport} />

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
              <h1 className="text-2xl md:text-3xl font-black text-foreground">
                Dashboard de BI
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Análises inteligentes e métricas de performance em tempo real
              </p>
            </div>

            {/* Filtros globais */}
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-6">
                  <Filter className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Filtros</h3>
                </div>

                <div className="space-y-4">
                  {/* Funil */}
                  <div className="space-y-2">
                    <Label>Funil</Label>
                    <div className="flex flex-wrap gap-2">
                      {['AERO: VENDAS', 'AI: VENDAS', 'ALUGUE: VENDAS', 'ASSINATURA: VENDAS'].map(pipeline => (
                        <Badge
                          key={pipeline}
                          variant={filters.pipelines.includes(pipeline) ? "default" : "outline"}
                          className="cursor-pointer hover:opacity-80"
                          onClick={() => togglePipeline(pipeline)}
                        >
                          {pipeline}
                          {filters.pipelines.includes(pipeline) && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Grid de filtros */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="users">Usuários</Label>
                      <Select
                        value={filters.users}
                        onValueChange={(value) =>
                          setFilters({ ...filters, users: value })
                        }
                      >
                        <SelectTrigger id="users">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Usuário, grupo de equipe ou equipe</SelectItem>
                          <SelectItem value="team-1">Equipe 1</SelectItem>
                          <SelectItem value="team-2">Equipe 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="period">Período</Label>
                      <Select
                        value={filters.period}
                        onValueChange={(value) =>
                          setFilters({ ...filters, period: value })
                        }
                      >
                        <SelectTrigger id="period">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Hoje</SelectItem>
                          <SelectItem value="yesterday">Ontem</SelectItem>
                          <SelectItem value="this-week">Esta semana</SelectItem>
                          <SelectItem value="last-week">Semana passada</SelectItem>
                          <SelectItem value="this-month">Este mês</SelectItem>
                          <SelectItem value="last-month">Mês passado</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button className="w-full">
                        Gerar relatório
                      </Button>
                    </div>
                  </div>

                  {/* Datas personalizadas */}
                  {filters.period === 'custom' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Data Inicial</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={filters.startDate}
                          onChange={(e) =>
                            setFilters({ ...filters, startDate: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="endDate">Data Final</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={filters.endDate}
                          onChange={(e) =>
                            setFilters({ ...filters, endDate: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info do período filtrado */}
                <div className="mt-4 text-sm text-muted-foreground">
                  Período filtrado: 01/10/2025 até 31/10/2025 • 
                  Período comparativo: 01/09/2025 até 30/09/2025
                </div>
              </CardContent>
            </Card>

            {/* Conteúdo do relatório */}
            <div className="animate-fade-in">
              {renderReport()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
