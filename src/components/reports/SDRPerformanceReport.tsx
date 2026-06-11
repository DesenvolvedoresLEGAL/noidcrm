import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSDRPerformance, useDashboardMetrics } from '@/hooks/usePipelineMetrics';
import { TrendingUp, Users, Target, DollarSign, Clock, Award } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function SDRPerformanceReport() {
  const { data: sdrPerformance, isLoading: loadingSDR } = useSDRPerformance();
  const { data: dashboardMetrics, isLoading: loadingMetrics } = useDashboardMetrics();

  const isLoading = loadingSDR || loadingMetrics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const qualMetrics = dashboardMetrics?.qualificationMetrics;
  const sdrLeaderboard = dashboardMetrics?.sdrLeaderboard || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total SQLs Gerados</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualMetrics?.totalSQLs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Leads qualificados para vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SQLs Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualMetrics?.activeSQLs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Em processo de qualificação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(qualMetrics?.conversionToSales || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Lead → SQL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Atribuída</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                sdrLeaderboard.reduce((sum, sdr) => sum + (sdr.revenue_attributed || 0), 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita de deals originados por SDRs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard de SDRs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Ranking de SDRs
          </CardTitle>
          <CardDescription>
            Performance dos SDRs ordenada por receita atribuída
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sdrLeaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de SDR disponível ainda.</p>
              <p className="text-sm">Os dados aparecerão quando leads forem qualificados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>SDR</TableHead>
                  <TableHead className="text-center">SQLs Gerados</TableHead>
                  <TableHead className="text-center">Deals Ganhos</TableHead>
                  <TableHead className="text-center">Deals Perdidos</TableHead>
                  <TableHead className="text-center">Taxa Conversão</TableHead>
                  <TableHead className="text-center">Tempo Médio</TableHead>
                  <TableHead className="text-right">Receita Atribuída</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sdrLeaderboard.map((sdr, index) => (
                  <TableRow key={sdr.sdr_user_id}>
                    <TableCell>
                      {index === 0 && <Badge className="bg-yellow-500">🥇</Badge>}
                      {index === 1 && <Badge className="bg-gray-400">🥈</Badge>}
                      {index === 2 && <Badge className="bg-amber-600">🥉</Badge>}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sdr.sdr_name || 'Usuário removido'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{sdr.total_sqls_generated}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default" className="bg-green-600">
                        {sdr.deals_won}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{sdr.deals_lost}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={
                        sdr.conversion_rate >= 50 ? 'text-green-600 font-medium' :
                        sdr.conversion_rate >= 30 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {sdr.conversion_rate?.toFixed(1) || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {sdr.avg_qualification_hours 
                            ? `${sdr.avg_qualification_hours.toFixed(1)}h`
                            : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sdr.revenue_attributed || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights de Qualificação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">🎯 Foco de Melhoria</h4>
              <p className="text-sm text-muted-foreground">
                {sdrLeaderboard.length > 0 && sdrLeaderboard[sdrLeaderboard.length - 1]?.conversion_rate < 30
                  ? `O SDR "${sdrLeaderboard[sdrLeaderboard.length - 1]?.sdr_name}" tem a menor taxa de conversão. Considere treinamento adicional.`
                  : 'Todos os SDRs estão com performance aceitável.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">⚡ Velocidade</h4>
              <p className="text-sm text-muted-foreground">
                {sdrLeaderboard.length > 0 
                  ? `Tempo médio de qualificação: ${
                      (sdrLeaderboard.reduce((sum, s) => sum + (s.avg_qualification_hours || 0), 0) / sdrLeaderboard.length).toFixed(1)
                    } horas`
                  : 'Sem dados de velocidade ainda.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
