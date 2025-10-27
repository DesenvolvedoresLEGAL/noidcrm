import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Clock, 
  Mail, 
  MessageSquare, 
  TrendingUp, 
  Zap,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

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

interface AutomationStats {
  totalAutomations: number;
  emailsSent: number;
  whatsappSent: number;
  tasksCreated: number;
  successRate: number;
}

interface AutomationProps {
  embedded?: boolean;
}

export default function Automation({ embedded = false }: AutomationProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState<AutomationStats>({
    totalAutomations: 0,
    emailsSent: 0,
    whatsappSent: 0,
    tasksCreated: 0,
    successRate: 0,
  });
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testingAI, setTestingAI] = useState(false);

  useEffect(() => {
    fetchAutomationData();
  }, []);

  const fetchAutomationData = async () => {
    try {
      setLoading(true);

      // Buscar logs dos últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData, error: logsError } = await supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      setLogs(logsData || []);

      // Calcular estatísticas
      const total = logsData?.length || 0;
      const emails = logsData?.filter(l => l.action_type === 'email_sent').length || 0;
      const whatsapp = logsData?.filter(l => l.action_type === 'whatsapp_sent').length || 0;
      const tasks = logsData?.filter(l => l.action_type === 'task_created').length || 0;
      const completed = logsData?.filter(l => l.status === 'completed').length || 0;

      setStats({
        totalAutomations: total,
        emailsSent: emails,
        whatsappSent: whatsapp,
        tasksCreated: tasks,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
    } catch (error) {
      console.error('Error fetching automation data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar dados de automação',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testAIGeneration = async () => {
    setTestingAI(true);
    try {
      // Buscar uma oportunidade de exemplo
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

      fetchAutomationData();
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
      pending: { variant: 'secondary', icon: Clock },
      failed: { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {status === 'completed' ? 'Concluído' : status === 'pending' ? 'Pendente' : 'Falhou'}
      </Badge>
    );
  };

  if (loading) {
    const content = (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
    return embedded ? content : <Layout>{content}</Layout>;
  }

  const content = (
    <div className={embedded ? 'space-y-6' : 'p-4 md:p-8 space-y-6'}>
      {/* Header with Toggle */}
      {!embedded && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Automações</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerenciamento de ações automatizadas
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm font-bold ${automationEnabled ? 'text-accent' : 'text-muted-foreground'}`}>
              {automationEnabled ? 'Ativo' : 'Inativo'}
            </span>
            <Switch
              checked={automationEnabled}
              onCheckedChange={setAutomationEnabled}
              aria-label="Toggle automação"
            />
          </div>
        </div>
      )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            {
              title: 'Total de Ações',
              value: stats.totalAutomations.toString(),
              icon: Zap,
              color: 'text-primary',
              description: 'Últimos 7 dias',
            },
            {
              title: 'Emails Enviados',
              value: stats.emailsSent.toString(),
              icon: Mail,
              color: 'text-accent',
              description: 'Automáticos',
            },
            {
              title: 'WhatsApp Enviados',
              value: stats.whatsappSent.toString(),
              icon: MessageSquare,
              color: 'text-secondary',
              description: 'Em breve',
            },
            {
              title: 'Taxa de Sucesso',
              value: `${stats.successRate}%`,
              icon: TrendingUp,
              color: 'text-accent',
              description: 'Ações concluídas',
            },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.title} 
                className="shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

      {/* Toggle de Automação - Only when embedded */}
      {embedded && (
        <div className="flex justify-end">
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
            <span className="text-sm font-medium">Status:</span>
            <span className={`text-sm font-bold ${automationEnabled ? 'text-accent' : 'text-muted-foreground'}`}>
              {automationEnabled ? 'Ativo' : 'Inativo'}
            </span>
            <Switch
              checked={automationEnabled}
              onCheckedChange={setAutomationEnabled}
              aria-label="Toggle automação"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Gerencie e teste a automação</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={recalculateScores}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Recalcular Scores
          </Button>
          <Button variant="outline" onClick={testAIGeneration} disabled={testingAI}>
            {testingAI ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Testar IA
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline de Automação</CardTitle>
          <CardDescription>Histórico das últimas ações automáticas</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma ação automática registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="p-2 rounded-lg bg-muted">
                    {getActionIcon(log.action_type)}
                  </div>
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
    </div>
  );
  
  return embedded ? content : <Layout>{content}</Layout>;
}
