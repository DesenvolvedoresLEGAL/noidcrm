import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCloserPerformance } from '@/hooks/usePipelineMetrics';
import { TrendingUp, Users, Target, DollarSign, Clock, Award, Briefcase, Calendar } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function CloserPerformanceReport() {
  const { data: closerPerformance, isLoading } = useCloserPerformance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const leaderboard = [...(closerPerformance || [])].sort((a, b) => 
    (b.revenue_closed || 0) - (a.revenue_closed || 0)
  );

  const totalRevenue = leaderboard.reduce((sum, c) => sum + (c.revenue_closed || 0), 0);
  const totalDealsWon = leaderboard.reduce((sum, c) => sum + (c.deals_won || 0), 0);
  const totalDealsActive = leaderboard.reduce((sum, c) => sum + (c.deals_active || 0), 0);
  const avgWinRate = leaderboard.length > 0 
    ? leaderboard.reduce((sum, c) => sum + (c.win_rate || 0), 0) / leaderboard.length
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Fechada</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Total de vendas fechadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Ganhos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDealsWon}</div>
            <p className="text-xs text-muted-foreground">
              Total de oportunidades fechadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Ativo</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDealsActive}</div>
            <p className="text-xs text-muted-foreground">
              Oportunidades em andamento
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
              {avgWinRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Média de win rate do time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Ranking de Closers
          </CardTitle>
          <CardDescription>
            Performance dos vendedores ordenada por receita fechada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de Closer disponível ainda.</p>
              <p className="text-sm">Os dados aparecerão quando oportunidades forem fechadas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-center">Ganhos</TableHead>
                  <TableHead className="text-center">Perdidos</TableHead>
                  <TableHead className="text-center">Ativos</TableHead>
                  <TableHead className="text-center">Win Rate</TableHead>
                  <TableHead className="text-center">Ciclo Médio</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((closer, index) => (
                  <TableRow key={closer.closer_user_id}>
                    <TableCell>
                      {index === 0 && <Badge className="bg-yellow-500">🥇</Badge>}
                      {index === 1 && <Badge className="bg-gray-400">🥈</Badge>}
                      {index === 2 && <Badge className="bg-amber-600">🥉</Badge>}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}</span>}
                    </TableCell>
                    <TableCell className="font-medium">
                      {closer.closer_name || 'Usuário removido'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default" className="bg-green-600">
                        {closer.deals_won}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{closer.deals_lost}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{closer.deals_active}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={
                        closer.win_rate >= 50 ? 'text-green-600 font-medium' :
                        closer.win_rate >= 30 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {closer.win_rate?.toFixed(1) || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {closer.avg_sales_cycle_days 
                            ? `${Math.round(closer.avg_sales_cycle_days)}d`
                            : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(closer.avg_deal_size || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(closer.revenue_closed || 0)}
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
          <CardTitle>Insights de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">🏆 Top Performer</h4>
              <p className="text-sm text-muted-foreground">
                {leaderboard.length > 0
                  ? `${leaderboard[0]?.closer_name || 'N/A'} lidera com ${formatCurrency(leaderboard[0]?.revenue_closed || 0)} em vendas fechadas.`
                  : 'Sem dados de vendas ainda.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">⏱️ Ciclo de Vendas</h4>
              <p className="text-sm text-muted-foreground">
                {leaderboard.length > 0 
                  ? `Ciclo médio: ${Math.round(
                      leaderboard.reduce((sum, c) => sum + (c.avg_sales_cycle_days || 0), 0) / leaderboard.length
                    )} dias`
                  : 'Sem dados de ciclo ainda.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
