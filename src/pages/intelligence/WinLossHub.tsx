import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useWinLossData, getDateRangeFromPreset, getPipelineTerminology, type TimeframePreset } from '@/hooks/useWinLossData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import {
  Sparkles, RefreshCw,
  Activity, Swords, Trophy, MessageSquare, DollarSign, Lightbulb,
  AlertTriangle, Target, Zap, ArrowRight, FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Components
import { WinLossContextSelector } from '@/components/intelligence/winloss/WinLossContextSelector';
import { WinLossKPIStrip } from '@/components/intelligence/winloss/WinLossKPIStrip';
import { WinLossOverviewTab } from '@/components/intelligence/winloss/tabs/WinLossOverviewTab';
import { WinLossCompetitiveTab } from '@/components/intelligence/winloss/tabs/WinLossCompetitiveTab';
import { WinLossSellerTab } from '@/components/intelligence/winloss/tabs/WinLossSellerTab';
import { WinLossInterviewsTab } from '@/components/intelligence/winloss/tabs/WinLossInterviewsTab';
import { WinLossRevenueTab } from '@/components/intelligence/winloss/tabs/WinLossRevenueTab';
import { WinLossRecommendationsTab } from '@/components/intelligence/winloss/tabs/WinLossRecommendationsTab';
import { ProposalApprovalsTab } from '@/components/intelligence/winloss/tabs/ProposalApprovalsTab';
import { useClosedRevenueSummary } from '@/hooks/revenue/useRevenueSsot';

export default function WinLossHub() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const { pipelines } = useOrganizationPipelines();

  // State
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframePreset>('year');
  const [aiInsights, setAiInsights] = useState<any>(null);

  // Derived — stabilize dateRange so it doesn't change on every render
  const dateRange = useMemo(() => getDateRangeFromPreset(timeframe), [timeframe]);
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




  // P0 Revenue SSoT — monetários ganhos vêm de commercial_won_revenue_view.
  // ⚠️ Só aplica em pipelines de VENDAS. Pré-Vendas (qualification) não gera receita
  // comercial (não há proposta aceita), então o SSoT retornaria zero e mascararia
  // os Leads Qualificados/Desqualificados reais do useWinLossData.
  // "Todos" = pipelines comerciais de vendas; caso contrário restringe ao pipeline escolhido.
  // Só aplica quando o usuário restringe explicitamente a um pipeline de vendas.
  // No modo "Todos (Pré-Vendas + Vendas)" o dataset mistura qualification, e o SSoT
  // (que cobre apenas vendas) divergiria do useWinLossData → inconsistência de KPIs.
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


  // Log errors for debugging
  if (winLossError) {
    console.error('[WinLossHub] Data loading error:', winLossError);
  }

  // AI Analysis
  const analyzeWinLossMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      const { data, error } = await supabase.functions.invoke('analyze-winloss-batch', {
        body: { organizationId: organization.id, dateRange: 'year' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setAiInsights(data);
      toast({ title: 'Análise concluída', description: `${data.insights?.length || 0} insights gerados` });
    },
    onError: (error) => {
      toast({ title: 'Erro na análise', description: error instanceof Error ? error.message : 'Erro', variant: 'destructive' });
    },
  });

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header limpo — sem badge PRIME, sem banners SSoT */}
        <PageHeader
          icon={Activity}
          title="Win/Loss Intelligence Hub"
          subtitle="Análise avançada de motivos de ganho e perda — inteligência acionável"
          variant="rose"
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => analyzeWinLossMutation.mutate()}
                disabled={analyzeWinLossMutation.isPending}
              >
                {analyzeWinLossMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analisar com IA
              </Button>
            </div>
          }
        />

        {/* Context Selector (filtros comerciais + período expandido) */}
        <WinLossContextSelector
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
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
        />

        {/* AI Insights Banner */}
        {aiInsights && (aiInsights.topStrength || aiInsights.topWeakness || aiInsights.competitiveStrategy) && (
          <div className="grid md:grid-cols-3 gap-3">
            {aiInsights.topStrength && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">Principal Força</p>
                      <p className="text-xs mt-0.5">{aiInsights.topStrength}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {aiInsights.topWeakness && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium text-red-600 uppercase tracking-wider">Principal Fraqueza</p>
                      <p className="text-xs mt-0.5">{aiInsights.topWeakness}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {aiInsights.competitiveStrategy && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">Estratégia Competitiva</p>
                      <p className="text-xs mt-0.5">{aiInsights.competitiveStrategy}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* AI Insights Detail */}
        {aiInsights?.insights?.length > 0 && (
          <Card className="border-purple-500/20">
            <CardContent className="pt-4 pb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Insights da IA
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {aiInsights.insights.map((insight: any, i: number) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    insight.impact === 'high' ? 'border-red-500/30 bg-red-500/5' :
                    insight.impact === 'medium' ? 'border-yellow-500/30 bg-yellow-500/5' :
                    'border-blue-500/30 bg-blue-500/5'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-xs">{insight.title}</h4>
                      {insight.category && (
                        <Badge variant="outline" className={`text-[10px] ${
                          insight.category === 'win' ? 'border-emerald-500/30 text-emerald-600' :
                          insight.category === 'loss' ? 'border-red-500/30 text-red-600' : ''
                        }`}>
                          {insight.category === 'win' ? 'WIN' : insight.category === 'loss' ? 'LOSS' : 'GERAL'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                ))}
              </div>
              {aiInsights.actionItems?.length > 0 && (
                <div className="pt-3 mt-3 border-t">
                  <h4 className="font-semibold text-xs mb-2 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Ações Recomendadas
                  </h4>
                  <div className="space-y-1">
                    {aiInsights.actionItems.map((action: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
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
            <TabsTrigger value="approvals" className="text-xs flex items-center gap-1">
              <FileCheck className="h-3 w-3" /> Relatório
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Recomendações
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

          <TabsContent value="approvals">
            {organization?.id && (
              <ProposalApprovalsTab
                organizationId={organization.id}
                pipelineId={selectedPipelineId}
                dateRange={dateRange}
              />
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            <WinLossRecommendationsTab data={winLossData} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
