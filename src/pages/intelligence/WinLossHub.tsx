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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  Zap,
  ArrowRightLeft,
  Filter,
  UserX,
  XCircle,
  LogOut,
  Trophy,
  Award,
  Quote
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SellerVsClientReasonsChart } from '@/components/intelligence/SellerVsClientReasonsChart';

// Pipeline context types and terminology
type PipelineContext = 'qualification' | 'sales' | 'onboarding';

const CONTEXT_CONFIG: Record<PipelineContext, {
  label: string;
  icon: React.ReactNode;
  wonLabel: string;
  lostLabel: string;
  wonLabelPlural: string;
  lostLabelPlural: string;
  rateLabel: string;
  color: string;
}> = {
  qualification: {
    label: 'Leads Desqualificados',
    icon: <UserX className="h-4 w-4" />,
    wonLabel: 'Lead Qualificado',
    lostLabel: 'Lead Desqualificado',
    wonLabelPlural: 'Leads Qualificados',
    lostLabelPlural: 'Leads Desqualificados',
    rateLabel: 'Taxa de Qualificação',
    color: 'text-purple-500'
  },
  sales: {
    label: 'Deals Perdidos',
    icon: <XCircle className="h-4 w-4" />,
    wonLabel: 'Deal Ganho',
    lostLabel: 'Deal Perdido',
    wonLabelPlural: 'Deals Ganhos',
    lostLabelPlural: 'Deals Perdidos',
    rateLabel: 'Win Rate',
    color: 'text-red-500'
  },
  onboarding: {
    label: 'Churns',
    icon: <LogOut className="h-4 w-4" />,
    wonLabel: 'Cliente Ativado',
    lostLabel: 'Churn',
    wonLabelPlural: 'Clientes Ativados',
    lostLabelPlural: 'Churns',
    rateLabel: 'Taxa de Ativação',
    color: 'text-orange-500'
  }
};

export default function WinLossHub() {
  const { organization } = useCurrentUser();
  const { toast } = useToast();
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [revenueSimulation, setRevenueSimulation] = useState<any>(null);
  const [pipelineContext, setPipelineContext] = useState<PipelineContext>('sales');
  
  const contextConfig = CONTEXT_CONFIG[pipelineContext];

  // Win/Loss data - with fallback to opportunities table and dynamic pipeline_type filter
  const { data: winLossData, isLoading } = useQuery({
    queryKey: ['winloss-data', organization?.id, pipelineContext],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      
      // Get pipelines by context type
      const pipelineTypes = pipelineContext === 'onboarding' 
        ? ['onboarding', 'cs', 'renewal'] 
        : [pipelineContext];
      
      const { data: contextPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .in('pipeline_type', pipelineTypes);
      
      const pipelineIds = contextPipelines?.map(p => p.id) || [];
      
      // Fetch win_loss_records with win_reasons join
      const { data: records } = await supabase
        .from('win_loss_records')
        .select(`
          *,
          opportunity:opportunities(
            valor_previsto,
            pipeline_id,
            account:accounts(segmento, porte)
          ),
          reason:loss_reasons(name),
          win_reason:win_reasons(name)
        `)
        .eq('organization_id', organization.id)
        .gte('created_at', startOfYear)
        .order('created_at', { ascending: false });
      
      // Filter records by context pipelines
      const filteredRecords = records?.filter(r => 
        pipelineIds.includes((r.opportunity as any)?.pipeline_id)
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
        .in('pipeline_id', pipelineIds.length > 0 ? pipelineIds : ['no-pipelines'])
        .gte('created_at', startOfYear);
      
      // Merge: use opportunities as source of truth, enrich with win_loss_records data
      const recordsByOppId = new Map(filteredRecords.map(r => [r.opportunity_id, r]));
      
      // Filter out test opportunities (title contains "teste" or "test")
      const isTestOpportunity = (title: string) => {
        const lowerTitle = (title || '').toLowerCase();
        return lowerTitle.includes('teste') || lowerTitle.includes('test');
      };
      
      const allDeals = (directOpportunities || [])
        .filter(opp => !isTestOpportunity(opp.title))
        .map(opp => {
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
            // WIN data from win_loss_records
            win_reason_id: record?.win_reason_id,
            win_reason_name: (record?.win_reason as any)?.name,
            key_differentiator: record?.key_differentiator,
            customer_feedback: record?.customer_feedback,
            recorded_by_customer: record?.recorded_by_customer,
            acceptor_name: record?.acceptor_name,
          };
        });
      
      const wins = allDeals.filter(d => d.outcome === 'won');
      const losses = allDeals.filter(d => d.outcome === 'lost');
      
      const lossReasonCounts: Record<string, number> = {};
      losses.forEach(l => {
        const reason = l.reason_seller || (l.reason as any)?.name || 'Não informado';
        lossReasonCounts[reason] = (lossReasonCounts[reason] || 0) + 1;
      });
      
      // WIN: Aggregate win reasons
      const winReasonCounts: Record<string, number> = {};
      wins.forEach(w => {
        const reason = w.win_reason_name || 'Não informado';
        winReasonCounts[reason] = (winReasonCounts[reason] || 0) + 1;
      });
      
      // WIN: Aggregate key differentiators (comma-separated values)
      const differentiatorCounts: Record<string, number> = {};
      wins.forEach(w => {
        if (w.key_differentiator) {
          const diffs = w.key_differentiator.split(',').map((d: string) => d.trim());
          diffs.forEach((diff: string) => {
            if (diff) {
              differentiatorCounts[diff] = (differentiatorCounts[diff] || 0) + 1;
            }
          });
        }
      });
      
      // WIN: Collect customer feedbacks
      const customerFeedbacks = wins
        .filter(w => w.customer_feedback && w.recorded_by_customer)
        .map(w => ({
          feedback: w.customer_feedback,
          acceptorName: w.acceptor_name || 'Cliente',
          winReason: w.win_reason_name,
          value: w.final_value,
        }))
        .slice(0, 5); // Last 5 feedbacks
      
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
        // WIN data
        winReasons: Object.entries(winReasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        differentiators: Object.entries(differentiatorCounts)
          .map(([differentiator, count]) => ({ differentiator, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        customerFeedbacks,
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

      {/* Pipeline Context Selector */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Contexto:</span>
            </div>
            <ToggleGroup 
              type="single" 
              value={pipelineContext} 
              onValueChange={(value) => value && setPipelineContext(value as PipelineContext)}
              className="justify-start"
            >
              <ToggleGroupItem value="qualification" className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Leads Desqualificados
              </ToggleGroupItem>
              <ToggleGroupItem value="sales" className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Deals Perdidos
              </ToggleGroupItem>
              <ToggleGroupItem value="onboarding" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                Churns
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* KPIs - Dynamic Labels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{contextConfig.wonLabelPlural}</p>
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
                <p className="text-sm text-muted-foreground">{contextConfig.lostLabelPlural}</p>
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
                <p className="text-sm text-muted-foreground">{contextConfig.rateLabel}</p>
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
                <p className="text-sm text-muted-foreground">
                  Valor {pipelineContext === 'qualification' ? 'Desqualificado' : pipelineContext === 'onboarding' ? 'Churned' : 'Perdido'}
                </p>
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
          <TabsTrigger value="comparison" className="flex items-center gap-1">
            <ArrowRightLeft className="h-3 w-3" />
            Vendedor vs Cliente
          </TabsTrigger>
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
                  {pipelineContext === 'qualification' 
                    ? 'Top Motivos de Desqualificação' 
                    : pipelineContext === 'onboarding' 
                      ? 'Top Motivos de Churn' 
                      : 'Top Motivos de Perda'}
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

            {/* Fatores de Decisão - Motivos Reais de Perda */}
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-red-500" />
                  Fatores de Decisão (Perdas)
                </CardTitle>
                <CardDescription>Motivos reais informados - dados vindos de clientes e vendedores</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : winLossData?.lossReasons && winLossData.lossReasons.length > 0 ? (
                  <div className="space-y-4">
                    {winLossData.lossReasons.map((item: { reason: string; count: number }, index: number) => {
                      const total = winLossData.lossReasons.reduce((sum: number, r: { count: number }) => sum + r.count, 0);
                      const percentage = Math.round((item.count / total) * 100);
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.reason}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{percentage}%</span>
                              <Badge variant="secondary" className="bg-red-500/10 text-red-600">{item.count}</Badge>
                            </div>
                          </div>
                          <Progress 
                            value={percentage} 
                            className="h-2 [&>div]:bg-red-500"
                          />
                        </div>
                      );
                    })}
                    
                    {/* Total summary */}
                    <div className="pt-4 mt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total de perdas analisadas</span>
                        <span className="font-bold">{winLossData.lossReasons.reduce((sum: number, r: { count: number }) => sum + r.count, 0)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PieChart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum motivo de perda registrado</p>
                    <p className="text-xs mt-1">Dados aparecem após propostas serem recusadas ou deals marcados como perdidos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ciclo de Venda */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {pipelineContext === 'qualification' 
                    ? 'Ciclo de Qualificação Médio' 
                    : pipelineContext === 'onboarding' 
                      ? 'Tempo até Churn' 
                      : 'Ciclo de Venda Médio'}
                </CardTitle>
                <CardDescription>
                  Comparação entre {contextConfig.wonLabelPlural.toLowerCase()} e {contextConfig.lostLabelPlural.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <TrendingUp className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
                    <p className="text-3xl font-bold text-emerald-500">{winLossData?.avgCycleWon || 0}</p>
                    <p className="text-sm text-muted-foreground">dias ({contextConfig.wonLabelPlural.toLowerCase()})</p>
                  </div>
                  <div className="text-center p-6 rounded-lg bg-red-500/5 border border-red-500/20">
                    <TrendingDown className="h-10 w-10 mx-auto text-red-500 mb-3" />
                    <p className="text-3xl font-bold text-red-500">{winLossData?.avgCycleLost || 0}</p>
                    <p className="text-sm text-muted-foreground">dias ({contextConfig.lostLabelPlural.toLowerCase()})</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WIN Analysis Section - Only show for sales context */}
          {pipelineContext === 'sales' && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Top Motivos de Ganho */}
              <Card className="border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-emerald-500" />
                    Top Motivos de Ganho
                  </CardTitle>
                  <CardDescription>O que fez os clientes escolherem você</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : winLossData?.winReasons && winLossData.winReasons.length > 0 ? (
                    <div className="space-y-4">
                      {winLossData.winReasons.map((item: any, index: number) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.reason}</span>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">{item.count}</Badge>
                          </div>
                          <Progress 
                            value={(item.count / (winLossData.winReasons[0]?.count || 1)) * 100} 
                            className="h-2 [&>div]:bg-emerald-500"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum motivo de ganho registrado</p>
                      <p className="text-xs mt-1">Dados aparecem após clientes aprovarem propostas</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Diferenciais Decisivos */}
              <Card className="border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Diferenciais Decisivos
                  </CardTitle>
                  <CardDescription>Fatores que fecharam o negócio</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : winLossData?.differentiators && winLossData.differentiators.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {winLossData.differentiators.map((item: any, index: number) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="px-3 py-2 text-sm border-amber-500/30 bg-amber-500/5"
                        >
                          {item.differentiator}
                          <span className="ml-2 text-xs text-muted-foreground">({item.count})</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum diferencial registrado</p>
                      <p className="text-xs mt-1">Clientes informam ao aprovar propostas</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Feedback dos Clientes */}
              <Card className="border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Quote className="h-5 w-5 text-blue-500" />
                    Feedback dos Clientes
                  </CardTitle>
                  <CardDescription>O que disseram ao aprovar</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : winLossData?.customerFeedbacks && winLossData.customerFeedbacks.length > 0 ? (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {winLossData.customerFeedbacks.map((item: any, index: number) => (
                        <div key={index} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                          <p className="text-sm italic">"{item.feedback}"</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">— {item.acceptorName}</span>
                            {item.winReason && (
                              <Badge variant="outline" className="text-xs">{item.winReason}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Quote className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum feedback registrado</p>
                      <p className="text-xs mt-1">Coletado quando clientes aprovam propostas</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

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

        {/* Seller vs Client Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {organization?.id && (
            <SellerVsClientReasonsChart organizationId={organization.id} pipelineContext={pipelineContext} />
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
