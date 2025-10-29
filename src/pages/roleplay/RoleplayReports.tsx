import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  Award,
  Users,
  LineChart,
  AlertCircle,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { toast } from 'sonner';
import {
  getTeamPerformanceReport,
  getTrainingTrends,
  getPredictiveAnalytics,
  type SellerPerformance
} from '@/services/roleplay/reports';
import {
  LineChart as RechartsLine,
  Line,
  BarChart as RechartsBar,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function RoleplayReports() {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { isAdmin, isOwner, loading: permissionsLoading } = usePermissions();
  
  const [period, setPeriod] = useState('30d');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');

  // Debug permissions
  useEffect(() => {
    console.log('[RoleplayReports] Permissions:', { isAdmin, isOwner, permissionsLoading });
  }, [isAdmin, isOwner, permissionsLoading]);

  // Permission check - allow both admin and owner
  useEffect(() => {
    if (!permissionsLoading && !isAdmin && !isOwner) {
      console.log('[RoleplayReports] Access denied - redirecting');
      toast.error('Acesso negado', {
        description: 'Apenas administradores e gestores podem acessar relatórios'
      });
      navigate('/app/roleplay');
    }
  }, [permissionsLoading, isAdmin, isOwner, navigate]);

  // Fetch team performance
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['team-performance', organization?.id, period, selectedSeller],
    queryFn: () => {
      if (!organization?.id) throw new Error('No organization');
      return getTeamPerformanceReport(
        organization.id,
        period,
        selectedSeller === 'all' ? undefined : selectedSeller
      );
    },
    enabled: !!organization?.id && (isAdmin || isOwner),
    staleTime: 60 * 1000
  });

  // Fetch training trends
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['training-trends', organization?.id, period],
    queryFn: () => {
      if (!organization?.id) throw new Error('No organization');
      return getTrainingTrends(organization.id, period);
    },
    enabled: !!organization?.id && (isAdmin || isOwner),
    staleTime: 60 * 1000
  });

  // Fetch predictive insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['predictive-analytics', organization?.id],
    queryFn: () => {
      if (!organization?.id) throw new Error('No organization');
      return getPredictiveAnalytics(organization.id);
    },
    enabled: !!organization?.id && (isAdmin || isOwner),
    staleTime: 5 * 60 * 1000
  });

  if (permissionsLoading || metricsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAdmin && !isOwner) {
    return null;
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0.1) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < -0.1) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendBadge = (trend: number) => {
    if (trend > 0.1) return <Badge className="bg-green-500/10 text-green-600 border-green-600/20">↑ Alta</Badge>;
    if (trend < -0.1) return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-600/20">↓ Baixa</Badge>;
    return <Badge variant="outline">→ Estável</Badge>;
  };

  // Prepare pie chart data
  const pieData = metrics ? [
    { name: 'Aprovados', value: Math.round(metrics.approval_rate), fill: 'hsl(var(--primary))' },
    { name: 'Reprovados', value: Math.round(100 - metrics.approval_rate), fill: 'hsl(var(--destructive))' }
  ] : [];

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/app/roleplay')}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Relatórios de Performance</h1>
                <p className="text-muted-foreground">
                  Análises preditivas e analíticas sobre o desempenho do time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Última semana</SelectItem>
                  <SelectItem value="30d">Último mês</SelectItem>
                  <SelectItem value="90d">Último trimestre</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Vendedor</label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {metrics?.sellers_performance.map((seller) => (
                    <SelectItem key={seller.seller_id} value={seller.seller_id}>
                      {seller.seller_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Users className="h-8 w-8 text-primary" />
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold">{metrics?.total_sessions || 0}</h3>
            <p className="text-sm text-muted-foreground">Total de Treinos</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Award className="h-8 w-8 text-yellow-500" />
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold">{metrics?.avg_score.toFixed(1) || '0.0'}</h3>
            <p className="text-sm text-muted-foreground">Média Geral de Notas</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold">{metrics?.approval_rate.toFixed(1) || '0.0'}%</h3>
            <p className="text-sm text-muted-foreground">Taxa de Aprovação</p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-blue-500" />
              <LineChart className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold">{metrics?.total_hours.toFixed(1) || '0.0'}h</h3>
            <p className="text-sm text-muted-foreground">Horas de Treinamento</p>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart - Evolution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Evolução de Performance
            </h3>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLine data={trends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    name="Nota Média"
                  />
                </RechartsLine>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bar Chart - Sessions by Seller */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Treinos por Vendedor
            </h3>
            {metricsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsBar data={metrics?.sellers_performance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="seller_name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total_sessions" fill="hsl(var(--primary))" name="Total de Sessões" />
                </RechartsBar>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Pie Chart - Approval Rate */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Taxa de Aprovação
            </h3>
            {metricsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Predictive Analytics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Análises Preditivas
            </h3>
            {insightsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {insights && insights.length > 0 ? (
                  insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        insight.impact === 'positive'
                          ? 'bg-green-500/5 border-green-500/20'
                          : insight.impact === 'negative'
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-blue-500/5 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {insight.impact === 'positive' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        ) : insight.impact === 'negative' ? (
                          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{insight.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {insight.description}
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            {(insight.confidence * 100).toFixed(0)}% confiança
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Dados insuficientes para análises preditivas
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Detailed Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Desempenho Detalhado por Vendedor
          </h3>
          {metricsLoading ? (
            <div className="py-8 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Treinos</TableHead>
                    <TableHead className="text-center">Nota Média</TableHead>
                    <TableHead className="text-center">Taxa de Aprovação</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead className="text-center">Último Treino</TableHead>
                    <TableHead className="text-center">Tendência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.sellers_performance && metrics.sellers_performance.length > 0 ? (
                    metrics.sellers_performance
                      .sort((a, b) => b.avg_score - a.avg_score)
                      .map((seller) => (
                        <TableRow key={seller.seller_id}>
                          <TableCell className="font-medium">{seller.seller_name}</TableCell>
                          <TableCell className="text-center">{seller.total_sessions}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={seller.avg_score >= 7.0 ? 'default' : 'destructive'}>
                              {seller.avg_score.toFixed(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {seller.approval_rate.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-center">
                            {seller.total_time_hours.toFixed(1)}h
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {seller.last_session
                              ? new Date(seller.last_session).toLocaleDateString('pt-BR')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getTrendIcon(seller.trend)}
                              {getTrendBadge(seller.trend)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum dado disponível para o período selecionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
