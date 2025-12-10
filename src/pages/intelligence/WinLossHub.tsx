import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Target,
  Users,
  DollarSign,
  BarChart3,
  PieChart,
  Sparkles,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Mail,
  Phone,
  Calculator,
  Send,
  ArrowRight,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function WinLossHub() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [revenueSimulation, setRevenueSimulation] = useState<any>(null);

  // Win/Loss data - with fallback to opportunities table and pipeline_type='sales' filter
  const { data: winLossData, isLoading } = useQuery({
    queryKey: ['winloss-data', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      
      // First, get sales pipelines (pipeline_type='sales')
      const { data: salesPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('pipeline_type', 'sales');
      
      const salesPipelineIds = salesPipelines?.map(p => p.id) || [];
      
      // Fetch win_loss_records
      const { data: records } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            valor_previsto,
            pipeline_id,
            account:accounts(segmento, porte)
          ),
          reason:loss_reasons(name)
        `)
        .eq('organization_id', organization.id)
        .gte('created_at', startOfYear)
        .order('created_at', { ascending: false });
      
      // Filter records by sales pipelines
      const filteredRecords = records?.filter(r => 
        salesPipelineIds.includes((r.opportunity as any)?.pipeline_id)
      ) || [];
      
      // FALLBACK: Also fetch directly from opportunities with status won/lost
      // This ensures we capture opportunities that don't have win_loss_records yet
      const { data: directOpportunities } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          valor_previsto,
          status,
          pipeline_id,
          created_at,
          updated_at,
          loss_reason_id,
          loss_comment,
          account:accounts(segmento, porte),
          loss_reason:loss_reasons(name)
        `)
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost'])
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['no-pipelines'])
        .gte('created_at', startOfYear);
      
      // Merge: use opportunities as source of truth, enrich with win_loss_records data
      const recordsByOppId = new Map(filteredRecords.map(r => [r.opportunity_id, r]));
      
      const allDeals = (directOpportunities || []).map(opp => {
        const record = recordsByOppId.get(opp.id);
        const createdAt = new Date(opp.created_at);
        const closedAt = new Date(opp.updated_at);
        const salesCycleDays = Math.floor((closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: record?.id || opp.id,
          opportunity_id: opp.id,
          outcome: opp.status as 'won' | 'lost',
          final_value: record?.final_value || opp.valor_previsto || 0,
          sales_cycle_days: record?.sales_cycle_days || salesCycleDays,
          reason_seller: record?.reason_seller || opp.loss_comment,
          competitor: record?.competitor,
          price_factor: record?.price_factor || false,
          timing_factor: record?.timing_factor || false,
          feature_factor: record?.feature_factor || false,
          relationship_factor: record?.relationship_factor || false,
          opportunity: opp,
          reason: opp.loss_reason,
        };
      });
      
      const wins = allDeals.filter(d => d.outcome === 'won');
      const losses = allDeals.filter(d => d.outcome === 'lost');
      
      const lossReasonCounts: Record<string, number> = {};
      losses.forEach(l => {
        const reason = l.reason_seller || (l.reason as any)?.name || 'Não informado';
        lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
      });
      
      const competitorCounts: Record<string, number> = {};
      losses.filter(l => l.competitor).forEach(l => {
        competitorCounts[l.competitor!] = (competitorCounts[l.competitor!] || 0) + 1;
      });
      
      const factors = {
        price: losses.filter(l => l.price_factor).length,
        timing: losses.filter(l => l.timing_factor).length,
        feature: losses.filter(l => l.feature_factor).length,
        relationship: losses.filter(l => l.relationship_factor).length
      };
      
      const wonValue = wins.reduce((sum, w) => sum + (w.final_value || 0), 0);
      const lostValue = losses.reduce((sum, l) => sum + (l.final_value || 0), 0);
      
      const avgCycleWon = wins.length > 0
        ? Math.round(wins.reduce((sum, w) => sum + (w.sales_cycle_days || 0), 0) / wins.length)
        : 0;
      const avgCycleLost = losses.length > 0
        ? Math.round(losses.reduce((sum, l) => sum + (l.sales_cycle_days || 0), 0) / losses.length)
        : 0;
      
      return {
        wins,
        losses,
        wonCount: wins.length,
        lostCount: losses.length,
        winRate: wins.length + losses.length > 0 
          ? Math.round(wins.length / (wins.length + losses.length) * 100)
          : 0,
        wonValue,
        lostValue,
        lossReasons: Object.entries(lossReasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        competitors: Object.entries(competitorCounts)
          .map(([competitor, count]) => ({ competitor, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        factors,
        avgCycleWon,
        avgCycleLost
      };
    },
    enabled: !!organization?.id
  });

  // Interviews data
  const { data: interviewsData, refetch: refetchInterviews } = useQuery({
    queryKey: ['winloss-interviews', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data, error } = await supabase
        .from('winloss_interviews')
        .select(`
          *,
          account:accounts(razao_social, nome_fantasia),
          contact:contacts(nome)
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      const pending = data?.filter(i => i.status === 'pending').length || 0;
      const sent = data?.filter(i => i.status === 'sent').length || 0;
      const completed = data?.filter(i => i.status === 'completed').length || 0;
      
      return { interviews: data || [], pending, sent, completed };
    },
    enabled: !!organization?.id
  });

  // AI Analysis mutation
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
      toast({
        title: 'Análise concluída',
        description: `${data.insights?.length || 0} insights gerados`
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro na análise',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  // Revenue Impact simulation
  const simulateRevenueMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('calculate-revenue-impact', {
        body: { organizationId: organization.id, period: 'year' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRevenueSimulation(data.simulation);
      toast({
        title: 'Simulação concluída',
        description: 'Impacto em receita calculado com sucesso'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro na simulação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  // Create interview mutation
  const createInterviewMutation = useMutation({
    mutationFn: async (params: { interviewType: 'win' | 'loss' | 'churn'; channel: string }) => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('winloss-interview-bot', {
        body: { 
          organizationId: organization.id,
          interviewType: params.interviewType,
          channel: params.channel
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchInterviews();
      toast({
        title: 'Entrevista criada',
        description: 'A entrevista foi agendada com sucesso'
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar entrevista',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const totalFactors = winLossData 
    ? winLossData.factors.price + winLossData.factors.timing + winLossData.factors.feature + winLossData.factors.relationship
    : 0;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <BarChart3 className="h-4 w-4" />;
      case 'recommendation': return <Lightbulb className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getInsightColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'border-red-500/30 bg-red-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-blue-500/30 bg-blue-500/5';
    }
  };

  return (
    <Layout>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Win/Loss Insight Hub</h1>
          <p className="text-muted-foreground">
            Análise avançada de motivos de ganho e perda com IA
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => simulateRevenueMutation.mutate()}
            disabled={simulateRevenueMutation.isPending}
          >
            {simulateRevenueMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Simular Impacto
          </Button>
          <Button
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
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals Ganhos</p>
                <p className="text-2xl font-bold text-emerald-500">{winLossData?.wonCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals Perdidos</p>
                <p className="text-2xl font-bold text-red-500">{winLossData?.lostCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{winLossData?.winRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Perdido</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(winLossData?.lostValue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="interviews">Entrevistas</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Impact</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Motivos de Perda */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-red-500" />
                  Top Motivos de Perda
                </CardTitle>
                <CardDescription>Principais razões mencionadas pelos vendedores</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : winLossData?.lossReasons && winLossData.lossReasons.length > 0 ? (
                  <div className="space-y-4">
                    {winLossData.lossReasons.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.reason}</span>
                          <Badge variant="secondary">{item.count}</Badge>
                        </div>
                        <Progress 
                          value={(item.count / (winLossData.lossReasons[0]?.count || 1)) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum dado de perda registrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Concorrentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  Perdas por Concorrente
                </CardTitle>
                <CardDescription>Concorrentes mais frequentes em perdas</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : winLossData?.competitors && winLossData.competitors.length > 0 ? (
                  <div className="space-y-4">
                    {winLossData.competitors.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.competitor}</span>
                          <Badge variant="secondary">{item.count} perdas</Badge>
                        </div>
                        <Progress 
                          value={(item.count / (winLossData.competitors[0]?.count || 1)) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum concorrente registrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fatores de Decisão */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-purple-500" />
                  Fatores de Decisão (Perdas)
                </CardTitle>
                <CardDescription>O que influenciou as perdas</CardDescription>
              </CardHeader>
              <CardContent>
                {winLossData?.factors && totalFactors > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <DollarSign className="h-8 w-8 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold">{winLossData.factors.price}</p>
                      <p className="text-sm text-muted-foreground">Preço</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <Target className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                      <p className="text-2xl font-bold">{winLossData.factors.timing}</p>
                      <p className="text-sm text-muted-foreground">Timing</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <BarChart3 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">{winLossData.factors.feature}</p>
                      <p className="text-sm text-muted-foreground">Features</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <Users className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                      <p className="text-2xl font-bold">{winLossData.factors.relationship}</p>
                      <p className="text-sm text-muted-foreground">Relacionamento</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum fator de decisão registrado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ciclo de Venda */}
            <Card>
              <CardHeader>
                <CardTitle>Ciclo de Venda Médio</CardTitle>
                <CardDescription>Comparação entre ganhos e perdas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <TrendingUp className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                    <p className="text-3xl font-bold text-emerald-500">{winLossData?.avgCycleWon || 0}</p>
                    <p className="text-sm text-muted-foreground">dias (ganhos)</p>
                  </div>
                  <div className="text-center p-6 rounded-lg bg-red-500/5 border border-red-500/20">
                    <TrendingDown className="h-10 w-10 mx-auto text-red-500 mb-3" />
                    <p className="text-3xl font-bold text-red-500">{winLossData?.avgCycleLost || 0}</p>
                    <p className="text-sm text-muted-foreground">dias (perdas)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          {aiInsights && aiInsights.insights && aiInsights.insights.length > 0 && (
            <Card className="border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-500">
                  <Sparkles className="h-5 w-5" />
                  Insights da IA
                </CardTitle>
                {aiInsights.summary && (
                  <CardDescription>{aiInsights.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {aiInsights.insights.map((insight: any, index: number) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg border ${getInsightColor(insight.impact)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                          {insight.metric && (
                            <Badge variant="secondary" className="mt-2">{insight.metric}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Interviews Tab */}
        <TabsContent value="interviews" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold">{interviewsData?.pending || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Send className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Enviadas</p>
                    <p className="text-2xl font-bold">{interviewsData?.sent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completadas</p>
                    <p className="text-2xl font-bold">{interviewsData?.completed || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Disparar Nova Entrevista</CardTitle>
              <CardDescription>
                Configure e envie entrevistas automatizadas via IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'win', channel: 'whatsapp' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    <span className="font-medium">Entrevista Win</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entenda o que fez o cliente escolher você
                  </p>
                </div>
                
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'loss', channel: 'whatsapp' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Entrevista Loss</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Descubra os reais motivos da perda
                  </p>
                </div>
                
                <div className="p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                  onClick={() => createInterviewMutation.mutate({ interviewType: 'churn', channel: 'email' })}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">Entrevista Churn</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Entenda por que o cliente cancelou
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Interviews */}
          <Card>
            <CardHeader>
              <CardTitle>Entrevistas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {interviewsData?.interviews && interviewsData.interviews.length > 0 ? (
                <div className="space-y-3">
                  {interviewsData.interviews.slice(0, 5).map((interview: any) => (
                    <div key={interview.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {interview.interview_type === 'win' ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : interview.interview_type === 'loss' ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium">{(interview.account as any)?.nome_fantasia || (interview.account as any)?.razao_social || 'Conta'}</p>
                          <p className="text-sm text-muted-foreground">{(interview.contact as any)?.nome || 'Contato'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          interview.status === 'completed' ? 'default' :
                          interview.status === 'sent' ? 'secondary' :
                          'outline'
                        }>
                          {interview.status === 'completed' ? 'Completo' :
                           interview.status === 'sent' ? 'Enviado' :
                           interview.status === 'pending' ? 'Pendente' :
                           interview.status}
                        </Badge>
                        <Badge variant="outline">
                          {interview.channel === 'whatsapp' && <MessageSquare className="h-3 w-3" />}
                          {interview.channel === 'email' && <Mail className="h-3 w-3" />}
                          {interview.channel === 'voip' && <Phone className="h-3 w-3" />}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma entrevista realizada ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Impact Tab */}
        <TabsContent value="revenue" className="space-y-6">
          {revenueSimulation ? (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-emerald-500/20">
                  <CardHeader>
                    <CardTitle className="text-emerald-500">Simulação de Receita</CardTitle>
                    <CardDescription>Impacto potencial com melhorias</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Win Rate Atual</p>
                        <p className="text-3xl font-bold">{revenueSimulation.metrics.currentWinRate.toFixed(1)}%</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                        <p className="text-sm text-muted-foreground">Win Rate Projetado</p>
                        <p className="text-3xl font-bold text-emerald-500">{revenueSimulation.metrics.projectedWinRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="p-6 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Receita Incremental Potencial</p>
                      <p className="text-4xl font-bold text-emerald-500">
                        {formatCurrency(revenueSimulation.metrics.revenueIncrement)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">por ano</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Melhorias Sugeridas</CardTitle>
                    <CardDescription>Ações para aumentar win rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueSimulation.improvements && revenueSimulation.improvements.length > 0 ? (
                      <div className="space-y-4">
                        {revenueSimulation.improvements.map((imp: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                            <ArrowRight className="h-5 w-5 text-primary mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{imp.area}</p>
                                <Badge variant={
                                  imp.difficulty === 'low' ? 'default' :
                                  imp.difficulty === 'medium' ? 'secondary' :
                                  'destructive'
                                }>
                                  +{imp.potentialImpact}%
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{imp.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Sem melhorias identificadas
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Métricas Detalhadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Total de Deals</p>
                      <p className="text-2xl font-bold">{revenueSimulation.metrics.totalDeals}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Receita Atual</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueSimulation.metrics.currentRevenue)}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Receita Perdida</p>
                      <p className="text-2xl font-bold text-red-500">{formatCurrency(revenueSimulation.metrics.lostRevenue)}</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-sm text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold">{formatCurrency(revenueSimulation.metrics.avgDealValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Simulador de Impacto em Receita</h3>
                <p className="text-muted-foreground mb-4">
                  Calcule o potencial de receita adicional com melhorias no win rate
                </p>
                <Button
                  onClick={() => simulateRevenueMutation.mutate()}
                  disabled={simulateRevenueMutation.isPending}
                >
                  {simulateRevenueMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4 mr-2" />
                  )}
                  Gerar Simulação
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Para Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Scripts corrigidos</p>
                  <p className="text-sm text-muted-foreground">Baseados nos padrões de sucesso</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Objeções mapeadas</p>
                  <p className="text-sm text-muted-foreground">Com respostas efetivas</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Playbooks automáticos</p>
                  <p className="text-sm text-muted-foreground">Por tipo de cliente</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  Para Marketing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Mensagens vencedoras</p>
                  <p className="text-sm text-muted-foreground">Copy que converte</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Segmentações eficazes</p>
                  <p className="text-sm text-muted-foreground">ICP mais rentável</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Barreiras de percepção</p>
                  <p className="text-sm text-muted-foreground">O que afasta leads</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Para Produto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Features críticas</p>
                  <p className="text-sm text-muted-foreground">Que geram perda</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Diferenciais vencedores</p>
                  <p className="text-sm text-muted-foreground">O que faz ganhar</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Roadmap priorizado</p>
                  <p className="text-sm text-muted-foreground">Por impacto em receita</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                  Para RevOps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Gargalos do pipeline</p>
                  <p className="text-sm text-muted-foreground">Onde deals travam</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Falhas de processo</p>
                  <p className="text-sm text-muted-foreground">Automações quebradas</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Etapas críticas</p>
                  <p className="text-sm text-muted-foreground">Conversão baixa</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
