import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  Users,
  BarChart3,
  Activity,
  Zap
} from 'lucide-react';

export default function RevOpsCockpit() {
  const { organization } = useCurrentUser();

  // KPIs gerais
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['revops-kpis', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).toISOString();
      
      // Pipeline total
      const { data: pipelineData } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .not('status', 'in', '("won","lost")');
      
      const pipelineValue = pipelineData?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const pipelineMRR = 0; // MRR será implementado quando houver campo
      
      // Receita ganha no mês
      const { data: wonThisMonth } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfMonth);
      
      const revenueThisMonth = wonThisMonth?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Receita ganha mês passado
      const { data: wonLastMonth } = await supabase
        .from('opportunities')
        .select('valor_previsto')
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfLastMonth)
        .lte('updated_at', endOfLastMonth);
      
      const revenueLastMonth = wonLastMonth?.reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      
      // Win rate
      const { count: wonCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'won')
        .gte('updated_at', startOfMonth);
      
      const { count: lostCount } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'lost')
        .gte('updated_at', startOfMonth);
      
      const totalClosed = (wonCount || 0) + (lostCount || 0);
      const winRate = totalClosed > 0 ? Math.round((wonCount || 0) / totalClosed * 100) : 0;
      
      // Leads criados no mês (oportunidades novas)
      const { count: leadsCreated } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .gte('created_at', startOfMonth);
      
      // Deal Health médio
      const { data: healthData } = await supabase
        .from('opportunities')
        .select('engagement_score, velocity_score, risk_score')
        .eq('organization_id', organization.id)
        .not('status', 'in', '("won","lost")');
      
      let avgDealHealth = 0;
      if (healthData && healthData.length > 0) {
        const healthScores = healthData.map(d => {
          const engagement = d.engagement_score || 50;
          const velocity = d.velocity_score || 50;
          const risk = 100 - (d.risk_score || 50);
          return (engagement + velocity + risk) / 3;
        });
        avgDealHealth = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length);
      }
      
      // LVR (Lead Velocity Rate)
      const { count: leadsLastMonth } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .gte('created_at', startOfLastMonth)
        .lte('created_at', endOfLastMonth);
      
      const lvr = leadsLastMonth && leadsLastMonth > 0 
        ? Math.round(((leadsCreated || 0) - leadsLastMonth) / leadsLastMonth * 100)
        : 0;
      
      return {
        pipelineValue,
        pipelineMRR,
        revenueThisMonth,
        revenueLastMonth,
        revenueGrowth: revenueLastMonth > 0 
          ? Math.round((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100) 
          : 0,
        winRate,
        leadsCreated: leadsCreated || 0,
        lvr,
        avgDealHealth,
        dealsInPipeline: pipelineData?.length || 0
      };
    },
    enabled: !!organization?.id
  });

  // Win/Loss por motivo
  const { data: lossReasons } = useQuery({
    queryKey: ['revops-loss-reasons', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('win_loss_records')
        .select(`
          outcome,
          reason_seller,
          competitor
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Agrupar por motivo
      const reasonCounts: Record<string, number> = {};
      data?.forEach(r => {
        const reason = r.reason_seller || 'Não informado';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      
      return Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    enabled: !!organization?.id
  });

  // Conversão por ICP/Segmento
  const { data: conversionBySegment } = useQuery({
    queryKey: ['revops-conversion-segment', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data: opps, error } = await supabase
        .from('opportunities')
        .select(`
          status,
          account:accounts(segmento)
        `)
        .eq('organization_id', organization.id)
        .in('status', ['won', 'lost']);
      
      if (error) throw error;
      
      // Agrupar por segmento
      const segmentStats: Record<string, { won: number; lost: number }> = {};
      opps?.forEach(opp => {
        const segment = (opp.account as any)?.segmento || 'Não definido';
        if (!segmentStats[segment]) {
          segmentStats[segment] = { won: 0, lost: 0 };
        }
        if (opp.status === 'won') segmentStats[segment].won++;
        else segmentStats[segment].lost++;
      });
      
      return Object.entries(segmentStats)
        .map(([segment, stats]) => ({
          segment,
          won: stats.won,
          lost: stats.lost,
          total: stats.won + stats.lost,
          winRate: Math.round(stats.won / (stats.won + stats.lost) * 100)
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
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

  const getHealthColor = (health: number) => {
    if (health >= 70) return 'text-emerald-500';
    if (health >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">RevOps Cockpit</h1>
        <p className="text-muted-foreground">
          Visão unificada de métricas de receita e performance GTM
        </p>
      </div>

      {/* KPIs Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Total</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : formatCurrency(kpis?.pipelineValue || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              MRR: {formatCurrency(kpis?.pipelineMRR || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita (Mês)</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {isLoading ? '...' : formatCurrency(kpis?.revenueThisMonth || 0)}
                </p>
              </div>
              {kpis?.revenueGrowth && kpis.revenueGrowth > 0 ? (
                <TrendingUp className="h-8 w-8 text-emerald-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis?.revenueGrowth || 0}% vs mês anterior
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : kpis?.winRate || 0}%</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <Progress value={kpis?.winRate || 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deal Health</p>
                <p className={`text-2xl font-bold ${getHealthColor(kpis?.avgDealHealth || 0)}`}>
                  {isLoading ? '...' : kpis?.avgDealHealth || 0}%
                </p>
              </div>
              <Activity className={`h-8 w-8 ${getHealthColor(kpis?.avgDealHealth || 0)}`} />
            </div>
            <Progress value={kpis?.avgDealHealth || 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* KPIs Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Criados</p>
                <p className="text-xl font-bold">{kpis?.leadsCreated || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LVR</p>
                <p className={`text-xl font-bold ${(kpis?.lvr || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {kpis?.lvr || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deals no Pipeline</p>
                <p className="text-xl font-bold">{kpis?.dealsInPipeline || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mês Anterior</p>
                <p className="text-xl font-bold">{formatCurrency(kpis?.revenueLastMonth || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Loss Reasons */}
        <Card>
          <CardHeader>
            <CardTitle>Top Motivos de Perda</CardTitle>
            <CardDescription>Principais razões de deals perdidos</CardDescription>
          </CardHeader>
          <CardContent>
            {lossReasons && lossReasons.length > 0 ? (
              <div className="space-y-4">
                {lossReasons.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.reason}</p>
                      <Progress value={(item.count / (lossReasons[0]?.count || 1)) * 100} className="h-2 mt-1" />
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum dado de perda registrado ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion by Segment */}
        <Card>
          <CardHeader>
            <CardTitle>Win Rate por Segmento</CardTitle>
            <CardDescription>Taxa de conversão por ICP/Segmento</CardDescription>
          </CardHeader>
          <CardContent>
            {conversionBySegment && conversionBySegment.length > 0 ? (
              <div className="space-y-4">
                {conversionBySegment.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{item.segment}</p>
                        <span className="text-sm text-muted-foreground">
                          {item.won}/{item.total}
                        </span>
                      </div>
                      <Progress value={item.winRate} className="h-2" />
                    </div>
                    <Badge 
                      variant="secondary"
                      className={item.winRate >= 50 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}
                    >
                      {item.winRate}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum dado de conversão ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
