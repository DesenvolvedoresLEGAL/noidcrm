import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { 
  TrendingUp, 
  Target,
  Users,
  DollarSign,
  AlertTriangle,
  Trophy,
  Activity,
  Sparkles,
  BarChart3,
  TrendingDown,
  Loader2,
  CheckCircle,
  XCircle,
  Lightbulb
} from 'lucide-react';
import { useState } from 'react';

export default function ManagerDashboard() {
  const { user, organization } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forecastData, setForecastData] = useState<any>(null);

  // Buscar membros do time
  const { data: teamMembers, isLoading: loadingTeam } = useQuery({
    queryKey: ['manager-team', organization?.id, user?.id],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return [];
      
      const { data: managedTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('manager_id', user.id);
      
      if (!managedTeams || managedTeams.length === 0) {
        const { data: allMembers } = await supabase
          .from('organization_members')
          .select(`
            user_id,
            profile:profiles(user_id, full_name)
          `)
          .eq('organization_id', organization.id)
          .eq('status', 'active');
        
        return allMembers || [];
      }
      
      const teamIds = managedTeams.map(t => t.id);
      
      const { data: members } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profile:profiles(user_id, full_name)
        `)
        .in('team_id', teamIds);
      
      return members || [];
    },
    enabled: !!organization?.id && !!user?.id
  });

  // Performance por vendedor
  const { data: sellerPerformance, isLoading: loadingPerformance } = useQuery({
    queryKey: ['manager-seller-performance', organization?.id, teamMembers],
    queryFn: async () => {
      if (!organization?.id || !teamMembers || teamMembers.length === 0) return [];
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      const results = [];
      
      for (const member of teamMembers) {
        const userId = member.user_id;
        const userName = (member.profile as any)?.full_name || 'Usuário';
        
        const { data: pipeline } = await supabase
          .from('opportunities')
          .select('valor_previsto')
          .eq('organization_id', organization.id)
          .eq('owner_user_id', userId)
          .not('status', 'in', '("won","lost")');
        
        const pipelineValue = pipeline?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
        
        const { data: won } = await supabase
          .from('opportunities')
          .select('valor_previsto')
          .eq('organization_id', organization.id)
          .eq('owner_user_id', userId)
          .eq('status', 'won')
          .gte('updated_at', startOfMonth);
        
        const wonValue = won?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
        const wonCount = won?.length || 0;
        
        const { count: lostCount } = await supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('owner_user_id', userId)
          .eq('status', 'lost')
          .gte('updated_at', startOfMonth);
        
        const totalClosed = wonCount + (lostCount || 0);
        const winRate = totalClosed > 0 ? Math.round(wonCount / totalClosed * 100) : 0;
        
        const { count: activitiesCount } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('owner_user_id', userId)
          .eq('status', 'completed')
          .gte('completed_at', startOfMonth);
        
        results.push({
          userId,
          name: userName,
          pipelineValue,
          wonValue,
          wonCount,
          winRate,
          activitiesCount: activitiesCount || 0
        });
      }
      
      return results.sort((a, b) => b.wonValue - a.wonValue);
    },
    enabled: !!organization?.id && !!teamMembers && teamMembers.length > 0
  });

  // KPIs do time
  const teamKpis = {
    totalPipeline: sellerPerformance?.reduce((sum, s) => sum + s.pipelineValue, 0) || 0,
    totalWon: sellerPerformance?.reduce((sum, s) => sum + s.wonValue, 0) || 0,
    avgWinRate: sellerPerformance && sellerPerformance.length > 0
      ? Math.round(sellerPerformance.reduce((sum, s) => sum + s.winRate, 0) / sellerPerformance.length)
      : 0,
    totalActivities: sellerPerformance?.reduce((sum, s) => sum + s.activitiesCount, 0) || 0
  };

  // Deals em risco do time
  const { data: teamDealsAtRisk } = useQuery({
    queryKey: ['manager-deals-at-risk', organization?.id, teamMembers],
    queryFn: async () => {
      if (!organization?.id || !teamMembers || teamMembers.length === 0) return [];
      
      const userIds = teamMembers.map(m => m.user_id);
      
      const { data, error } = await (supabase as any)
        .from('opportunities')
        .select(`
          id, titulo, valor_previsto, risk_score,
          account:accounts(nome_fantasia, razao_social),
          owner:profiles!opportunities_owner_user_id_fkey(full_name)
        `)
        .eq('organization_id', organization.id)
        .in('owner_user_id', userIds)
        .not('status', 'in', '("won","lost")')
        .gte('risk_score', 60)
        .order('risk_score', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id && !!teamMembers && teamMembers.length > 0
  });

  // Forecast mutation
  const forecastMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');
      
      const response = await supabase.functions.invoke('generate-forecast-prediction', {
        body: { organization_id: organization?.id }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setForecastData(data.forecast);
      toast({ title: 'Forecast gerado com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao gerar forecast', variant: 'destructive' });
      console.error(error);
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Layout>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header Premium */}
      <div className="flex flex-col gap-4">
        <DashboardHeader
          role="manager"
          title="Painel do Gestor"
          subtitle="Performance do time, forecast e deals em risco"
        />
        <div className="flex justify-end">
          <Button 
            onClick={() => forecastMutation.mutate()}
            disabled={forecastMutation.isPending}
          >
            {forecastMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Gerar Forecast IA
          </Button>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline do Time</p>
                <p className="text-xl font-bold">{formatCurrency(teamKpis.totalPipeline)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Trophy className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ganho (Mês)</p>
                <p className="text-xl font-bold text-emerald-500">{formatCurrency(teamKpis.totalWon)}</p>
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
                <p className="text-sm text-muted-foreground">Win Rate Médio</p>
                <p className="text-xl font-bold">{teamKpis.avgWinRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atividades</p>
                <p className="text-xl font-bold">{teamKpis.totalActivities}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Section */}
      {forecastData && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Forecast AI - Trimestre Atual
            </CardTitle>
            <CardDescription>
              {forecastData.periodStart} a {forecastData.periodEnd} • Confiança: {forecastData.confidence}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scenarios */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">Pessimista</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(forecastData.scenarios.pessimistic)}</p>
              </div>
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Realista</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(forecastData.scenarios.realistic)}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-500">Otimista</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(forecastData.scenarios.optimistic)}</p>
              </div>
            </div>

            {/* AI Reasoning */}
            {forecastData.aiReasoning && (
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Análise da IA:</p>
                <p className="text-sm text-muted-foreground">{forecastData.aiReasoning}</p>
              </div>
            )}

            {/* Factors & Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              {forecastData.factors && forecastData.factors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fatores Identificados:</p>
                  {forecastData.factors.slice(0, 4).map((factor: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {factor.type === 'positive' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      ) : factor.type === 'negative' ? (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      )}
                      <span className="text-muted-foreground">{factor.description}</span>
                    </div>
                  ))}
                </div>
              )}

              {forecastData.recommendations && forecastData.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Recomendações:</p>
                  {forecastData.recommendations.slice(0, 4).map((rec: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{rec.action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ranking do Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Performance do Time
            </CardTitle>
            <CardDescription>Ranking por receita ganha no mês</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPerformance ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : sellerPerformance && sellerPerformance.length > 0 ? (
              <div className="space-y-3">
                {sellerPerformance.map((seller, index) => (
                  <div 
                    key={seller.userId}
                    className="flex items-center gap-4 p-3 rounded-lg border"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(seller.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{seller.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Pipeline: {formatCurrency(seller.pipelineValue)}</span>
                        <span>•</span>
                        <span>WR: {seller.winRate}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">{formatCurrency(seller.wonValue)}</p>
                      <p className="text-xs text-muted-foreground">{seller.wonCount} deals</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum membro do time encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals em Risco do Time */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Deals em Risco
            </CardTitle>
            <CardDescription>Deals do time que precisam de atenção</CardDescription>
          </CardHeader>
          <CardContent>
            {teamDealsAtRisk && teamDealsAtRisk.length > 0 ? (
              <div className="space-y-3">
                {teamDealsAtRisk.map((deal: any) => (
                  <div 
                    key={deal.id}
                    className="p-3 rounded-lg border border-red-500/20 bg-red-500/5"
                  >
                    <p className="font-medium truncate">
                      {deal.account?.nome_fantasia || deal.account?.razao_social}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{deal.titulo}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{(deal.owner as any)?.full_name}</span>
                      <Badge variant="destructive">Risco: {deal.risk_score}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
                <p className="text-sm">Nenhum deal em risco!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </Layout>
  );
}
