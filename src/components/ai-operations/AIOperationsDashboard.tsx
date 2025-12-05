import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Zap, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  PlayCircle,
  RefreshCw,
  Activity,
  Sparkles,
  Bell,
  Timer,
  UserPlus,
  Workflow,
} from 'lucide-react';
import { LeadIngestionPanel } from './LeadIngestionPanel';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useAutomationStats,
  useRecentAutomations,
  useTriggerWorkflowProcessing,
  useTriggerAISuggestionsAutoApply,
  useTriggerStaleOpportunitiesDetection,
} from '@/hooks/useAIOperations';

export function AIOperationsDashboard() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAutomationStats();
  const { data: recentAutomations, isLoading: automationsLoading } = useRecentAutomations(15);
  
  const triggerWorkflows = useTriggerWorkflowProcessing();
  const triggerAISuggestions = useTriggerAISuggestionsAutoApply();
  const triggerStaleDetection = useTriggerStaleOpportunitiesDetection();

  const isAnyLoading = triggerWorkflows.isPending || triggerAISuggestions.isPending || triggerStaleDetection.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            AI Operations Center
          </h2>
          <p className="text-muted-foreground">
            Monitore e controle as operações autônomas do NOIDCRM
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchStats()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <Workflow className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="lead-ingestion" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Lead Ingestion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Workflow Executions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Workflows (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{stats?.workflowExecutions.last24h || 0}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {stats?.workflowExecutions.pending || 0} pendentes
                  </Badge>
                  <Badge variant="default" className="text-xs bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {stats?.workflowExecutions.completed || 0}
                  </Badge>
                  {(stats?.workflowExecutions.failed || 0) > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      {stats?.workflowExecutions.failed}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Sugestões IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{stats?.aiSuggestions.pending || 0}</div>
                <p className="text-xs text-muted-foreground">pendentes para revisão</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="default" className="text-xs bg-green-500">
                    {stats?.aiSuggestions.accepted || 0} aceitas
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {stats?.aiSuggestions.autoApplied || 0} auto-aplicadas
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications Generated */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              Alertas (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {(stats?.notifications.staleOpportunities || 0) + 
                   (stats?.notifications.aiAutoApplied || 0) + 
                   (stats?.notifications.workflowAlerts || 0)}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats?.notifications.staleOpportunities || 0} estagnadas
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stats?.notifications.workflowAlerts || 0} workflows
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRON Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4 text-green-500" />
              Jobs Agendados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold flex items-center gap-2">
                  {stats?.cronJobs.filter(j => j.active).length || 0}
                  <Badge variant="default" className="text-xs bg-green-500">Ativos</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automações rodando em background
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions and Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manual Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Ações Manuais
            </CardTitle>
            <CardDescription>
              Execute automações manualmente para teste ou urgência
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => triggerWorkflows.mutate()}
              disabled={isAnyLoading}
            >
              <Zap className="h-4 w-4 mr-2 text-yellow-500" />
              Processar Workflows Pendentes
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => triggerAISuggestions.mutate()}
              disabled={isAnyLoading}
            >
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              Auto-aplicar Sugestões IA
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => triggerStaleDetection.mutate()}
              disabled={isAnyLoading}
            >
              <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
              Detectar Oportunidades Estagnadas
            </Button>
          </CardContent>
        </Card>

        {/* CRON Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Jobs Agendados
            </CardTitle>
            <CardDescription>
              Automações que rodam periodicamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {stats?.cronJobs.map((job, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${job.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium">{job.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{job.schedule}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
            <CardDescription>
              Últimas ações automatizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {automationsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {recentAutomations?.map((automation) => (
                    <div 
                      key={automation.id} 
                      className="p-2 rounded-md bg-muted/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {automation.title}
                        </span>
                        <Badge 
                          variant={automation.status === 'completed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {automation.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {automation.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(automation.timestamp), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  ))}
                  {(!recentAutomations || recentAutomations.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma atividade recente
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="lead-ingestion">
          <LeadIngestionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
