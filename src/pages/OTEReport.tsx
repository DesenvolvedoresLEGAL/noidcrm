import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTEOverviewTab } from '@/components/ote/OTEOverviewTab';
import { OTESellerDetailTab } from '@/components/ote/OTESellerDetailTab';
import { OTEHistoryTab } from '@/components/ote/OTEHistoryTab';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, RefreshCw, FileSpreadsheet, Target, Settings } from 'lucide-react';
import { useCalculateOTE, useOTEMonthlyResults } from '@/hooks/useOTEData';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OTEReport() {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth);
  const { organization, isAdmin, loading: isLoadingOrg } = useCurrentOrganization();
  
  const { data: results, isLoading, isPending, refetch } = useOTEMonthlyResults(selectedPeriod);
  const calculateOTE = useCalculateOTE();

  const isOTEMode = organization?.goal_system_mode !== 'simple';

  // Generate last 12 months
  const periods = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  const handleCalculate = async () => {
    await calculateOTE.mutateAsync({ periodMonth: selectedPeriod });
    refetch();
  };

  const handleExportExcel = () => {
    // TODO: Implement Excel export
    console.log('Export to Excel');
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:px-6 md:pt-6 md:pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
                {isOTEMode ? (
                  <Calculator className="h-7 w-7 text-primary" />
                ) : (
                  <Target className="h-7 w-7 text-primary" />
                )}
                {isOTEMode ? 'Relatório OTE' : 'Metas e Resultados'}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {isOTEMode 
                  ? 'On Target Earnings - Comissões e Variáveis'
                  : 'Acompanhamento de metas individuais e de time'
                }
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCalculate}
                disabled={calculateOTE.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${calculateOTE.isPending ? 'animate-spin' : ''}`} />
                {calculateOTE.isPending ? 'Calculando...' : 'Calcular'}
              </Button>

              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/app/settings/sales')}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:px-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="sellers">Por Vendedor</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OTEOverviewTab 
                results={results || []} 
                isLoading={isLoading || isLoadingOrg || isPending} 
                period={selectedPeriod}
                isOTEMode={isOTEMode}
              />
            </TabsContent>

            <TabsContent value="sellers">
              <OTESellerDetailTab results={results || []} isLoading={isLoading || isLoadingOrg || isPending} isOTEMode={isOTEMode} />
            </TabsContent>

            <TabsContent value="history">
              <OTEHistoryTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
