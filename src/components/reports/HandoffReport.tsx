import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useHandoffMetrics } from '@/hooks/usePipelineMetrics';
import { ArrowRight, Users, DollarSign, Target, Clock, Handshake } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function HandoffReport() {
  const { data: handoffMetrics, isLoading } = useHandoffMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const metrics = handoffMetrics || [];
  
  const totalHandoffs = metrics.reduce((sum, m) => sum + m.total_handoffs, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue_from_handoffs, 0);
  const totalWon = metrics.reduce((sum, m) => sum + m.won_after_handoff, 0);
  const avgWinRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.handoff_win_rate, 0) / metrics.length
    : 0;

  // Agrupar por SDR
  const sdrGroups = metrics.reduce((acc, m) => {
    if (!acc[m.sdr_user_id]) {
      acc[m.sdr_user_id] = {
        sdr_name: m.sdr_name,
        total_handoffs: 0,
        total_won: 0,
        total_revenue: 0,
        closers: []
      };
    }
    acc[m.sdr_user_id].total_handoffs += m.total_handoffs;
    acc[m.sdr_user_id].total_won += m.won_after_handoff;
    acc[m.sdr_user_id].total_revenue += m.revenue_from_handoffs;
    acc[m.sdr_user_id].closers.push(m);
    return acc;
  }, {} as Record<string, { sdr_name: string; total_handoffs: number; total_won: number; total_revenue: number; closers: typeof metrics }>);

  const sdrList = Object.entries(sdrGroups)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Handoffs</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHandoffs}</div>
            <p className="text-xs text-muted-foreground">
              Leads qualificados transferidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Ganhos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWon}</div>
            <p className="text-xs text-muted-foreground">
              Após handoff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate Médio</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWinRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Conversão pós-handoff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Gerada</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              De leads qualificados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Handoffs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Matriz de Handoffs SDR → Closer
          </CardTitle>
          <CardDescription>
            Desempenho das transições entre pré-vendas e vendas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de handoff disponível ainda.</p>
              <p className="text-sm">Os dados aparecerão quando leads forem qualificados e passados para vendas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SDR</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead className="text-center">Handoffs</TableHead>
                  <TableHead className="text-center">Ganhos</TableHead>
                  <TableHead className="text-center">Perdidos</TableHead>
                  <TableHead className="text-center">Ativos</TableHead>
                  <TableHead className="text-center">Win Rate</TableHead>
                  <TableHead className="text-center">Tempo Qual.</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((handoff, index) => (
                  <TableRow key={`${handoff.sdr_user_id}-${handoff.closer_user_id}-${index}`}>
                    <TableCell className="font-medium">
                      {handoff.sdr_name || 'SDR removido'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {handoff.closer_name || 'Sem closer atribuído'}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{handoff.total_handoffs}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="default" className="bg-green-600">
                        {handoff.won_after_handoff}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{handoff.lost_after_handoff}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{handoff.active_after_handoff}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={
                        handoff.handoff_win_rate >= 50 ? 'text-green-600 font-medium' :
                        handoff.handoff_win_rate >= 30 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {handoff.handoff_win_rate?.toFixed(1) || 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {handoff.avg_qualification_hours 
                            ? `${handoff.avg_qualification_hours.toFixed(1)}h`
                            : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(handoff.revenue_from_handoffs || 0)}
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
          <CardTitle>Insights de Handoff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">🤝 Melhor Parceria</h4>
              <p className="text-sm text-muted-foreground">
                {metrics.length > 0
                  ? `${metrics.sort((a, b) => b.revenue_from_handoffs - a.revenue_from_handoffs)[0]?.sdr_name || 'N/A'} → ${metrics.sort((a, b) => b.revenue_from_handoffs - a.revenue_from_handoffs)[0]?.closer_name || 'N/A'} com ${formatCurrency(metrics.sort((a, b) => b.revenue_from_handoffs - a.revenue_from_handoffs)[0]?.revenue_from_handoffs || 0)}`
                  : 'Sem dados de parceria ainda.'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">📊 Eficiência</h4>
              <p className="text-sm text-muted-foreground">
                {totalHandoffs > 0
                  ? `${((totalWon / totalHandoffs) * 100).toFixed(1)}% dos leads qualificados foram convertidos em vendas`
                  : 'Sem dados de eficiência ainda.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
