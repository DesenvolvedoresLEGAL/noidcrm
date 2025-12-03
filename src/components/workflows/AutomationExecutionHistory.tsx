import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  Mail,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
  Activity,
  Clock,
  XCircle,
  Bot,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { WorkflowExecution } from '@/services/crm/workflow-rules';

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

interface AutomationExecutionHistoryProps {
  executions: WorkflowExecution[];
  logs: AutomationLog[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function AutomationExecutionHistory({
  executions,
  logs,
  isLoading,
  onRefresh,
}: AutomationExecutionHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('7d');

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
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive', icon: typeof CheckCircle2, label: string }> = {
      completed: { variant: 'default', icon: CheckCircle2, label: 'Concluído' },
      success: { variant: 'default', icon: CheckCircle2, label: 'Sucesso' },
      pending: { variant: 'secondary', icon: Clock, label: 'Pendente' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Falhou' },
      error: { variant: 'destructive', icon: XCircle, label: 'Erro' },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Filter executions by status
  const filteredExecutions = executions.filter(exec => {
    if (statusFilter === 'all') return true;
    return exec.status === statusFilter;
  });

  // Combine and sort all items
  const allItems = [
    ...filteredExecutions.map(e => ({ ...e, type: 'execution' as const })),
    ...logs.map(l => ({ ...l, type: 'log' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Histórico de Execuções</CardTitle>
            <CardDescription>Timeline das ações automáticas</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Último dia</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma execução registrada</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {allItems.slice(0, 50).map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${
                  item.type === 'execution' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  {item.type === 'execution' ? (
                    <Zap className="h-4 w-4 text-primary" />
                  ) : (
                    getActionIcon((item as AutomationLog).action_type)
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {item.type === 'execution' 
                        ? 'Workflow Executado' 
                        : getActionLabel((item as AutomationLog).action_type)
                      }
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  
                  {item.type === 'execution' && (item as WorkflowExecution).error_message && (
                    <p className="text-sm text-destructive truncate">
                      {(item as WorkflowExecution).error_message}
                    </p>
                  )}
                  
                  {item.type === 'log' && (item as AutomationLog).message_content && (
                    <p className="text-sm text-muted-foreground truncate">
                      {(item as AutomationLog).message_content?.substring(0, 100)}...
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
