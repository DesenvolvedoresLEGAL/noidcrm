import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target, 
  Phone, 
  Mail, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function SDRCommandCenter() {
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Buscar leads priorizados (ai_scores com tipo lead_prioritization)
  const { data: prioritizedLeads, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['sdr-prioritized-leads', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_scores')
        .select(`
          *,
          opportunity:opportunities(
            id, title, valor_previsto, temperature,
            account:accounts(id, nome_fantasia, razao_social, lead_grade),
            contact:contacts(id, nome, cargo)
          )
        `)
        .eq('organization_id', organization.id)
        .eq('entity_type', 'opportunity')
        .eq('score_type', 'lead_prioritization')
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id
  });

  // Buscar atividades do dia
  const { data: todayActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ['sdr-today-activities', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social),
          opportunity:opportunities(id, title)
        `)
        .eq('owner_user_id', user.id)
        .gte('scheduled_date', today)
        .lt('scheduled_date', today + 'T23:59:59')
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Buscar follow-ups atrasados
  const { data: overdueFollowups, isLoading: loadingOverdue } = useQuery({
    queryKey: ['sdr-overdue-followups', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          account:accounts(id, nome_fantasia, razao_social),
          opportunity:opportunities(id, title)
        `)
        .eq('owner_user_id', user.id)
        .eq('status', 'scheduled')
        .lt('scheduled_date', today)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // KPIs do SDR
  const { data: kpis } = useQuery({
    queryKey: ['sdr-kpis', user?.id],
    queryFn: async () => {
      if (!user?.id || !organization?.id) return null;
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      
      // Contagem de atividades do mês
      const { count: activitiesCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .gte('created_at', startOfMonth);
      
      // Contagem de atividades completadas
      const { count: completedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth);
      
      // Oportunidades criadas no mês
      const { count: oppsCreated } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .gte('created_at', startOfMonth);
      
      return {
        activitiesCount: activitiesCount || 0,
        completedCount: completedCount || 0,
        oppsCreated: oppsCreated || 0,
        completionRate: activitiesCount ? Math.round((completedCount || 0) / activitiesCount * 100) : 0
      };
    },
    enabled: !!user?.id && !!organization?.id
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchLeads();
    setIsRefreshing(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'B': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'C': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'D': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SDR Command Center</h1>
          <p className="text-muted-foreground">
            Sua central de comando para prospecção e qualificação
          </p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar IA
        </Button>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opps Criadas</p>
                <p className="text-2xl font-bold">{kpis?.oppsCreated || 0}</p>
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
                <p className="text-sm text-muted-foreground">Atividades</p>
                <p className="text-2xl font-bold">{kpis?.completedCount || 0}/{kpis?.activitiesCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold text-yellow-500">{overdueFollowups?.length || 0}</p>
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
                <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
                <p className="text-2xl font-bold">{kpis?.completionRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top 10 Leads Prioritários */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Top 10 Leads do Dia
              </CardTitle>
              <CardDescription>Priorizados por IA com base em FitScore e Intent</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : prioritizedLeads && prioritizedLeads.length > 0 ? (
              <div className="space-y-2">
                {prioritizedLeads.map((lead: any, index: number) => (
                  <div 
                    key={lead.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/app/opportunities/${lead.entity_id}`)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {lead.opportunity?.account?.nome_fantasia || lead.opportunity?.account?.razao_social || 'Sem conta'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {lead.opportunity?.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.opportunity?.account?.lead_grade && (
                        <Badge variant="outline" className={getGradeBadgeColor(lead.opportunity.account.lead_grade)}>
                          {lead.opportunity.account.lead_grade}
                        </Badge>
                      )}
                      <Badge variant="secondary">{lead.score}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum lead priorizado ainda</p>
                <p className="text-sm">Clique em "Atualizar IA" para gerar priorização</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividades do Dia + Atrasadas */}
        <div className="space-y-6">
          {/* Atividades Atrasadas */}
          {overdueFollowups && overdueFollowups.length > 0 && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                  Follow-ups Atrasados ({overdueFollowups.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueFollowups.slice(0, 5).map((activity: any) => (
                    <div 
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5"
                    >
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.account?.nome_fantasia || activity.account?.razao_social}
                        </p>
                      </div>
                      <span className="text-xs text-yellow-500">
                        {format(new Date(activity.scheduled_date), 'dd/MM', { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Atividades de Hoje */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Atividades de Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivities ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : todayActivities && todayActivities.length > 0 ? (
                <div className="space-y-2">
                  {todayActivities.map((activity: any) => (
                    <div 
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className={`p-1.5 rounded ${activity.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted'}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.account?.nome_fantasia || activity.account?.razao_social}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.scheduled_date), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma atividade agendada para hoje</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
