import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Heart,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

interface CSMetrics {
  activeClients: number;
  pendingOnboarding: number;
  scheduledActivities: number;
  completedToday: number;
}

interface RecentOpportunity {
  id: string;
  title: string;
  account_name: string;
  stage_name: string;
  valor_previsto: number;
}

export function CSDashboard() {
  const { profile, organization } = useCurrentUser();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<CSMetrics>({
    activeClients: 0,
    pendingOnboarding: 0,
    scheduledActivities: 0,
    completedToday: 0,
  });
  const [recentOpportunities, setRecentOpportunities] = useState<RecentOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization?.id) {
      fetchMetrics();
      fetchRecentOpportunities();
    }
  }, [organization?.id]);

  const fetchMetrics = async () => {
    try {
      // Fetch CS pipeline opportunities
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization!.id)
        .ilike('name', '%cs%');

      const csPipelineIds = pipelines?.map(p => p.id) || [];

      if (csPipelineIds.length > 0) {
        // Active clients in CS pipelines
        const { count: activeClients } = await supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization!.id)
          .in('pipeline_id', csPipelineIds)
          .eq('status', 'open');

        // Pending onboarding (first stages)
        const { data: firstStages } = await supabase
          .from('stages')
          .select('id')
          .in('pipeline_id', csPipelineIds)
          .lte('order_index', 1);

        const firstStageIds = firstStages?.map(s => s.id) || [];

        const { count: pendingOnboarding } = await supabase
          .from('opportunities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization!.id)
          .in('stage_id', firstStageIds)
          .eq('status', 'open');

        setMetrics(prev => ({
          ...prev,
          activeClients: activeClients || 0,
          pendingOnboarding: pendingOnboarding || 0,
        }));
      }

      // Fetch activities
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: scheduledActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization!.id)
        .gte('scheduled_date', today.toISOString())
        .is('completed_at', null);

      const { count: completedToday } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization!.id)
        .gte('completed_at', today.toISOString());

      setMetrics(prev => ({
        ...prev,
        scheduledActivities: scheduledActivities || 0,
        completedToday: completedToday || 0,
      }));
    } catch (error) {
      console.error('Error fetching CS metrics:', error);
    }
  };

  const fetchRecentOpportunities = async () => {
    try {
      setLoading(true);
      
      // Find CS pipelines
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organization!.id)
        .ilike('name', '%cs%');

      const csPipelineIds = pipelines?.map(p => p.id) || [];

      if (csPipelineIds.length > 0) {
        const { data } = await supabase
          .from('opportunities')
          .select(`
            id,
            title,
            valor_previsto,
            accounts(razao_social, nome_fantasia),
            stages(name)
          `)
          .eq('organization_id', organization!.id)
          .in('pipeline_id', csPipelineIds)
          .eq('status', 'open')
          .order('updated_at', { ascending: false })
          .limit(5);

        const formatted = data?.map(opp => ({
          id: opp.id,
          title: opp.title,
          account_name: (opp.accounts as any)?.nome_fantasia || (opp.accounts as any)?.razao_social || 'Sem conta',
          stage_name: (opp.stages as any)?.name || 'Sem etapa',
          valor_previsto: opp.valor_previsto || 0,
        })) || [];

        setRecentOpportunities(formatted);
      }
    } catch (error) {
      console.error('Error fetching recent opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const kpis = [
    {
      title: 'Clientes Ativos',
      value: metrics.activeClients,
      icon: Users,
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
    },
    {
      title: 'Em Onboarding',
      value: metrics.pendingOnboarding,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Atividades Pendentes',
      value: metrics.scheduledActivities,
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Concluídas Hoje',
      value: metrics.completedToday,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-6 space-y-6"
    >
      <DashboardHeader
        role="cs"
        title="Customer Success"
        subtitle="Fidelização e sucesso do cliente"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card className="relative overflow-hidden backdrop-blur-xl bg-card/50 border-border/50 hover:shadow-lg transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.title}</p>
                    <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${kpi.bgColor} group-hover:scale-110 transition-transform`}>
                    <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${kpi.bgColor}`} />
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Clients */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="backdrop-blur-xl bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-teal-500" />
                Clientes Recentes
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/app/opportunities')}
              >
                Ver todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentOpportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum cliente no pipeline de CS</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOpportunities.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => navigate(`/app/opportunities/${opp.id}`)}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div>
                        <p className="font-medium">{opp.title}</p>
                        <p className="text-sm text-muted-foreground">{opp.account_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30">
                          {opp.stage_name}
                        </Badge>
                        {opp.valor_previsto > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_previsto)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <Card className="backdrop-blur-xl bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/app/activities')}
              >
                <Activity className="h-4 w-4" />
                Ver Atividades
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/app/opportunities')}
              >
                <Users className="h-4 w-4" />
                Pipeline CS
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/app/accounts')}
              >
                <TrendingUp className="h-4 w-4" />
                Contas
              </Button>
            </CardContent>
          </Card>

          {/* Alerts Card */}
          <Card className="mt-4 backdrop-blur-xl bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.pendingOnboarding > 0 ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm">
                    <span className="font-semibold text-amber-600">{metrics.pendingOnboarding}</span> cliente(s) aguardando onboarding
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum alerta no momento
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}