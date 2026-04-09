import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DashboardHeader } from '@/components/dashboards/shared/DashboardHeader';
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
  Sparkles,
  Play,
  BookOpen,
  Loader2,
  MessageSquare,
  ChevronRight,
  Lightbulb,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function SDRCommandCenter() {
  const { user, organization } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [playbookSuggestion, setPlaybookSuggestion] = useState<any>(null);

  // Buscar leads priorizados
  const { data: prioritizedLeads, isLoading: loadingLeads } = useQuery({
    queryKey: ['sdr-prioritized-leads', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_scores')
        .select(`
          *,
          opportunity:opportunities(
            id, titulo, valor_previsto, temperature, origem,
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

  // Buscar playbooks disponíveis
  const { data: playbooks, isLoading: loadingPlaybooks } = useQuery({
    queryKey: ['sdr-playbooks', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('ai_playbooks')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('success_rate', { ascending: false });
      
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
          opportunity:opportunities(id, titulo)
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
          opportunity:opportunities(id, titulo)
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
      
      const { count: activitiesCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .gte('created_at', startOfMonth);
      
      const { count: completedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth);
      
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

  // Mutation para gerar priorização via IA
  const generatePrioritization = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-lead-prioritization');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Priorização atualizada', description: data.message || 'Leads priorizados com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['sdr-prioritized-leads'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao priorizar', variant: 'destructive' });
    }
  });

  // Mutation para criar tarefas automáticas
  const createAutoTasks = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('auto-task-creator');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Tarefas criadas', description: `${data.tasks_created || 0} tarefas geradas` });
      queryClient.invalidateQueries({ queryKey: ['sdr-today-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-overdue-followups'] });
    },
    onError: () => {
      toast({ title: 'Erro ao criar tarefas', variant: 'destructive' });
    }
  });

  // Mutation para sugerir playbook
  const suggestPlaybook = useMutation({
    mutationFn: async (opportunityId: string) => {
      const { data, error } = await supabase.functions.invoke('suggest-playbook', {
        body: { opportunity_id: opportunityId, organization_id: organization?.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setPlaybookSuggestion(data);
      toast({ title: 'Playbook sugerido!' });
    },
    onError: () => {
      toast({ title: 'Erro ao sugerir playbook', variant: 'destructive' });
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await generatePrioritization.mutateAsync();
    setIsRefreshing(false);
  };

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead);
    setPlaybookSuggestion(null);
    if (lead?.entity_id) {
      suggestPlaybook.mutate(lead.entity_id);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
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

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header Premium */}
      <div className="flex flex-col gap-4">
        <DashboardHeader
          role="sales"
          title="SDR Command Center"
          subtitle="Sua central de comando para prospecção e qualificação"
        />
        <div className="flex justify-end gap-2">
          <Button onClick={() => createAutoTasks.mutate()} variant="outline" size="sm" disabled={createAutoTasks.isPending}>
            <Play className={`h-4 w-4 mr-2 ${createAutoTasks.isPending ? 'animate-pulse' : ''}`} />
            Criar Tarefas
          </Button>
          <Button onClick={handleRefresh} size="sm" disabled={isRefreshing || generatePrioritization.isPending}>
            <Sparkles className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Priorizar Leads
          </Button>
        </div>
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

      {/* Main Content - Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads" className="gap-2">
            <Zap className="h-4 w-4" />
            Leads Priorizados
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Playbooks
          </TabsTrigger>
          <TabsTrigger value="activities" className="gap-2">
            <Calendar className="h-4 w-4" />
            Atividades
          </TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Lista de Leads */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Top 10 Leads do Dia
                </CardTitle>
                <CardDescription>Clique para ver playbook sugerido</CardDescription>
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
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedLead?.id === lead.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => handleSelectLead(lead)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {lead.opportunity?.account?.nome_fantasia || lead.opportunity?.account?.razao_social || 'Sem conta'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {lead.opportunity?.titulo}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {lead.opportunity?.origem === 'lead_sourcing' && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                              🐕 Caramelo
                            </Badge>
                          )}
                          {lead.opportunity?.account?.lead_grade && (
                            <Badge variant="outline" className={getGradeBadgeColor(lead.opportunity.account.lead_grade)}>
                              {lead.opportunity.account.lead_grade}
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum lead priorizado ainda</p>
                    <Button variant="link" onClick={handleRefresh} className="mt-2">
                      Gerar priorização com IA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Playbook Sugerido */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Playbook Sugerido
                </CardTitle>
                <CardDescription>
                  {selectedLead 
                    ? `Para: ${selectedLead.opportunity?.account?.nome_fantasia || selectedLead.opportunity?.titulo}`
                    : 'Selecione um lead para ver sugestão'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {suggestPlaybook.isPending ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : playbookSuggestion?.aiSuggestion ? (
                  <div className="space-y-4">
                    {/* Success Probability */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium">Probabilidade de Sucesso</span>
                      <Badge variant={playbookSuggestion.aiSuggestion.success_probability >= 70 ? 'default' : 'secondary'}>
                        {playbookSuggestion.aiSuggestion.success_probability}%
                      </Badge>
                    </div>

                    {/* Reason */}
                    {playbookSuggestion.aiSuggestion.recommendation_reason && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm">{playbookSuggestion.aiSuggestion.recommendation_reason}</p>
                      </div>
                    )}

                    {/* Steps */}
                    {playbookSuggestion.aiSuggestion.suggested_steps?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Passos Recomendados:</p>
                        {playbookSuggestion.aiSuggestion.suggested_steps.map((step: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded border">
                            <div className="p-1.5 rounded bg-muted">
                              {getChannelIcon(step.channel)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{step.action}</p>
                              {step.script_hint && (
                                <p className="text-xs text-muted-foreground mt-1">{step.script_hint}</p>
                              )}
                              <p className="text-xs text-primary mt-1">{step.timing}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Talking Points */}
                    {playbookSuggestion.aiSuggestion.key_talking_points?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          Pontos Chave
                        </p>
                        <ul className="space-y-1">
                          {playbookSuggestion.aiSuggestion.key_talking_points.map((point: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Objection Handlers */}
                    {playbookSuggestion.aiSuggestion.objection_handlers?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          Como Tratar Objeções
                        </p>
                        {playbookSuggestion.aiSuggestion.objection_handlers.slice(0, 3).map((obj: any, idx: number) => (
                          <div key={idx} className="p-2 rounded bg-muted/50 text-sm">
                            <p className="font-medium text-red-400">"{obj.objection}"</p>
                            <p className="text-muted-foreground mt-1">→ {obj.response}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Button */}
                    <Button 
                      className="w-full" 
                      onClick={() => navigate(`/app/opportunities/${selectedLead?.entity_id}`)}
                    >
                      Abrir Oportunidade
                    </Button>
                  </div>
                ) : selectedLead ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma sugestão disponível</p>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Selecione um lead à esquerda</p>
                    <p className="text-sm">para ver o playbook sugerido pela IA</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Playbooks Tab */}
        <TabsContent value="playbooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Biblioteca de Playbooks
              </CardTitle>
              <CardDescription>Playbooks de vendas da organização</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlaybooks ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : playbooks && playbooks.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {playbooks.map((pb: any) => (
                    <div key={pb.id} className="p-4 rounded-lg border hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{pb.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{pb.description}</p>
                        </div>
                        {pb.is_ai_generated && (
                          <Badge variant="outline" className="shrink-0">
                            <Sparkles className="h-3 w-3 mr-1" />
                            IA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {pb.success_rate}% sucesso
                        </span>
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {pb.usage_count}x usado
                        </span>
                        {pb.target_temperature && (
                          <Badge variant="secondary" className="text-xs">
                            {pb.target_temperature}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum playbook cadastrado</p>
                  <p className="text-sm">Os playbooks serão criados automaticamente pela IA</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Atividades Atrasadas */}
            <Card className={overdueFollowups && overdueFollowups.length > 0 ? 'border-yellow-500/30' : ''}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                  Follow-ups Atrasados ({overdueFollowups?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOverdue ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : overdueFollowups && overdueFollowups.length > 0 ? (
                  <div className="space-y-2">
                    {overdueFollowups.map((activity: any) => (
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
                    <p className="text-sm">Nenhum follow-up atrasado!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Atividades de Hoje */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Atividades de Hoje ({todayActivities?.length || 0})
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma atividade agendada para hoje</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
