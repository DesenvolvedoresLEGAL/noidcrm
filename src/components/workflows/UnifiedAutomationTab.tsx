import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Zap,
  Activity,
  CheckCircle2,
  Bot,
  TrendingUp,
  Mail,
  MessageSquare,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  useWorkflowRules,
  useToggleWorkflowRule,
  useDeleteWorkflowRule,
  useDuplicateWorkflowRule,
  useWorkflowExecutions,
} from '@/hooks/useWorkflowRules';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS, WorkflowRule } from '@/services/crm/workflow-rules';
import { WorkflowRuleModal } from './WorkflowRuleModal';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutomationLog {
  id: string;
  opportunity_id: string;
  action_type: string;
  channel: string;
  message_content?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  metadata?: any;
}

export function UnifiedAutomationTab() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<WorkflowRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [testingAI, setTestingAI] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const { data: rules = [], isLoading } = useWorkflowRules();
  const { data: executions = [] } = useWorkflowExecutions({ limit: 100 });
  const toggleMutation = useToggleWorkflowRule();
  const deleteMutation = useDeleteWorkflowRule();
  const duplicateMutation = useDuplicateWorkflowRule();

  const activeRules = rules.filter((r) => r.is_active).length;
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((e) => e.status === 'completed').length;
  const successRate = totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0;

  useEffect(() => {
    fetchAutomationLogs();
  }, []);

  const fetchAutomationLogs = async () => {
    try {
      setLogsLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData, error } = await supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(logsData || []);
    } catch (error) {
      console.error('Error fetching automation logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleEdit = (rule: WorkflowRule) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
    setDeleteConfirmId(null);
  };

  const testAIGeneration = async () => {
    setTestingAI(true);
    try {
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!opportunities) {
        toast({
          title: 'Aviso',
          description: 'Nenhuma oportunidade encontrada para teste',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('ai-generate-message', {
        body: {
          opportunityId: opportunities.id,
          channel: 'whatsapp',
          context: 'Teste de geração de mensagem',
        },
      });

      if (error) throw error;

      toast({
        title: 'Mensagem Gerada',
        description: data.message?.substring(0, 100) + '...',
      });
    } catch (error) {
      console.error('Error testing AI:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar mensagem de teste',
        variant: 'destructive',
      });
    } finally {
      setTestingAI(false);
    }
  };

  const recalculateScores = async () => {
    try {
      toast({
        title: 'Recalculando...',
        description: 'Atualizando scores de todas as oportunidades',
      });

      const { data, error } = await supabase.functions.invoke('recalculate-scores');

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `${data.updated} oportunidades atualizadas`,
      });

      fetchAutomationLogs();
    } catch (error) {
      console.error('Error recalculating scores:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível recalcular scores',
        variant: 'destructive',
      });
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'email_sent':
        return <Mail className="h-4 w-4" />;
      case 'whatsapp_sent':
        return <MessageSquare className="h-4 w-4" />;
      case 'task_created':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'score_updated':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      email_sent: 'Email Enviado',
      whatsapp_sent: 'WhatsApp Enviado',
      task_created: 'Tarefa Criada',
      score_updated: 'Score Atualizado',
      sequence_enrolled: 'Sequência Iniciada',
    };
    return labels[actionType] || actionType;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: { variant: 'default', icon: CheckCircle2 },
      success: { variant: 'default', icon: CheckCircle2 },
      pending: { variant: 'secondary', icon: Clock },
      failed: { variant: 'destructive', icon: XCircle },
      error: { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    const labelMap: Record<string, string> = {
      completed: 'Concluído',
      success: 'Sucesso',
      pending: 'Pendente',
      failed: 'Falhou',
      error: 'Erro',
    };

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {labelMap[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Regras</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Regras Ativas</p>
                <p className="text-2xl font-bold">{activeRules}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Execuções (7d)</p>
                <p className="text-2xl font-bold">{totalExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <Button onClick={handleCreate} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Nova Automação
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs: Regras e Histórico */}
      <Tabs defaultValue="rules" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="rules" className="gap-2">
              <Zap className="h-4 w-4" />
              Regras
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Activity className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className={`text-sm font-medium ${automationEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                {automationEnabled ? 'Ativo' : 'Inativo'}
              </span>
              <Switch
                checked={automationEnabled}
                onCheckedChange={setAutomationEnabled}
                aria-label="Toggle automação"
              />
            </div>
          </div>
        </div>

        <TabsContent value="rules" className="space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" onClick={recalculateScores}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Recalcular Scores
              </Button>
              <Button size="sm" variant="outline" onClick={testAIGeneration} disabled={testingAI}>
                {testingAI ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="mr-2 h-4 w-4" />
                )}
                Testar IA
              </Button>
            </CardContent>
          </Card>

          {/* Rules List */}
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma automação configurada</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sua primeira automação para executar ações automaticamente no CRM
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Automação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{rule.name}</h3>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>

                        {rule.description && (
                          <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline">
                            {TRIGGER_TYPE_LABELS[rule.trigger_type] || rule.trigger_type}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          {rule.actions.map((action, idx) => (
                            <Badge key={idx} variant="outline" className="bg-primary/5">
                              {ACTION_TYPE_LABELS[action.type] || action.type}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>Execuções: {rule.executions_count || 0}</span>
                          {rule.last_executed_at && (
                            <span>
                              Última:{' '}
                              {formatDistanceToNow(new Date(rule.last_executed_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, isActive: checked })
                          }
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(rule)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(rule.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteConfirmId(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Timeline de Execuções</CardTitle>
              <CardDescription>Histórico das últimas ações automáticas executadas</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 && executions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma execução registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Workflow Executions */}
                  {executions.slice(0, 20).map((exec) => (
                    <div key={exec.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">Workflow Executado</span>
                          {getStatusBadge(exec.status)}
                        </div>
                        {exec.error_message && (
                          <p className="text-sm text-destructive truncate">{exec.error_message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(exec.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Automation Logs */}
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                      <div className="p-2 rounded-lg bg-muted">{getActionIcon(log.action_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">{getActionLabel(log.action_type)}</span>
                          {getStatusBadge(log.status)}
                        </div>
                        {log.message_content && (
                          <p className="text-sm text-muted-foreground truncate">
                            {log.message_content.substring(0, 100)}...
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <WorkflowRuleModal open={isModalOpen} onOpenChange={setIsModalOpen} rule={selectedRule} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
