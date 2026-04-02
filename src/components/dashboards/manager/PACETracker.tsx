import { usePACEData, PACEMetrics } from '@/hooks/usePACEData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
};

const formatValue = (value: number, goalType?: string) => {
  if (goalType === 'leads') {
    return `${Math.round(value)} lead${Math.round(value) !== 1 ? 's' : ''}`;
  }
  return formatCurrency(value);
};

const getPaceIcon = (score: 'red' | 'yellow' | 'green') => {
  switch (score) {
    case 'green': return '🟢';
    case 'yellow': return '🟡';
    case 'red': return '🔴';
  }
};

const getPaceBadgeVariant = (score: 'red' | 'yellow' | 'green') => {
  switch (score) {
    case 'green': return 'default';
    case 'yellow': return 'secondary';
    case 'red': return 'destructive';
  }
};

interface PACETrackerProps {
  month?: Date;
}

export function PACETracker({ month }: PACETrackerProps) {
  const currentMonth = month || new Date();
  const { paceMetrics, isLoading } = usePACEData(currentMonth);

  // Calculate totals
  const totals = paceMetrics.reduce(
    (acc, m) => ({
      monthlyTarget: acc.monthlyTarget + m.monthlyTarget,
      targetUntilToday: acc.targetUntilToday + m.targetUntilToday,
      achieved: acc.achieved + m.achieved,
      projection: acc.projection + m.projection,
      paceVariance: acc.paceVariance + m.paceVariance,
    }),
    { monthlyTarget: 0, targetUntilToday: 0, achieved: 0, projection: 0, paceVariance: 0 }
  );

  const overallPacePercentage = totals.targetUntilToday > 0 
    ? (totals.achieved / totals.targetUntilToday) * 100 
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            PACE - Ritmo de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            PACE - Ritmo de Vendas
          </CardTitle>
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-muted/50"
          >
            <p className="text-xs text-muted-foreground">Meta do Mês</p>
            <p className="text-xl font-bold">{formatCurrency(totals.monthlyTarget)}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-lg bg-muted/50"
          >
            <p className="text-xs text-muted-foreground">Meta até Hoje</p>
            <p className="text-xl font-bold">{formatCurrency(totals.targetUntilToday)}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-lg bg-muted/50"
          >
            <p className="text-xs text-muted-foreground">Realizado</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(totals.achieved)}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-4 rounded-lg ${totals.paceVariance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}
          >
            <p className="text-xs text-muted-foreground">Δ vs PACE</p>
            <p className={`text-xl font-bold flex items-center gap-1 ${totals.paceVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.paceVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatCurrency(Math.abs(totals.paceVariance))}
            </p>
          </motion.div>
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso Geral</span>
            <span className="font-medium">{overallPacePercentage.toFixed(0)}%</span>
          </div>
          <Progress 
            value={Math.min(overallPacePercentage, 100)} 
            className="h-3"
          />
        </div>

        {/* Seller Table */}
        {paceMetrics.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Meta Mês</TableHead>
                <TableHead className="text-right">Meta Diária</TableHead>
                <TableHead className="text-right">Meta até Hoje</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Projeção</TableHead>
                <TableHead className="text-right">Δ vs PACE</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paceMetrics.map((metric) => (
                <TableRow key={metric.userId}>
                  <TableCell className="font-medium">{metric.userName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(metric.monthlyTarget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(metric.dailyTarget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(metric.targetUntilToday)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">
                    {formatCurrency(metric.achieved)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(metric.projection)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${metric.paceVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metric.paceVariance >= 0 ? '+' : ''}{formatCurrency(metric.paceVariance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getPaceBadgeVariant(metric.paceScore)}>
                      {getPaceIcon(metric.paceScore)} {metric.pacePercentage.toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma meta configurada</p>
            <p className="text-sm">Configure as metas dos vendedores em Configurações → Metas de Vendedores</p>
          </div>
        )}

        {/* Working Days Info */}
        {paceMetrics.length > 0 && (
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span>📅 Dias úteis no mês: {paceMetrics[0]?.workingDaysTotal || 0}</span>
            <span>✓ Dias úteis decorridos: {paceMetrics[0]?.workingDaysElapsed || 0}</span>
            <span>⏳ Dias úteis restantes: {paceMetrics[0]?.workingDaysLeft || 0}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
