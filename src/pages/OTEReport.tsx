import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OTEOverviewTab } from '@/components/ote/OTEOverviewTab';
import { OTEHistoryTab } from '@/components/ote/OTEHistoryTab';
import { CommissionOverviewTab } from '@/components/results/commission/CommissionOverviewTab';
import { CommissionHistoryTab } from '@/components/results/commission/CommissionHistoryTab';
import { SimpleGoalsOverviewTab } from '@/components/results/simple/SimpleGoalsOverviewTab';
import { SimpleGoalsHistoryTab } from '@/components/results/simple/SimpleGoalsHistoryTab';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, RefreshCw, FileSpreadsheet, Target, Settings, DollarSign, Wallet } from 'lucide-react';
import { useCalculateOTE, useOTEMonthlyResults } from '@/hooks/useOTEData';
import { useOTESalesRecords } from '@/hooks/useOTESalesRecords';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useResultsMode } from '@/hooks/useResultsMode';
import { buildResultsWorkbook, downloadResultsWorkbook } from '@/components/results/export/buildResultsWorkbook';
import { toast } from 'sonner';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/ui/page-header';

export default function OTEReport() {
  const navigate = useNavigate();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth);
  const { organization, isAdmin, loading: isLoadingOrg } = useCurrentOrganization();
  const { mode, copy } = useResultsMode();
  
  const { data: results, isLoading, isPending, refetch } = useOTEMonthlyResults(selectedPeriod);
  const calculateOTE = useCalculateOTE();
  const { profile } = useCurrentUser();
  const resultIds = (results || []).map((r) => r.id);
  const { data: records = [] } = useOTESalesRecords(resultIds);

  const isOTEMode = mode === 'full_ote';
  const isCommissionMode = mode === 'standard_commission';
  const isSimpleMode = mode === 'simple_goals';

  const headerIcon = isOTEMode ? DollarSign : isCommissionMode ? Wallet : Target;
  const badgeIcon = isOTEMode ? Calculator : isCommissionMode ? Wallet : Target;


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

  const handleExportExcel = async () => {
    if (!results || results.length === 0) {
      toast.error('Nenhum dado para exportar. Clique em "Calcular" primeiro.');
      return;
    }
    try {
      const wb = await buildResultsWorkbook({
        mode,
        periodMonth: selectedPeriod,
        organizationId: organization?.id,
        organizationName: organization?.name,
        exporterName: (profile as any)?.full_name,
        results,
        records,
      });
      downloadResultsWorkbook(wb, mode, selectedPeriod, organization?.name);
      toast.success('Relatório exportado.');
    } catch (e) {
      console.error('Results export error:', e);
      toast.error('Erro ao gerar Excel.');
    }
  };

  const loading = isLoading || isLoadingOrg || isPending;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:px-6 md:pt-6 md:pb-4 border-b">
          <PageHeader
            icon={headerIcon}
            title={copy.pageTitle}
            subtitle={copy.pageSubtitle}
            variant="emerald"
            badge={{ label: copy.badgeLabel, icon: badgeIcon }}
            actions={
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
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:px-6">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {isCommissionMode ? (
                <CommissionOverviewTab results={results || []} records={records} isLoading={loading} />
              ) : isSimpleMode ? (
                <SimpleGoalsOverviewTab results={results || []} records={records} isLoading={loading} />
              ) : (
                <OTEOverviewTab
                  results={results || []}
                  records={records}
                  isLoading={loading}
                  period={selectedPeriod}
                  isOTEMode={isOTEMode}
                />
              )}
            </TabsContent>

            <TabsContent value="history">
              {isCommissionMode ? (
                <CommissionHistoryTab />
              ) : isSimpleMode ? (
                <SimpleGoalsHistoryTab />
              ) : (
                <OTEHistoryTab />
              )}
            </TabsContent>

            <TabsContent value="auditoria">
              <VendasRealizadasWrapper />
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </Layout>
  );
}

