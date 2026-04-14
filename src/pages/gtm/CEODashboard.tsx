import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { KPICard } from '@/components/dashboards/shared/KPICard';
import { HumanoidInsights } from '@/components/dashboards/owner/HumanoidInsights';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Zap,
  Calendar,
  BarChart3,
  LayoutDashboard,
  AlertTriangle,
  Repeat,
  Percent,
  Activity,
  Receipt
} from 'lucide-react';
import { formatCurrencyFull } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  },
};

export default function CEODashboard() {
  const { organization } = useCurrentUser();

  // KPIs executivos
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['ceo-kpis', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      
      // =================== MRR REAL (CENTRALIZADO) ===================
      const { calculateRealMRR } = await import('@/services/crm/mrr-calculations');
      const mrrResult = await calculateRealMRR({ 
        organizationId: organization.id, 
        onlySalesPipelines: true 
      });
      const totalMRR = mrrResult.totalMRR;
      const arr = mrrResult.arr;
      
      // Buscar pipelines de vendas para filtrar corretamente
      const { data: salesPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('pipeline_type', 'sales');
      
      const salesPipelineIds = (salesPipelines || []).map(p => p.id);
      
      // Receita do mês (APENAS PIPELINES DE VENDAS)
      const { data: revenueMonth } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none'])
        .gte('updated_at', startOfMonth);
      
      const monthlyRevenue = revenueMonth?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Receita do ano (APENAS PIPELINES DE VENDAS)
      const { data: revenueYear } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none'])
        .gte('updated_at', startOfYear);
      
      const yearlyRevenue = revenueYear?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Pipeline total (APENAS PIPELINES DE VENDAS)
      const { data: pipeline } = await supabase
        .from('opportunities')
        .select('valor_previsto, win_probability_ai, prob')
        .eq('organization_id', organization.id)
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none'])
        .not('status', 'in', '("won","lost")');
      
      const pipelineValue = pipeline?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const weightedPipeline = pipeline?.reduce((sum, o) => {
        const prob = o.prob || o.win_probability_ai || 50;
        return sum + ((o.valor_previsto || 0) * prob / 100);
      }, 0) || 0;
      
      // Quantidade de clientes
      const { count: clientsCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('lifecycle_stage', 'Cliente');
      
      // Win rate (APENAS PIPELINES DE VENDAS — usa closed_at como fonte da verdade)
      const { data: wonOpps } = await supabase
        .from('opportunities')
        .select('closed_at, updated_at')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .is('deleted_at', null)
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none']);
      
      const wonCount = (wonOpps || []).filter(o => {
        const closeDate = o.closed_at || o.updated_at;
        return closeDate && closeDate >= startOfYear;
      }).length;

      const { data: lostOpps } = await supabase
        .from('opportunities')
        .select('closed_at, updated_at')
        .eq('organization_id', organization.id)
        .eq('status', 'lost')
        .is('deleted_at', null)
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none']);
      
      const lostCount = (lostOpps || []).filter(o => {
        const closeDate = o.closed_at || o.updated_at;
        return closeDate && closeDate >= startOfYear;
      }).length;
      
      const totalClosed = (wonCount || 0) + (lostCount || 0);
      const winRate = totalClosed > 0 ? Math.round((wonCount || 0) / totalClosed * 100) : 0;
      
      // Ticket médio
      const avgTicket = (wonCount || 0) > 0 ? yearlyRevenue / (wonCount || 1) : 0;

      // Open deals count
      const openDealsCount = pipeline?.length || 0;
      
      return {
        arr,
        mrr: totalMRR,
        monthlyRevenue,
        yearlyRevenue,
        pipelineValue,
        weightedPipeline,
        clientsCount: clientsCount || 0,
        winRate,
        avgTicket,
        dealsWon: wonCount || 0,
        openDealsCount
      };
    },
    enabled: !!organization?.id
  });

  // Forecast por cenário usando função CENTRALIZADA (filtrado por SALES pipeline)
  const { data: forecast } = useQuery({
    queryKey: ['ceo-forecast', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      // Buscar pipelines de vendas
      const { data: salesPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('pipeline_type', 'sales');
      
      const salesPipelineIds = (salesPipelines || []).map(p => p.id);
      
      // Pipeline APENAS de vendas
      const { data: pipeline } = await supabase
        .from('opportunities')
        .select('id, valor_previsto, prob, win_probability_ai, close_date_prevista')
        .eq('organization_id', organization.id)
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none'])
        .not('status', 'in', '("won","lost")');
      
      if (!pipeline) return null;
      
      // Buscar closedRevenue real do mês
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: wonThisMonth } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .in('pipeline_id', salesPipelineIds.length > 0 ? salesPipelineIds : ['none'])
        .gte('updated_at', startOfMonth);
      
      const closedRevenue = (wonThisMonth || []).reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      
      const { calculateForecastScenarios } = await import('@/services/crm/forecast');
      const scenarios = calculateForecastScenarios({
        opportunities: pipeline.map(o => ({ 
          id: o.id,
          valor_previsto: o.valor_previsto, 
          prob: o.prob || o.win_probability_ai || 50,
          stage_probability: null,
        })),
        closedRevenue,
        goal: 0,
      });

      const pessimisticScenario = scenarios.find(s => s.name === 'pessimista');
      const realisticScenario = scenarios.find(s => s.name === 'realista');
      const optimisticScenario = scenarios.find(s => s.name === 'otimista');
      const bestCaseScenario = scenarios.find(s => s.name === 'best_case');

      return { 
        pessimistic: pessimisticScenario?.value || 0, 
        realistic: realisticScenario?.value || 0, 
        optimistic: optimisticScenario?.value || 0,
        bestCase: bestCaseScenario?.value || 0,
      };
    },
    enabled: !!organization?.id
  });

  // AI Insights
  const { data: aiInsights } = useQuery({
    queryKey: ['ceo-ai-insights', organization?.id],
    queryFn: async () => {
      // Gerar insights baseados nos dados
      const insights = [];
      
      if (kpis) {
        if (kpis.winRate >= 40) {
          insights.push({
            insight: `Taxa de conversão de ${kpis.winRate}% está acima da média do mercado`,
            impact: 'Alto',
            confidence: 85
          });
        }
        if (kpis.pipelineValue > kpis.monthlyRevenue * 3) {
          insights.push({
            insight: `Pipeline representa ${Math.round(kpis.pipelineValue / (kpis.monthlyRevenue || 1))}x a receita mensal`,
            impact: 'Médio',
            confidence: 78
          });
        }
      }
      
      if (forecast && forecast.realistic > 0) {
        insights.push({
          insight: `Forecast realista projeta ${formatCurrencyFull(forecast.realistic)} em receita`,
          impact: 'Alto',
          confidence: 72
        });
      }
      
      return insights;
    },
    enabled: !!organization?.id && !!kpis
  });

  // Top oportunidades
  const { data: topOpportunities } = useQuery({
    queryKey: ['ceo-top-opportunities', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          id, title, valor_previsto, win_probability_ai, close_date_prevista,
          account:accounts(nome_fantasia, razao_social),
          owner:profiles!opportunities_owner_user_id_fkey(full_name)
        `)
        .eq('organization_id', organization.id)
        .not('status', 'in', '("won","lost")')
        .order('valor_previsto', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  };

  return (
    <Layout>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 md:p-6 space-y-4 md:space-y-6"
      >
        {/* Header Premium */}
        <DashboardHeader
          role="owner"
          title="CEO Dashboard"
          subtitle="Visão estratégica de receita e crescimento"
        />

        {/* KPIs Principais - Usando KPICard premium */}
        <motion.div variants={sectionVariants} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Receita Mensal"
              value={formatCurrencyFull(kpis?.monthlyRevenue || 0)}
              subtitle="Vendas fechadas no mês"
              icon={DollarSign}
              iconColor="text-emerald-500"
              variant={kpis?.monthlyRevenue ? "success" : "default"}
              trend={kpis?.dealsWon ? {
                value: `${kpis.dealsWon} negócios`,
                isPositive: true
              } : undefined}
            />

            <KPICard
              title="MRR Total"
              value={`${formatCurrencyFull(kpis?.mrr || 0)}/mês`}
              subtitle={`ARR: ${formatCurrencyFull(kpis?.arr || 0)}`}
              icon={Repeat}
              iconColor="text-green-500"
              variant={kpis?.mrr ? "primary" : "default"}
            />

            <KPICard
              title="Pipeline Total"
              value={formatCurrencyFull(kpis?.pipelineValue || 0)}
              subtitle={`Ponderado: ${formatCurrencyFull(kpis?.weightedPipeline || 0)}`}
              icon={BarChart3}
              iconColor="text-blue-500"
              variant="primary"
            />

            <KPICard
              title="Clientes Ativos"
              value={(kpis?.clientsCount || 0).toString()}
              subtitle={`Ticket Médio: ${formatCurrencyFull(kpis?.avgTicket || 0)}`}
              icon={Users}
              iconColor="text-purple-500"
            />
          </div>

          {/* KPIs Secundários */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              title="Taxa Conversão"
              value={`${kpis?.winRate || 0}%`}
              subtitle="Won / Total Fechados"
              icon={Percent}
              iconColor={kpis?.winRate && kpis.winRate >= 30 ? "text-green-500" : "text-orange-500"}
              variant={kpis?.winRate && kpis.winRate >= 30 ? "success" : "warning"}
            />

            <KPICard
              title="Receita Anual"
              value={formatCurrencyFull(kpis?.yearlyRevenue || 0)}
              subtitle="Total fechado no ano"
              icon={TrendingUp}
              iconColor="text-emerald-500"
            />

            <KPICard
              title="Pipeline Aberto"
              value={(kpis?.openDealsCount || 0).toString()}
              subtitle="Oportunidades ativas"
              icon={Activity}
              iconColor="text-purple-500"
            />

            <KPICard
              title="Forecast Realista"
              value={formatCurrencyFull(forecast?.realistic || 0)}
              subtitle="Projeção ponderada"
              icon={Target}
              iconColor="text-blue-500"
            />

            <KPICard
              title="Forecast Otimista"
              value={formatCurrencyFull(forecast?.optimistic || 0)}
              subtitle="Deals prob ≥ 40%"
              icon={Zap}
              iconColor="text-amber-500"
            />
          </div>
        </motion.div>

        {/* Tabs com conteúdo */}
        <motion.div variants={sectionVariants}>
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-background">
                <LayoutDashboard className="h-4 w-4" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="forecast" className="gap-2 data-[state=active]:bg-background">
                <TrendingUp className="h-4 w-4" />
                Forecast
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="gap-2 data-[state=active]:bg-background">
                <Target className="h-4 w-4" />
                Top Oportunidades
              </TabsTrigger>
            </TabsList>

            {/* Visão Geral - AI Insights */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <HumanoidInsights insights={aiInsights || []} />
            </TabsContent>

            {/* Cenários de Forecast */}
            <TabsContent value="forecast" className="space-y-4 mt-4">
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle>Cenários de Forecast</CardTitle>
                  <CardDescription>Projeção de receita baseada em probabilidade de fechamento</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-center p-4 rounded-lg bg-red-500/5 border border-red-500/20"
                    >
                      <TrendingDown className="h-8 w-8 mx-auto text-red-500 mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Pessimista</p>
                      <p className="text-xl font-bold text-red-500">{formatCurrencyFull(forecast?.pessimistic || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Deals com prob ≥ 80%</p>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-center p-4 rounded-lg bg-blue-500/5 border border-blue-500/20"
                    >
                      <Target className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Realista</p>
                      <p className="text-xl font-bold text-blue-500">{formatCurrencyFull(forecast?.realistic || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Pipeline ponderado</p>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                    >
                      <TrendingUp className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Otimista</p>
                      <p className="text-xl font-bold text-emerald-500">{formatCurrencyFull(forecast?.optimistic || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Deals com prob ≥ 40%</p>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-center p-4 rounded-lg bg-purple-500/5 border border-purple-500/20"
                    >
                      <Zap className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">Melhor Caso</p>
                      <p className="text-xl font-bold text-purple-500">{formatCurrencyFull(forecast?.bestCase || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Todo o pipeline</p>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Top Oportunidades */}
            <TabsContent value="opportunities" className="space-y-4 mt-4">
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle>Top Oportunidades Estratégicas</CardTitle>
                  <CardDescription>Maiores deals em andamento no pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  {topOpportunities && topOpportunities.length > 0 ? (
                    <div className="space-y-3">
                      {topOpportunities.map((opp: any, index: number) => (
                        <motion.div 
                          key={opp.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                            index < 3 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">
                              {opp.account?.nome_fantasia || opp.account?.razao_social}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{opp.title}</p>
                            <p className="text-xs text-muted-foreground">{(opp.owner as any)?.full_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold">{formatCurrencyFull(opp.valor_previsto || 0)}</p>
                            <div className="flex items-center gap-2 justify-end">
                              <Badge variant="secondary">{opp.win_probability_ai || 50}% prob</Badge>
                              {opp.close_date_prevista && (
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(opp.close_date_prevista)}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhuma oportunidade no pipeline</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
