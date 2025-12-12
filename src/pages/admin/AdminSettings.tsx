import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, Flag, Globe, Key, Webhook, Clock,
  Database, Shield, Server, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Copy, Eye, EyeOff, Trash2, Plus
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  description: string;
  environment: 'all' | 'production' | 'staging';
}

interface CronJob {
  name: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  status: 'active' | 'paused' | 'failed';
  description: string;
}

export default function AdminSettings() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Simulated feature flags
  const featureFlags: FeatureFlag[] = [
    { id: '1', name: 'AI Auto-Apply', key: 'ai_auto_apply', enabled: true, description: 'Aplicar sugestões de IA automaticamente', environment: 'all' },
    { id: '2', name: 'New Dashboard', key: 'new_dashboard', enabled: false, description: 'Novo design do dashboard', environment: 'staging' },
    { id: '3', name: 'Advanced Reporting', key: 'advanced_reporting', enabled: true, description: 'Relatórios avançados com IA', environment: 'production' },
    { id: '4', name: 'Workflow V2', key: 'workflow_v2', enabled: true, description: 'Nova engine de automação', environment: 'all' },
    { id: '5', name: 'Real-time Sync', key: 'realtime_sync', enabled: true, description: 'Sincronização em tempo real', environment: 'all' },
    { id: '6', name: 'Beta Features', key: 'beta_features', enabled: false, description: 'Acesso a recursos beta', environment: 'staging' },
  ];

  // Simulated CRON jobs
  const cronJobs: CronJob[] = [
    { name: 'process-pending-workflows', schedule: '*/5 * * * *', lastRun: '2 min atrás', nextRun: '3 min', status: 'active', description: 'Processa workflows pendentes' },
    { name: 'auto-apply-ai-suggestions', schedule: '0 */6 * * *', lastRun: '4 horas atrás', nextRun: '2 horas', status: 'active', description: 'Aplica sugestões de IA automaticamente' },
    { name: 'detect-stale-opportunities', schedule: '0 */12 * * *', lastRun: '8 horas atrás', nextRun: '4 horas', status: 'active', description: 'Detecta oportunidades paradas' },
    { name: 'activity-reminders', schedule: '0 * * * *', lastRun: '45 min atrás', nextRun: '15 min', status: 'active', description: 'Envia lembretes de atividades' },
    { name: 'daily-briefing-generator', schedule: '0 6 * * *', lastRun: '18 horas atrás', nextRun: '6 horas', status: 'active', description: 'Gera briefing diário' },
    { name: 'daily-scoring-cron', schedule: '0 5 * * *', lastRun: '19 horas atrás', nextRun: '5 horas', status: 'active', description: 'Recalcula scores de leads e oportunidades' },
  ];

  // Simulated integrations
  const integrations = [
    { name: 'Google Calendar', status: 'connected', lastSync: '5 min atrás' },
    { name: 'Gmail', status: 'connected', lastSync: '2 min atrás' },
    { name: 'OpenAI', status: 'connected', lastSync: 'N/A' },
    { name: 'Stripe', status: 'disconnected', lastSync: 'N/A' },
  ];

  // System parameters
  const systemParams = [
    { key: 'max_users_per_org', value: '50', description: 'Máximo de usuários por organização' },
    { key: 'max_opportunities_per_org', value: '10000', description: 'Máximo de oportunidades por organização' },
    { key: 'ai_confidence_threshold', value: '0.8', description: 'Threshold de confiança para auto-apply de IA' },
    { key: 'stale_opportunity_days', value: '14', description: 'Dias sem atividade para marcar como parada' },
    { key: 'session_timeout_hours', value: '24', description: 'Timeout de sessão em horas' },
    { key: 'rate_limit_requests_per_minute', value: '100', description: 'Limite de requisições por minuto' },
  ];

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    toast({ title: 'API Key copiada', description: 'A chave foi copiada para a área de transferência' });
  };

  const handleToggleFlag = (flagId: string) => {
    toast({ title: 'Feature flag atualizada', description: 'A alteração será aplicada em breve' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações Avançadas
          </h1>
          <p className="text-muted-foreground">Configurações do sistema e integrações</p>
        </div>
        {maintenanceMode && (
          <Badge variant="destructive" className="animate-pulse">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Modo Manutenção Ativo
          </Badge>
        )}
      </div>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="params">Parâmetros</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="cron">Jobs Agendados</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Feature Flags
              </CardTitle>
              <CardDescription>Controle de funcionalidades por ambiente</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureFlags.map((flag) => (
                    <TableRow key={flag.id}>
                      <TableCell className="font-medium">{flag.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{flag.key}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{flag.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {flag.environment === 'all' ? 'Todos' : flag.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {flag.enabled ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch 
                          checked={flag.enabled} 
                          onCheckedChange={() => handleToggleFlag(flag.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="params" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Parâmetros Globais do Sistema
              </CardTitle>
              <CardDescription>Configurações que afetam todo o sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {systemParams.map((param) => (
                  <div key={param.key} className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <Label className="font-medium">{param.key}</Label>
                      <p className="text-sm text-muted-foreground">{param.description}</p>
                    </div>
                    <Input 
                      defaultValue={param.value} 
                      className="max-w-[200px]"
                    />
                    <Button variant="outline" size="sm">
                      Salvar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Limites de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rate Limiting</Label>
                      <p className="text-sm text-muted-foreground">Limitar requisições por IP</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>IP Whitelisting</Label>
                      <p className="text-sm text-muted-foreground">Restringir acesso por IP</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>MFA Obrigatório (Admin)</Label>
                      <p className="text-sm text-muted-foreground">Exigir 2FA para admins</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Audit Trail</Label>
                      <p className="text-sm text-muted-foreground">Registrar todas as ações</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sessões Concorrentes</Label>
                      <p className="text-sm text-muted-foreground">Limitar a 3 sessões ativas</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Password Complexity</Label>
                      <p className="text-sm text-muted-foreground">Exigir senhas complexas</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* API Keys */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Production API Key</Label>
                    <Badge className="bg-green-500/10 text-green-500">Ativa</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type={showApiKey ? 'text' : 'password'} 
                      value="sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCopyApiKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Criada em 01/01/2024</p>
                </div>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Gerar Nova API Key
                </Button>
              </CardContent>
            </Card>

            {/* Webhooks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Webhooks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">opportunity.created</span>
                    <Badge className="bg-green-500/10 text-green-500">Ativo</Badge>
                  </div>
                  <code className="text-xs text-muted-foreground block truncate">
                    https://api.example.com/webhooks/opportunities
                  </code>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">proposal.accepted</span>
                    <Badge className="bg-green-500/10 text-green-500">Ativo</Badge>
                  </div>
                  <code className="text-xs text-muted-foreground block truncate">
                    https://api.example.com/webhooks/proposals
                  </code>
                </div>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Webhook
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Connected Services */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Serviços Conectados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.name}>
                      <TableCell className="font-medium">{integration.name}</TableCell>
                      <TableCell>
                        <Badge variant={integration.status === 'connected' ? 'default' : 'secondary'}>
                          {integration.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{integration.lastSync}</TableCell>
                      <TableCell className="text-right">
                        {integration.status === 'connected' ? (
                          <Button variant="ghost" size="sm">Desconectar</Button>
                        ) : (
                          <Button variant="outline" size="sm">Conectar</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Jobs Agendados (CRON)
              </CardTitle>
              <CardDescription>Tarefas automatizadas do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Última Execução</TableHead>
                    <TableHead>Próxima Execução</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronJobs.map((job) => (
                    <TableRow key={job.name}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{job.name}</code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{job.schedule}</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.description}</TableCell>
                      <TableCell className="text-sm">{job.lastRun}</TableCell>
                      <TableCell className="text-sm">{job.nextRun}</TableCell>
                      <TableCell>
                        <Badge variant={
                          job.status === 'active' ? 'default' :
                          job.status === 'paused' ? 'secondary' : 'destructive'
                        }>
                          {job.status === 'active' ? 'Ativo' :
                           job.status === 'paused' ? 'Pausado' : 'Falhou'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            {job.status === 'active' ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Maintenance Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Modo Manutenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label>Ativar Modo Manutenção</Label>
                    <p className="text-sm text-muted-foreground">
                      Bloqueia acesso de usuários e exibe mensagem de manutenção
                    </p>
                  </div>
                  <Switch 
                    checked={maintenanceMode} 
                    onCheckedChange={setMaintenanceMode}
                  />
                </div>
                {maintenanceMode && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive mb-2" />
                    <p className="text-sm text-destructive">
                      Modo manutenção ativo. Usuários não conseguirão acessar o sistema.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Backups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Backups
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Último Backup</span>
                    <Badge className="bg-green-500/10 text-green-500">Há 6 horas</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Próximo Backup</span>
                    <span className="text-sm text-muted-foreground">Em 6 horas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção</span>
                    <span className="text-sm text-muted-foreground">30 dias</span>
                  </div>
                </div>
                <Separator />
                <Button variant="outline" className="w-full">
                  <Database className="h-4 w-4 mr-2" />
                  Executar Backup Manual
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cache & Cleanup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cache & Limpeza</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="justify-start">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Limpar Cache do Sistema
                </Button>
                <Button variant="outline" className="justify-start">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Logs Antigos
                </Button>
                <Button variant="outline" className="justify-start">
                  <Database className="h-4 w-4 mr-2" />
                  Otimizar Banco de Dados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Environment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Informações do Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Ambiente</span>
                  <p className="font-medium">Production</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Versão</span>
                  <p className="font-medium">v2.4.1</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Último Deploy</span>
                  <p className="font-medium">Hoje, 10:30</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Uptime</span>
                  <p className="font-medium">15 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
