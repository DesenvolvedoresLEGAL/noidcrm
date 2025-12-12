import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminKPICard } from '@/components/admin/AdminKPICard';
import { 
  Server, Activity, AlertTriangle, CheckCircle, Clock,
  Zap, Database, Cloud, Shield, RefreshCw, TrendingUp,
  HardDrive, Cpu, MemoryStick, Network, AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

type SystemStatus = 'operational' | 'degraded' | 'critical';

interface ServiceStatus {
  name: string;
  status: SystemStatus;
  latency: number;
  uptime: number;
  lastCheck: Date;
}

export default function Infrastructure() {
  const [selectedPeriod, setSelectedPeriod] = useState('24h');

  // Simulated service statuses (in production, these would come from health check endpoints)
  const services: ServiceStatus[] = [
    { name: 'Database (Supabase)', status: 'operational', latency: 45, uptime: 99.99, lastCheck: new Date() },
    { name: 'Edge Functions', status: 'operational', latency: 120, uptime: 99.95, lastCheck: new Date() },
    { name: 'Authentication', status: 'operational', latency: 80, uptime: 99.99, lastCheck: new Date() },
    { name: 'Storage', status: 'operational', latency: 150, uptime: 99.90, lastCheck: new Date() },
    { name: 'Realtime', status: 'operational', latency: 35, uptime: 99.98, lastCheck: new Date() },
    { name: 'AI Services', status: 'operational', latency: 250, uptime: 99.85, lastCheck: new Date() },
  ];

  // Fetch workflow executions for automation health
  const { data: workflowStats } = useQuery({
    queryKey: ['admin-workflow-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workflow_executions')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const total = data?.length || 0;
      const completed = data?.filter(w => w.status === 'completed').length || 0;
      const failed = data?.filter(w => w.status === 'failed').length || 0;
      const pending = data?.filter(w => w.status === 'pending').length || 0;
      
      return { total, completed, failed, pending, successRate: total > 0 ? (completed / total) * 100 : 100 };
    }
  });

  // Fetch error logs count
  const { data: errorStats } = useQuery({
    queryKey: ['admin-error-stats'],
    queryFn: async () => {
      const { data: aiErrors } = await supabase
        .from('ai_usage_logs')
        .select('id')
        .eq('success', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      const { data: workflowErrors } = await supabase
        .from('workflow_executions')
        .select('id')
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      return {
        aiErrors: aiErrors?.length || 0,
        workflowErrors: workflowErrors?.length || 0,
        total: (aiErrors?.length || 0) + (workflowErrors?.length || 0)
      };
    }
  });

  // Simulated performance data
  const performanceData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    latency: Math.floor(Math.random() * 100) + 50,
    requests: Math.floor(Math.random() * 1000) + 500,
    errors: Math.floor(Math.random() * 10),
    cpu: Math.floor(Math.random() * 30) + 20,
    memory: Math.floor(Math.random() * 20) + 60,
  }));

  // Calculate overall system status
  const getOverallStatus = (): SystemStatus => {
    if (services.some(s => s.status === 'critical')) return 'critical';
    if (services.some(s => s.status === 'degraded')) return 'degraded';
    return 'operational';
  };

  const overallStatus = getOverallStatus();
  const avgLatency = Math.round(services.reduce((sum, s) => sum + s.latency, 0) / services.length);
  const avgUptime = (services.reduce((sum, s) => sum + s.uptime, 0) / services.length).toFixed(2);

  const statusConfig = {
    operational: { label: 'Operacional', color: 'bg-green-500', icon: CheckCircle },
    degraded: { label: 'Degradado', color: 'bg-yellow-500', icon: AlertTriangle },
    critical: { label: 'Crítico', color: 'bg-red-500', icon: AlertCircle },
  };

  // Simulated alerts
  const alerts = [
    { id: 1, severity: 'warning', message: 'Edge Function latency acima do normal (>200ms)', time: '10 min atrás', service: 'Edge Functions' },
    { id: 2, severity: 'info', message: 'Backup automático concluído com sucesso', time: '1 hora atrás', service: 'Database' },
    { id: 3, severity: 'info', message: 'Deploy automático realizado', time: '2 horas atrás', service: 'CI/CD' },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Overall Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Infraestrutura & Performance
          </h1>
          <p className="text-muted-foreground">Monitoramento de sistemas e serviços</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            overallStatus === 'operational' ? 'bg-green-500/10 text-green-500' :
            overallStatus === 'degraded' ? 'bg-yellow-500/10 text-yellow-500' :
            'bg-red-500/10 text-red-500'
          }`}>
            {overallStatus === 'operational' ? <CheckCircle className="h-5 w-5" /> :
             overallStatus === 'degraded' ? <AlertTriangle className="h-5 w-5" /> :
             <AlertCircle className="h-5 w-5" />}
            <span className="font-medium">{statusConfig[overallStatus].label}</span>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminKPICard
          title="Uptime Médio"
          value={avgUptime + '%'}
          subtitle="Últimos 30 dias"
          icon={Activity}
          variant="success"
        />
        <AdminKPICard
          title="Latência Média"
          value={avgLatency + 'ms'}
          subtitle="Tempo de resposta"
          icon={Clock}
          variant={avgLatency < 100 ? 'success' : avgLatency < 200 ? 'warning' : 'danger'}
        />
        <AdminKPICard
          title="Taxa de Erros"
          value={((errorStats?.total || 0) / 100 * 0.5).toFixed(2) + '%'}
          subtitle="Últimas 24h"
          icon={AlertTriangle}
          variant={(errorStats?.total || 0) < 10 ? 'success' : (errorStats?.total || 0) < 50 ? 'warning' : 'danger'}
        />
        <AdminKPICard
          title="Workflows OK"
          value={(workflowStats?.successRate || 100).toFixed(1) + '%'}
          subtitle={`${workflowStats?.completed || 0} de ${workflowStats?.total || 0}`}
          icon={Zap}
          variant={(workflowStats?.successRate || 100) >= 95 ? 'success' : (workflowStats?.successRate || 100) >= 80 ? 'warning' : 'danger'}
        />
        <AdminKPICard
          title="Serviços Ativos"
          value={`${services.filter(s => s.status === 'operational').length}/${services.length}`}
          subtitle="Todos operacionais"
          icon={Server}
          variant={services.every(s => s.status === 'operational') ? 'success' : 'warning'}
        />
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="resources">Recursos</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {/* Service Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => {
              const StatusIcon = statusConfig[service.status].icon;
              return (
                <Card key={service.name}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className={`h-4 w-4 ${
                            service.status === 'operational' ? 'text-green-500' :
                            service.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
                          }`} />
                          <span className={`text-sm ${
                            service.status === 'operational' ? 'text-green-500' :
                            service.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
                          }`}>
                            {statusConfig[service.status].label}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline">{service.uptime}% uptime</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Latência</span>
                        <p className="font-medium">{service.latency}ms</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Última verificação</span>
                        <p className="font-medium">Agora</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Service Health Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Histórico de Status (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {services.map((service) => (
                  <div key={service.name} className="flex items-center gap-4">
                    <span className="text-sm w-40 truncate">{service.name}</span>
                    <div className="flex-1 flex gap-0.5">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-6 flex-1 rounded-sm ${
                            Math.random() > 0.02 ? 'bg-green-500' : 
                            Math.random() > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          title={`${i}:00 - ${statusConfig[service.status].label}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                  <span>Operacional</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                  <span>Degradado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-red-500" />
                  <span>Indisponível</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Latency Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Latência ao Longo do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="ms" />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Requests Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Requisições por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="hsl(var(--chart-2))" 
                        fill="hsl(var(--chart-2))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Erros por Hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="errors" 
                      stroke="hsl(var(--destructive))" 
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {/* Active Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-start gap-4 p-4 rounded-lg border ${
                      alert.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                      alert.severity === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' :
                      'border-border bg-muted/30'
                    }`}
                  >
                    {alert.severity === 'critical' ? (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : alert.severity === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-blue-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{alert.message}</span>
                        <Badge variant="outline">{alert.service}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{alert.time}</span>
                    </div>
                    <Button variant="ghost" size="sm">Resolver</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alert Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Configuração de Alertas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condição</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Latência &gt; 500ms por 5 min</TableCell>
                    <TableCell><Badge variant="destructive">Crítico</Badge></TableCell>
                    <TableCell>Email, Slack</TableCell>
                    <TableCell><Badge className="bg-green-500/10 text-green-500">Ativo</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Taxa de erro &gt; 5%</TableCell>
                    <TableCell><Badge className="bg-yellow-500/10 text-yellow-500">Warning</Badge></TableCell>
                    <TableCell>Slack</TableCell>
                    <TableCell><Badge className="bg-green-500/10 text-green-500">Ativo</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Serviço indisponível</TableCell>
                    <TableCell><Badge variant="destructive">Crítico</Badge></TableCell>
                    <TableCell>Email, Slack, SMS</TableCell>
                    <TableCell><Badge className="bg-green-500/10 text-green-500">Ativo</Badge></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>CPU &gt; 80% por 10 min</TableCell>
                    <TableCell><Badge className="bg-yellow-500/10 text-yellow-500">Warning</Badge></TableCell>
                    <TableCell>Slack</TableCell>
                    <TableCell><Badge className="bg-green-500/10 text-green-500">Ativo</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Usage */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="h-5 w-5 text-primary" />
                  <span className="font-medium">CPU</span>
                </div>
                <div className="text-3xl font-bold mb-2">32%</div>
                <Progress value={32} className="h-2" />
                <span className="text-xs text-muted-foreground mt-2 block">4 vCPUs disponíveis</span>
              </CardContent>
            </Card>

            {/* Memory */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <MemoryStick className="h-5 w-5 text-primary" />
                  <span className="font-medium">Memória</span>
                </div>
                <div className="text-3xl font-bold mb-2">68%</div>
                <Progress value={68} className="h-2" />
                <span className="text-xs text-muted-foreground mt-2 block">5.4 GB / 8 GB</span>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <span className="font-medium">Storage</span>
                </div>
                <div className="text-3xl font-bold mb-2">45%</div>
                <Progress value={45} className="h-2" />
                <span className="text-xs text-muted-foreground mt-2 block">4.5 GB / 10 GB</span>
              </CardContent>
            </Card>

            {/* Network */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Network className="h-5 w-5 text-primary" />
                  <span className="font-medium">Network</span>
                </div>
                <div className="text-3xl font-bold mb-2">1.2 Gbps</div>
                <Progress value={12} className="h-2" />
                <span className="text-xs text-muted-foreground mt-2 block">10 Gbps máximo</span>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Uso de Recursos (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="cpu" 
                      name="CPU"
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memory" 
                      name="Memória"
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Database Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Estatísticas do Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Conexões Ativas</span>
                  <p className="text-2xl font-bold">24</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Pool Disponível</span>
                  <p className="text-2xl font-bold">76</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Queries/seg</span>
                  <p className="text-2xl font-bold">142</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
                  <p className="text-2xl font-bold">98.5%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
