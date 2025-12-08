import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Users, 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Clock,
  ArrowRight,
  Brain,
  Target,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Minus,
  RefreshCw,
  Sparkles,
  FileText,
  Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CSDashboard() {
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Buscar clientes ativos
  const { data: activeClients, isLoading: loadingClients } = useQuery({
    queryKey: ['cs-active-clients', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('lifecycle_stage', 'Cliente')
        .order('data_tornou_cliente', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar previsões de churn
  const { data: churnPredictions, isLoading: loadingChurn } = useQuery({
    queryKey: ['cs-churn-predictions', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('churn_predictions')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social, pontuacao_nps)
        `)
        .eq('organization_id', organization.id)
        .order('churn_probability', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar success plans
  const { data: successPlans, isLoading: loadingPlans } = useQuery({
    queryKey: ['cs-success-plans', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('success_plans')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social)
        `)
        .eq('organization_id', organization.id)
        .in('status', ['draft', 'active'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Default health metrics to prevent undefined errors
  const defaultHealthMetrics = { nps: null, csat: null, ces: null, recent: [] };

  // Buscar métricas de saúde (NPS, CSAT, CES)
  const { data: healthMetricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['cs-health-metrics', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return defaultHealthMetrics;
      
      const { data: metrics, error } = await supabase
        .from('cs_health_metrics')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('survey_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('survey_date', { ascending: false });
      
      if (error) throw error;
      
      const npsScores = metrics?.filter(m => m.metric_type === 'nps') || [];
      const csatScores = metrics?.filter(m => m.metric_type === 'csat') || [];
      const cesScores = metrics?.filter(m => m.metric_type === 'ces') || [];
      
      // Calculate NPS
      let nps = null;
      if (npsScores.length > 0) {
        const promoters = npsScores.filter(m => Number(m.score) >= 9).length;
        const detractors = npsScores.filter(m => Number(m.score) <= 6).length;
        nps = Math.round(((promoters - detractors) / npsScores.length) * 100);
      }
      
      // Calculate average CSAT
      const csat = csatScores.length > 0 
        ? (csatScores.reduce((sum, m) => sum + Number(m.score), 0) / csatScores.length).toFixed(1)
        : null;
      
      // Calculate average CES
      const ces = cesScores.length > 0
        ? (cesScores.reduce((sum, m) => sum + Number(m.score), 0) / cesScores.length).toFixed(1)
        : null;
      
      return { nps, csat, ces, recent: metrics?.slice(0, 10) || [] };
    },
    enabled: !!organization?.id
  });

  // Ensure healthMetrics always has a valid default
  const healthMetrics = healthMetricsData || defaultHealthMetrics;

  // Buscar onboarding pendente
  const { data: pendingOnboarding, isLoading: loadingOnboarding } = useQuery({
    queryKey: ['cs-pending-onboarding', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data: csPipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization.id)
        .ilike('name', '%cs%');
      if (!csPipelines || csPipelines.length === 0) return [];
      const pipelineIds = csPipelines.map(p => p.id);
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social),
          stage:stages(id, name)
        `)
        .eq('organization_id', organization.id)
        .in('pipeline_id', pipelineIds)
        .not('status', 'in', '("won","lost")')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Mutation para rodar previsão de churn
  const churnMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('predict-churn', {
        body: { organizationId: organization?.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Análise concluída: ${data.summary.critical + data.summary.high} clientes em risco`);
      queryClient.invalidateQueries({ queryKey: ['cs-churn-predictions'] });
    },
    onError: (error) => {
      toast.error('Erro ao analisar churn: ' + (error as Error).message);
    }
  });

  // KPIs
  const kpis = {
    totalClients: activeClients?.length || 0,
    atRiskCount: churnPredictions?.filter((p: any) => p.risk_level === 'critical' || p.risk_level === 'high').length || 0,
    activePlans: successPlans?.filter((p: any) => p.status === 'active').length || 0,
    pendingOnboarding: pendingOnboarding?.length || 0
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'high':
        return <Badge className="bg-red-500/20 text-red-500">Alto</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500/20 text-yellow-500">Médio</Badge>;
      default:
        return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  const getNPSIcon = (score: number | null) => {
    if (score === null) return <Minus className="h-5 w-5 text-muted-foreground" />;
    if (score >= 50) return <ThumbsUp className="h-5 w-5 text-emerald-500" />;
    if (score >= 0) return <Minus className="h-5 w-5 text-yellow-500" />;
    return <ThumbsDown className="h-5 w-5 text-red-500" />;
  };

  return (
    <Layout>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Success</h1>
          <p className="text-muted-foreground">
            Gestão de clientes, churn prediction e expansão de receita
          </p>
        </div>
        <Button 
          onClick={() => churnMutation.mutate()} 
          disabled={churnMutation.isPending}
          className="gap-2"
        >
          {churnMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          Analisar Churn
        </Button>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{kpis.totalClients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Risco</p>
                <p className="text-2xl font-bold text-red-500">{kpis.atRiskCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Target className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Planos Ativos</p>
                <p className="text-2xl font-bold text-emerald-500">{kpis.activePlans}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Onboarding</p>
                <p className="text-2xl font-bold">{kpis.pendingOnboarding}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">NPS Score</p>
                <p className="text-3xl font-bold">
                  {healthMetrics?.nps !== null ? healthMetrics.nps : '--'}
                </p>
              </div>
              {getNPSIcon(healthMetrics?.nps || null)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Últimos 90 dias</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CSAT Médio</p>
                <p className="text-3xl font-bold">
                  {healthMetrics?.csat || '--'}<span className="text-lg text-muted-foreground">/5</span>
                </p>
              </div>
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Satisfação do cliente</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CES Médio</p>
                <p className="text-3xl font-bold">
                  {healthMetrics?.ces || '--'}<span className="text-lg text-muted-foreground">/7</span>
                </p>
              </div>
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Esforço do cliente (menor = melhor)</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="churn">Churn Predictions</TabsTrigger>
          <TabsTrigger value="plans">Success Plans</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Risk Clients */}
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                  Clientes em Risco
                </CardTitle>
                <CardDescription>Top 5 clientes com maior risco de churn</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingChurn ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : churnPredictions && churnPredictions.length > 0 ? (
                  <div className="space-y-3">
                    {churnPredictions.slice(0, 5).map((item: any) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 cursor-pointer transition-colors"
                        onClick={() => navigate(`/app/accounts/${item.account_id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.account?.nome_fantasia || item.account?.razao_social}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(item.risk_factors as any[])?.slice(0, 2).map((f: any) => f.factor).join(' • ') || 'Análise em andamento'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{item.churn_probability}%</span>
                          {getRiskBadge(item.risk_level)}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                    <p>Nenhum cliente em risco identificado!</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => churnMutation.mutate()}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Executar Análise
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Success Plans */}
            <Card className="border-emerald-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-500">
                  <Target className="h-5 w-5" />
                  Planos de Sucesso Ativos
                </CardTitle>
                <CardDescription>Planos em execução para garantir retenção</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : successPlans && successPlans.length > 0 ? (
                  <div className="space-y-3">
                    {successPlans.slice(0, 5).map((plan: any) => (
                      <div 
                        key={plan.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{plan.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {plan.account?.nome_fantasia || plan.account?.razao_social}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {plan.health_score && (
                            <div className="w-16">
                              <Progress value={plan.health_score} className="h-2" />
                            </div>
                          )}
                          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                            {plan.status === 'active' ? 'Ativo' : 'Rascunho'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum plano de sucesso ativo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="churn" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Previsões de Churn
                  </CardTitle>
                  <CardDescription>Análise preditiva de risco de cancelamento</CardDescription>
                </div>
                <Button 
                  onClick={() => churnMutation.mutate()} 
                  disabled={churnMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  {churnMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingChurn ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : churnPredictions && churnPredictions.length > 0 ? (
                <div className="space-y-4">
                  {churnPredictions.map((prediction: any) => (
                    <div 
                      key={prediction.id}
                      className="p-4 rounded-lg border hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">
                            {prediction.account?.nome_fantasia || prediction.account?.razao_social}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            NPS: {prediction.account?.pontuacao_nps ?? 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-2xl font-bold">{prediction.churn_probability}%</p>
                            <p className="text-xs text-muted-foreground">probabilidade</p>
                          </div>
                          {getRiskBadge(prediction.risk_level)}
                        </div>
                      </div>
                      
                      {/* Risk Factors */}
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">FATORES DE RISCO</p>
                        <div className="flex flex-wrap gap-2">
                          {(prediction.risk_factors as any[])?.map((factor: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {factor.factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Recommendations */}
                      {prediction.recommendations && (prediction.recommendations as string[]).length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            RECOMENDAÇÕES IA
                          </p>
                          <ul className="text-sm space-y-1">
                            {(prediction.recommendations as string[]).slice(0, 3).map((rec: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">Nenhuma previsão disponível</p>
                  <p className="text-sm mb-4">Execute a análise para identificar clientes em risco</p>
                  <Button onClick={() => churnMutation.mutate()}>
                    <Brain className="h-4 w-4 mr-2" />
                    Executar Análise de Churn
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Planos de Sucesso
              </CardTitle>
              <CardDescription>Gerencie planos de sucesso para garantir a retenção de clientes</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlans ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : successPlans && successPlans.length > 0 ? (
                <div className="space-y-4">
                  {successPlans.map((plan: any) => (
                    <div key={plan.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{plan.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {plan.account?.nome_fantasia || plan.account?.razao_social}
                          </p>
                        </div>
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status === 'active' ? 'Ativo' : plan.status === 'completed' ? 'Concluído' : 'Rascunho'}
                        </Badge>
                      </div>
                      {plan.goals && (plan.goals as any[]).length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">OBJETIVOS</p>
                          <ul className="text-sm">
                            {(plan.goals as any[]).slice(0, 3).map((goal: any, idx: number) => (
                              <li key={idx}>• {typeof goal === 'string' ? goal : goal.description || goal.title}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium mb-2">Nenhum plano de sucesso</p>
                  <p className="text-sm">Crie planos para garantir o sucesso dos seus clientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Clientes em Onboarding
              </CardTitle>
              <CardDescription>Novos clientes no processo de implantação</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOnboarding ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : pendingOnboarding && pendingOnboarding.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingOnboarding.map((item: any) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/app/opportunities/${item.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {item.account?.nome_fantasia || item.account?.razao_social}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{item.title}</p>
                      </div>
                      <Badge variant="outline">{item.stage?.name}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                  <p>Nenhum cliente em onboarding no momento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
