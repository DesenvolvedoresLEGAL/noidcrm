import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AdminKPICard } from '@/components/admin/AdminKPICard';
import { 
  Brain, Zap, AlertTriangle, CheckCircle, XCircle, 
  TrendingUp, Clock, DollarSign, Activity, Search,
  Shield, Settings, BarChart3, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function AIControl() {
  const [searchTerm, setSearchTerm] = useState('');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch AI usage logs
  const { data: aiLogs = [] } = useQuery({
    queryKey: ['admin-ai-logs', timeRange],
    queryFn: async () => {
      const daysAgo = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data } = await supabase
        .from('ai_usage_logs')
        .select(`
          *,
          organizations:organization_id (name)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    }
  });

  // Fetch AI actions for governance
  const { data: aiActions = [] } = useQuery({
    queryKey: ['admin-ai-actions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_actions')
        .select(`
          *,
          organizations:organization_id (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    }
  });

  // Calculate metrics
  const totalVolts = aiLogs.reduce((sum, log) => sum + (log.volts_used || 0), 0);
  const totalTokens = aiLogs.reduce((sum, log) => sum + (log.tokens_total || 0), 0);
  const successRate = aiLogs.length > 0 
    ? (aiLogs.filter(l => l.success).length / aiLogs.length * 100).toFixed(1)
    : 0;
  const avgLatency = aiLogs.length > 0
    ? Math.round(aiLogs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / aiLogs.length)
    : 0;
  const estimatedCost = (totalTokens / 1000) * 0.002; // Simplified cost estimation

  // Group by feature
  const usageByFeature = aiLogs.reduce((acc, log) => {
    const feature = log.feature || 'unknown';
    if (!acc[feature]) acc[feature] = { volts: 0, tokens: 0, count: 0, errors: 0 };
    acc[feature].volts += log.volts_used || 0;
    acc[feature].tokens += log.tokens_total || 0;
    acc[feature].count++;
    if (!log.success) acc[feature].errors++;
    return acc;
  }, {} as Record<string, { volts: number; tokens: number; count: number; errors: number }>);

  const featureChartData = Object.entries(usageByFeature)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.volts - a.volts)
    .slice(0, 10);

  // Group by organization
  const usageByOrg = aiLogs.reduce((acc, log) => {
    const orgName = (log.organizations as any)?.name || 'Unknown';
    if (!acc[orgName]) acc[orgName] = { volts: 0, tokens: 0, count: 0 };
    acc[orgName].volts += log.volts_used || 0;
    acc[orgName].tokens += log.tokens_total || 0;
    acc[orgName].count++;
    return acc;
  }, {} as Record<string, { volts: number; tokens: number; count: number }>);

  const orgChartData = Object.entries(usageByOrg)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.volts - a.volts)
    .slice(0, 10);

  // Daily usage trend
  const dailyUsage = aiLogs.reduce((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('pt-BR');
    if (!acc[date]) acc[date] = { date, volts: 0, tokens: 0, calls: 0 };
    acc[date].volts += log.volts_used || 0;
    acc[date].tokens += log.tokens_total || 0;
    acc[date].calls++;
    return acc;
  }, {} as Record<string, { date: string; volts: number; tokens: number; calls: number }>);

  const dailyChartData = Object.values(dailyUsage).reverse();

  // Filter logs
  const filteredLogs = aiLogs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.feature?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.organizations as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFeature = featureFilter === 'all' || log.feature === featureFilter;
    return matchesSearch && matchesFeature;
  });

  const features = [...new Set(aiLogs.map(l => l.feature).filter(Boolean))];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            IA & Automations Control
          </h1>
          <p className="text-muted-foreground">Monitoramento e governança de IA</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 horas</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminKPICard
          title="VOLTS Consumidos"
          value={totalVolts.toLocaleString('pt-BR')}
          subtitle="Total no período"
          icon={Zap}
          variant="default"
        />
        <AdminKPICard
          title="Tokens Utilizados"
          value={(totalTokens / 1000).toFixed(1) + 'K'}
          subtitle="Input + Output"
          icon={Activity}
          variant="default"
        />
        <AdminKPICard
          title="Taxa de Sucesso"
          value={successRate + '%'}
          subtitle="Chamadas com sucesso"
          icon={CheckCircle}
          variant={Number(successRate) >= 95 ? 'success' : Number(successRate) >= 80 ? 'warning' : 'danger'}
        />
        <AdminKPICard
          title="Latência Média"
          value={avgLatency + 'ms'}
          subtitle="Tempo de resposta"
          icon={Clock}
          variant={avgLatency < 1000 ? 'success' : avgLatency < 3000 ? 'warning' : 'danger'}
        />
        <AdminKPICard
          title="Custo Estimado"
          value={'$' + estimatedCost.toFixed(2)}
          subtitle="Baseado em tokens"
          icon={DollarSign}
          variant="default"
        />
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Uso de IA</TabsTrigger>
          <TabsTrigger value="governance">Governança</TabsTrigger>
          <TabsTrigger value="logs">Logs Detalhados</TabsTrigger>
          <TabsTrigger value="limits">Limites & Quotas</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Usage Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Uso Diário de VOLTS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="volts" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Usage by Feature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  VOLTS por Feature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="volts" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage by Organization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Uso por Organização</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead className="text-right">VOLTS</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Média/Chamada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgChartData.map((org) => (
                    <TableRow key={org.name}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-right">{org.volts.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{(org.tokens / 1000).toFixed(1)}K</TableCell>
                      <TableCell className="text-right">{org.count}</TableCell>
                      <TableCell className="text-right">
                        {org.count > 0 ? (org.volts / org.count).toFixed(1) : 0} VOLTS
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* AI Actions Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Ações de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pendentes</span>
                    <Badge variant="outline">{aiActions.filter(a => a.status === 'pending').length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Aprovadas</span>
                    <Badge className="bg-green-500/10 text-green-500">{aiActions.filter(a => a.status === 'approved').length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Rejeitadas</span>
                    <Badge variant="destructive">{aiActions.filter(a => a.status === 'rejected').length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Executadas</span>
                    <Badge className="bg-blue-500/10 text-blue-500">{aiActions.filter(a => a.status === 'executed').length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Confidence Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribuição de Confiança</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Alta (≥80%)</span>
                      <span>{aiActions.filter(a => a.confidence_score >= 0.8).length}</span>
                    </div>
                    <Progress value={aiActions.length > 0 ? (aiActions.filter(a => a.confidence_score >= 0.8).length / aiActions.length) * 100 : 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Média (50-79%)</span>
                      <span>{aiActions.filter(a => a.confidence_score >= 0.5 && a.confidence_score < 0.8).length}</span>
                    </div>
                    <Progress value={aiActions.length > 0 ? (aiActions.filter(a => a.confidence_score >= 0.5 && a.confidence_score < 0.8).length / aiActions.length) * 100 : 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Baixa (&lt;50%)</span>
                      <span>{aiActions.filter(a => a.confidence_score < 0.5).length}</span>
                    </div>
                    <Progress value={aiActions.length > 0 ? (aiActions.filter(a => a.confidence_score < 0.5).length / aiActions.length) * 100 : 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Rate by Feature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Taxa de Erro por Feature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {featureChartData.slice(0, 5).map(feature => {
                    const errorRate = feature.count > 0 ? (feature.errors / feature.count) * 100 : 0;
                    return (
                      <div key={feature.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="truncate max-w-[150px]">{feature.name}</span>
                          <span className={errorRate > 10 ? 'text-destructive' : errorRate > 5 ? 'text-yellow-500' : 'text-green-500'}>
                            {errorRate.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={100 - errorRate} 
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Actions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Decisões de IA Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead>Tipo de Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Confiança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiActions.slice(0, 10).map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="font-medium">
                        {(action.organizations as any)?.name || 'N/A'}
                      </TableCell>
                      <TableCell>{action.action_type}</TableCell>
                      <TableCell>{action.entity_type || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={action.confidence_score >= 0.8 ? 'default' : action.confidence_score >= 0.5 ? 'secondary' : 'outline'}>
                          {(action.confidence_score * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          action.status === 'executed' ? 'default' :
                          action.status === 'approved' ? 'secondary' :
                          action.status === 'rejected' ? 'destructive' : 'outline'
                        }>
                          {action.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(action.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por feature, ação ou organização..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <Select value={featureFilter} onValueChange={setFeatureFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Feature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Features</SelectItem>
                    {features.map(f => (
                      <SelectItem key={f} value={f!}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">VOLTS</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Latência</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 50).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(log.organizations as any)?.name || 'N/A'}
                      </TableCell>
                      <TableCell>{log.feature}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="text-sm">{log.model_used}</TableCell>
                      <TableCell className="text-right">{log.volts_used || 0}</TableCell>
                      <TableCell className="text-right">{log.tokens_total || 0}</TableCell>
                      <TableCell className="text-right">{log.latency_ms || 0}ms</TableCell>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Plan Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Limites por Plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">VOLTS/Mês</TableHead>
                      <TableHead className="text-right">Tokens/Dia</TableHead>
                      <TableHead>Auto-Apply</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Starter</TableCell>
                      <TableCell className="text-right">1,000</TableCell>
                      <TableCell className="text-right">50,000</TableCell>
                      <TableCell><XCircle className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Pro</TableCell>
                      <TableCell className="text-right">10,000</TableCell>
                      <TableCell className="text-right">500,000</TableCell>
                      <TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Business</TableCell>
                      <TableCell className="text-right">50,000</TableCell>
                      <TableCell className="text-right">Ilimitado</TableCell>
                      <TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Enterprise</TableCell>
                      <TableCell className="text-right">Ilimitado</TableCell>
                      <TableCell className="text-right">Ilimitado</TableCell>
                      <TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Organizations Near Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Organizações Próximas do Limite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orgChartData.slice(0, 5).map((org, i) => {
                    const limit = 10000; // Simulated limit
                    const usage = (org.volts / limit) * 100;
                    return (
                      <div key={org.name}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{org.name}</span>
                          <span className={usage > 80 ? 'text-destructive' : usage > 60 ? 'text-yellow-500' : ''}>
                            {org.volts.toLocaleString()} / {limit.toLocaleString()} VOLTS
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(usage, 100)} 
                          className={`h-2 ${usage > 80 ? '[&>div]:bg-destructive' : usage > 60 ? '[&>div]:bg-yellow-500' : ''}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Governance Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Ações de Governança</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Bloquear IA para Conta
                </Button>
                <Button variant="outline" className="justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Ajustar Limites Globais
                </Button>
                <Button variant="outline" className="justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  Exportar Relatório de Uso
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
