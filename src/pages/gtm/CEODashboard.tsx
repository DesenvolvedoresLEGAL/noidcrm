import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Zap,
  Calendar,
  BarChart3
} from 'lucide-react';

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
      
      // ARR estimado baseado em receita anual
      const totalMRR = 0; // MRR será implementado quando houver campo
      const arr = 0;
      
      // Receita do mês
      const { data: revenueMonth } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfMonth);
      
      const monthlyRevenue = revenueMonth?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Receita do ano
      const { data: revenueYear } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfYear);
      
      const yearlyRevenue = revenueYear?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Pipeline total
      const { data: pipeline } = await supabase
        .from('opportunities')
        .select('valor_previsto, win_probability_ai')
        .eq('organization_id', organization.id)
        .not('status', 'in', '("won","lost")');
      
      const pipelineValue = pipeline?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const weightedPipeline = pipeline?.reduce((sum, o) => {
        const prob = o.win_probability_ai || 50;
        return sum + ((o.valor_previsto || 0) * prob / 100);
      }, 0) || 0;
      
      // Quantidade de clientes
      const { count: clientsCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('lifecycle_stage', 'Cliente');
      
      // Win rate
      const { count: wonCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfYear);
      
      const { count: lostCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'lost')
        .gte('updated_at', startOfYear);
      
      const totalClosed = (wonCount || 0) + (lostCount || 0);
      const winRate = totalClosed > 0 ? Math.round((wonCount || 0) / totalClosed * 100) : 0;
      
      // Ticket médio
      const avgTicket = (wonCount || 0) > 0 ? yearlyRevenue / (wonCount || 1) : 0;
      
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
        dealsWon: wonCount || 0
      };
    },
    enabled: !!organization?.id
  });

  // Forecast por cenário
  const { data: forecast } = useQuery({
    queryKey: ['ceo-forecast', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const { data: pipeline } = await supabase
        .from('opportunities')
        .select('valor_previsto, win_probability_ai, close_date_prevista')
        .eq('organization_id', organization.id)
        .not('status', 'in', '("won","lost")');
      
      if (!pipeline) return null;
      
      // Cenário pessimista (prob >= 70%)
      const pessimistic = pipeline
        .filter(o => (o.win_probability_ai || 0) >= 70)
        .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      
      // Cenário realista (ponderado)
      const realistic = pipeline.reduce((sum, o) => {
        const prob = o.win_probability_ai || 50;
        return sum + ((o.valor_previsto || 0) * prob / 100);
      }, 0);
      
      // Cenário otimista (todos)
      const optimistic = pipeline.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      
      return { pessimistic, realistic, optimistic };
    },
    enabled: !!organization?.id
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  };

  return (
    <Layout>
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Premium */}
      <DashboardHeader
        role="owner"
        title="CEO Dashboard"
        subtitle="Visão estratégica de receita e crescimento"
      />

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="text-center">
              <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">ARR</p>
              <p className="text-3xl font-bold">{isLoading ? '...' : formatCurrency(kpis?.arr || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                MRR: {formatCurrency(kpis?.mrr || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <DollarSign className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm text-muted-foreground">Receita Anual</p>
              <p className="text-3xl font-bold text-emerald-500">
                {isLoading ? '...' : formatCurrency(kpis?.yearlyRevenue || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Mês: {formatCurrency(kpis?.monthlyRevenue || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground">Pipeline</p>
              <p className="text-3xl font-bold">{isLoading ? '...' : formatCurrency(kpis?.pipelineValue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ponderado: {formatCurrency(kpis?.weightedPipeline || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <p className="text-sm text-muted-foreground">Clientes</p>
              <p className="text-3xl font-bold">{isLoading ? '...' : kpis?.clientsCount || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ticket Médio: {formatCurrency(kpis?.avgTicket || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Target className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold">{kpis?.winRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals Ganhos</p>
                <p className="text-xl font-bold">{kpis?.dealsWon || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Forecast (Realista)</p>
                <p className="text-xl font-bold">{formatCurrency(forecast?.realistic || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Forecast (Otimista)</p>
                <p className="text-xl font-bold">{formatCurrency(forecast?.optimistic || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cenários de Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Cenários de Forecast</CardTitle>
          <CardDescription>Projeção de receita baseada em probabilidade de fechamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-lg bg-red-500/5 border border-red-500/20">
              <TrendingDown className="h-10 w-10 mx-auto text-red-500 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Pessimista</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(forecast?.pessimistic || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Apenas deals com prob ≥ 70%</p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <Target className="h-10 w-10 mx-auto text-blue-500 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Realista</p>
              <p className="text-2xl font-bold text-blue-500">{formatCurrency(forecast?.realistic || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Ponderado por probabilidade IA</p>
            </div>
            
            <div className="text-center p-6 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <TrendingUp className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Otimista</p>
              <p className="text-2xl font-bold text-emerald-500">{formatCurrency(forecast?.optimistic || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Todo o pipeline</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle>Top Oportunidades Estratégicas</CardTitle>
          <CardDescription>Maiores deals em andamento no pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          {topOpportunities && topOpportunities.length > 0 ? (
            <div className="space-y-3">
              {topOpportunities.map((opp: any, index: number) => (
                <div 
                  key={opp.id}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
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
                    <p className="text-xl font-bold">{formatCurrency(opp.valor_previsto || 0)}</p>
                    <div className="flex items-center gap-2 justify-end">
                      <Badge variant="secondary">{opp.win_probability_ai || 50}% prob</Badge>
                      {opp.close_date_prevista && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(opp.close_date_prevista)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma oportunidade no pipeline</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </Layout>
  );
}
