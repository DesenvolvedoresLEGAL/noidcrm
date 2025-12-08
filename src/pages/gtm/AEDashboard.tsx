import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  DollarSign,
  Target,
  Activity,
  ArrowRight,
  Heart,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function AEDashboard() {
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation para analisar saúde dos deals
  const analyzeHealthMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('Organization not found');
      
      const { data, error } = await supabase.functions.invoke('analyze-deal-health', {
        body: { organizationId: organization.id, userId: user?.id }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ae-deals-at-risk'] });
      queryClient.invalidateQueries({ queryKey: ['ae-kpis'] });
      toast({
        title: 'Análise concluída',
        description: `${data.summary?.total || 0} deals analisados: ${data.summary?.healthy || 0} saudáveis, ${data.summary?.at_risk || 0} em risco, ${data.summary?.critical || 0} críticos`
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

  // Mutation para gerar sugestões de follow-up
  const generateFollowUpMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      const { data, error } = await supabase.functions.invoke('generate-followup-suggestion', {
        body: { opportunityId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Sugestões geradas',
        description: `${data.suggestions?.length || 0} sugestões de follow-up criadas`
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao gerar sugestões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  // Buscar deals em risco (Deal Health crítico)
  const { data: dealsAtRisk, isLoading: loadingRisk } = useQuery({
    queryKey: ['ae-deals-at-risk', organization?.id, user?.id],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return [];
      
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social),
          stage:stages(id, name, color)
        `)
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .not('status', 'in', '("won","lost")')
        .gte('risk_score', 60)
        .order('risk_score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && !!user?.id
  });

  // Buscar deals sem próximo passo
  const { data: dealsNoNextStep, isLoading: loadingNoStep } = useQuery({
    queryKey: ['ae-deals-no-next-step', organization?.id, user?.id],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return [];
      
      const { data: opps, error: oppsError } = await supabase
        .from('opportunities')
        .select(`
          id, title, valor_previsto,
          account:accounts(id, nome_fantasia, razao_social),
          stage:stages(id, name, color)
        `)
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .not('status', 'in', '("won","lost")')
        .order('valor_previsto', { ascending: false });
      
      if (oppsError) throw oppsError;
      
      // Filtrar apenas os que não têm atividades futuras
      const results = [];
      for (const opp of opps || []) {
        const { count } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('opportunity_id', opp.id)
          .eq('status', 'scheduled')
          .gte('scheduled_date', new Date().toISOString());
        
        if (!count || count === 0) {
          results.push(opp);
        }
        if (results.length >= 10) break;
      }
      
      return results;
    },
    enabled: !!organization?.id && !!user?.id
  });

  // KPIs do AE
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['ae-kpis', organization?.id, user?.id],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return null;
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      // Valor total do pipeline
      const { data: pipelineData } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .not('status', 'in', '("won","lost")');
      
      const pipelineValue = pipelineData?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Deals ganhos no mês
      const { data: wonDeals } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .eq('status', 'won')
        .gte('updated_at', startOfMonth);
      
      const wonValue = wonDeals?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const wonCount = wonDeals?.length || 0;
      
      // Deals perdidos no mês
      const { count: lostCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .eq('status', 'lost')
        .gte('updated_at', startOfMonth);
      
      // Win rate
      const totalClosed = wonCount + (lostCount || 0);
      const winRate = totalClosed > 0 ? Math.round(wonCount / totalClosed * 100) : 0;
      
      // Deal Health médio
      const { data: healthData } = await supabase
        .from('opportunities')
        .select('engagement_score, velocity_score, risk_score')
        .eq('organization_id', organization.id)
        .eq('owner_user_id', user.id)
        .not('status', 'in', '("won","lost")');
      
      let avgHealth = 0;
      if (healthData && healthData.length > 0) {
        const healthScores = healthData.map(d => {
          const engagement = d.engagement_score || 50;
          const velocity = d.velocity_score || 50;
          const risk = 100 - (d.risk_score || 50);
          return (engagement + velocity + risk) / 3;
        });
        avgHealth = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length);
      }
      
      return {
        pipelineValue,
        wonValue,
        wonCount,
        winRate,
        avgHealth,
        dealsAtRiskCount: dealsAtRisk?.length || 0
      };
    },
    enabled: !!organization?.id && !!user?.id
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getHealthColor = (health: number) => {
    if (health >= 70) return 'text-emerald-500';
    if (health >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 80) return <Badge variant="destructive">Crítico</Badge>;
    if (riskScore >= 60) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Atenção</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel do Vendedor</h1>
          <p className="text-muted-foreground">
            Visão consolidada do seu pipeline e deals em risco
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => analyzeHealthMutation.mutate()}
            disabled={analyzeHealthMutation.isPending}
          >
            {analyzeHealthMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Heart className="h-4 w-4 mr-2" />
            )}
            Analisar Saúde
          </Button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Pipeline</p>
              <p className="text-xl font-bold">{loadingKpis ? '...' : formatCurrency(kpis?.pipelineValue || 0)}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs text-muted-foreground">Ganho (Mês)</p>
              <p className="text-xl font-bold text-emerald-500">{loadingKpis ? '...' : formatCurrency(kpis?.wonValue || 0)}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Target className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-muted-foreground">Deals Ganhos</p>
              <p className="text-xl font-bold">{loadingKpis ? '...' : kpis?.wonCount || 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold">{loadingKpis ? '...' : kpis?.winRate || 0}%</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className={`h-6 w-6 mx-auto mb-2 ${getHealthColor(kpis?.avgHealth || 0)}`} />
              <p className="text-xs text-muted-foreground">Saúde Média</p>
              <p className={`text-xl font-bold ${getHealthColor(kpis?.avgHealth || 0)}`}>
                {loadingKpis ? '...' : kpis?.avgHealth || 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-6 w-6 mx-auto text-red-500 mb-2" />
              <p className="text-xs text-muted-foreground">Em Risco</p>
              <p className="text-xl font-bold text-red-500">{dealsAtRisk?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Deals em Risco */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              Deals em Risco
            </CardTitle>
            <CardDescription>Deals com Deal Health crítico que precisam de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRisk ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : dealsAtRisk && dealsAtRisk.length > 0 ? (
              <div className="space-y-3">
                {dealsAtRisk.map((deal: any) => (
                  <div 
                    key={deal.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                  >
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/app/opportunities/${deal.id}`)}
                    >
                      <p className="font-medium truncate">
                        {deal.account?.nome_fantasia || deal.account?.razao_social}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{deal.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(deal.valor_previsto || 0)}</p>
                      {getRiskBadge(deal.risk_score || 0)}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateFollowUpMutation.mutate(deal.id);
                      }}
                      disabled={generateFollowUpMutation.isPending}
                      title="Gerar sugestões de follow-up"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <ArrowRight 
                      className="h-4 w-4 text-muted-foreground cursor-pointer" 
                      onClick={() => navigate(`/app/opportunities/${deal.id}`)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                <p>Nenhum deal em risco!</p>
                <p className="text-sm">Seu pipeline está saudável</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals sem Próximo Passo */}
        <Card className="border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <AlertCircle className="h-5 w-5" />
              Sem Próximo Passo
            </CardTitle>
            <CardDescription>Deals que não têm atividades futuras agendadas</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNoStep ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : dealsNoNextStep && dealsNoNextStep.length > 0 ? (
              <div className="space-y-3">
                {dealsNoNextStep.map((deal: any) => (
                  <div 
                    key={deal.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/opportunities/${deal.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {deal.account?.nome_fantasia || deal.account?.razao_social}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{deal.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(deal.valor_previsto || 0)}</p>
                      <p className="text-xs text-muted-foreground">Sem próximo passo</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                <p>Todos os deals têm próximo passo!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
