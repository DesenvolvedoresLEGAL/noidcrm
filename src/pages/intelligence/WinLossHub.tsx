import { useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useWinLossData, getPipelineTerminology, type TimeframePreset } from '@/hooks/useWinLossData';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import {
  Activity, Swords, Trophy, MessageSquare, DollarSign, Lightbulb,
  AlertTriangle, FileCheck, TrendingDown
} from 'lucide-react';

// Components
import { WinLossContextSelector } from '@/components/intelligence/winloss/WinLossContextSelector';
import { WinLossKPIStrip } from '@/components/intelligence/winloss/WinLossKPIStrip';
import { WinLossOverviewTab } from '@/components/intelligence/winloss/tabs/WinLossOverviewTab';
import { WinLossWinsTab } from '@/components/intelligence/winloss/tabs/WinLossWinsTab';
import { WinLossLossesTab } from '@/components/intelligence/winloss/tabs/WinLossLossesTab';
import { useLossSemantic } from '@/hooks/useLossSemantic';
import { WinLossCompetitiveTab } from '@/components/intelligence/winloss/tabs/WinLossCompetitiveTab';
import { WinLossSellerTab } from '@/components/intelligence/winloss/tabs/WinLossSellerTab';
import { WinLossInterviewsTab } from '@/components/intelligence/winloss/tabs/WinLossInterviewsTab';
import { WinLossRevenueTab } from '@/components/intelligence/winloss/tabs/WinLossRevenueTab';
import { WinLossRecommendationsTab } from '@/components/intelligence/winloss/tabs/WinLossRecommendationsTab';
import { ProposalApprovalsTab } from '@/components/intelligence/winloss/tabs/ProposalApprovalsTab';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';
import { RevenueCommandLegacyBanner } from '@/components/revenue-command/migration/RevenueCommandLegacyBanner';
import { WinLossPeriodProvider, useWinLossPeriod } from '@/contexts/WinLossPeriodContext';

function WinLossHubContent() {
  const { organization } = useCurrentUser();
  const { pipelines } = useOrganizationPipelines();

  // State
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // WL-FILTERS-07 — período/comparação vêm do SSoT temporal (URL).
  const { periodType, range, comparisonRange, isComparing } = useWinLossPeriod();
  const timeframe = periodType as TimeframePreset;

  const dateRange = useMemo(() => ({ from: range.start, to: range.end }), [range.start, range.end]);
  const comparisonDateRange = useMemo(
    () => (comparisonRange ? { from: comparisonRange.start, to: comparisonRange.end } : null),
    [comparisonRange],
  );

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const pipelineType = selectedPipeline?.pipeline_type || 'sales';
  const terminology = getPipelineTerminology(pipelineType);

  // Derive pipelineContext for legacy components
  const pipelineContext: 'qualification' | 'sales' | 'onboarding' =
    pipelineType === 'qualification' ? 'qualification' :
    pipelineType === 'onboarding' || pipelineType === 'renewal' ? 'onboarding' :
    'sales';

  // Data
  const { data: winLossData, isLoading, error: winLossError } = useWinLossData(
    organization?.id,
    selectedPipelineId,
    dateRange
  );

  // Série comparativa — só é buscada quando a comparação está ativa.
  const { data: comparisonData, isLoading: isComparisonLoading } = useWinLossData(
    isComparing ? organization?.id : undefined,
    selectedPipelineId,
    comparisonDateRange ?? dateRange,
  );

  // P0 Revenue SSoT — monetários ganhos vêm de commercial_won_revenue_view.
  // Só aplica quando o usuário restringe explicitamente a um pipeline de vendas.
  const isSalesContext = pipelineType === 'sales' && !!selectedPipelineId;

  const salesPipelineIds = useMemo(
    () => pipelines.filter((p) => p.pipeline_type === 'sales').map((p) => p.id),
    [pipelines],
  );
  const ssotPipelineIds = isSalesContext
    ? (selectedPipelineId ? [selectedPipelineId] : salesPipelineIds.length > 0 ? salesPipelineIds : null)
    : null;
  const { data: ssotWonSummary } = useClosedRevenueSummary({
    surface: 'winloss-hub',
    organizationId: isSalesContext ? organization?.id : undefined,
    start: dateRange.from.toISOString(),
    end: dateRange.to.toISOString(),
    pipelineIds: ssotPipelineIds,
  });

  const { data: ssotWonComparison } = useClosedRevenueSummary({
    surface: 'winloss-hub-comparison',
    organizationId: isSalesContext && isComparing ? organization?.id : undefined,
    start: (comparisonDateRange ?? dateRange).from.toISOString(),
    end: (comparisonDateRange ?? dateRange).to.toISOString(),
    pipelineIds: ssotPipelineIds,
  });

  // Semantic aggregates compartilhados entre Visão Geral e Losses.
  const { data: semantic } = useLossSemantic(organization?.id, selectedPipelineId, dateRange);





  // Log errors for debugging
  if (winLossError) {
    console.error('[WinLossHub] Data loading error:', winLossError);
  }

  // NOTE (Sprint WL-UX-04): Análise efêmera "Analisar com IA" removida da Visão Geral.
  // Toda informação exibida agora é persistente e reproduzível (KPIs, Diagnóstico,
  // Alertas, CRM Trust, Receita Recuperável, Falha Comercial, Drivers, Pulso, Ciclo).
  // Pontos de extensão futuros de IA (sem implementação ainda):
  //   - Aba Recomendações: persistir sugestões via ai_suggestions/optimization_recommendations
  //   - Aba Competitivo: análise persistida por competitor
  //   - Aba Entrevistas: síntese persistida por entrevista
  //   - Aba Vendedores: coaching insights persistidos por seller_id

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        <RevenueCommandLegacyBanner rccTab="Gargalos · Riscos" />
        {/* Header limpo — sem badge PRIME, sem botão de análise efêmera */}
        <PageHeader
          icon={Activity}
          title="Win/Loss Intelligence Hub"
          subtitle="Análise avançada de motivos de ganho e perda — inteligência acionável"
          variant="rose"
        />


        {/* Context Selector (filtros comerciais + período/navegação/comparação) */}
        <WinLossContextSelector
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
        />

        {/* Error Banner */}
        {winLossError && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  Erro ao carregar dados: {winLossError instanceof Error ? winLossError.message : 'Erro desconhecido'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Strip */}
        <WinLossKPIStrip
          data={winLossData}
          isLoading={isLoading}
          terminology={terminology}
          pipelineType={pipelineType}
          ssotOverride={
            ssotWonSummary
              ? {
                  wonCount: ssotWonSummary.count,
                  wonValue: ssotWonSummary.total,
                  avgTicketWon: ssotWonSummary.avgTicket,
                }
              : undefined
          }
          comparison={
            isComparing
              ? {
                  label: comparisonRange?.label ?? '',
                  isLoading: isComparisonLoading,
                  data: comparisonData,
                  ssotOverride: ssotWonComparison
                    ? {
                        wonCount: ssotWonComparison.count,
                        wonValue: ssotWonComparison.total,
                        avgTicketWon: ssotWonComparison.avgTicket,
                      }
                    : undefined,
                }
              : undefined
          }
        />


        {/* Sprint WL-UX-04: banners "AI Insights" e "Insights da IA" removidos. */}


        {/* Tabs — ordem: Visão Geral → Wins → Losses → Competitivo → Vendedores →
            Entrevistas → Revenue Impact → Recomendações → Relatórios */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
            <TabsTrigger value="wins" className="text-xs flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Wins
            </TabsTrigger>
            <TabsTrigger value="losses" className="text-xs flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Losses
            </TabsTrigger>
            <TabsTrigger value="competitive" className="text-xs flex items-center gap-1">
              <Swords className="h-3 w-3" /> Competitivo
            </TabsTrigger>
            <TabsTrigger value="sellers" className="text-xs flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Vendedores
            </TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Entrevistas
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Revenue Impact
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Recomendações
            </TabsTrigger>
            <TabsTrigger value="approvals" className="text-xs flex items-center gap-1">
              <FileCheck className="h-3 w-3" /> Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <WinLossOverviewTab
              data={winLossData}
              isLoading={isLoading}
              organizationId={organization?.id || ''}
              pipelineContext={pipelineContext}
              terminology={terminology}
              timeframe={timeframe}
              dateRange={dateRange}
            />
          </TabsContent>

          <TabsContent value="wins">
            <WinLossWinsTab
              data={winLossData}
              isLoading={isLoading}
              ssotWon={
                ssotWonSummary
                  ? {
                      wonCount: ssotWonSummary.count,
                      wonValue: ssotWonSummary.total,
                      avgTicketWon: ssotWonSummary.avgTicket,
                    }
                  : undefined
              }
            />
          </TabsContent>

          <TabsContent value="losses">
            <WinLossLossesTab
              data={winLossData}
              isLoading={isLoading}
              semantic={semantic}
              timeframe={timeframe}
              dateRange={dateRange}
              organizationId={organization?.id || ''}
            />
          </TabsContent>


          <TabsContent value="competitive">
            <WinLossCompetitiveTab
              data={winLossData}
              isLoading={isLoading}
              organizationId={organization?.id || ''}
              pipelineContext={pipelineContext}
            />
          </TabsContent>

          <TabsContent value="sellers">
            <WinLossSellerTab data={winLossData} isLoading={isLoading} />
          </TabsContent>

          <TabsContent value="interviews">
            {organization?.id && <WinLossInterviewsTab organizationId={organization.id} />}
          </TabsContent>

          <TabsContent value="revenue">
            {organization?.id && <WinLossRevenueTab organizationId={organization.id} />}
          </TabsContent>

          <TabsContent value="recommendations">
            <WinLossRecommendationsTab data={winLossData} />
          </TabsContent>

          <TabsContent value="approvals">
            {organization?.id && (
              <ProposalApprovalsTab
                organizationId={organization.id}
                pipelineId={selectedPipelineId}
                dateRange={dateRange}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
