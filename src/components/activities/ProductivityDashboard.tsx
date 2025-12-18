import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { getProductivityStats, ProductivityStats } from '@/services/supabase/activity-productivity';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Award, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductivityDashboardProps {
  className?: string;
}

export function ProductivityDashboard({ className }: ProductivityDashboardProps) {
  const [stats, setStats] = useState<ProductivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '14' | '30'>('14');

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const data = await getProductivityStats(Number(period));
        setStats(data);
      } catch (error) {
        console.error('Error loading productivity stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [period]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const weekChange = stats.totals.lastWeek > 0
    ? Math.round(((stats.totals.thisWeek - stats.totals.lastWeek) / stats.totals.lastWeek) * 100)
    : stats.totals.thisWeek > 0 ? 100 : 0;

  // Format data for chart
  const chartData = stats.daily.map(d => ({
    date: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
    fullDate: format(parseISO(d.date), "EEEE, dd 'de' MMMM", { locale: ptBR }),
    atividades: d.count,
  }));

  return (
    <div className={className}>
      {/* Period Selector */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Dashboard de Produtividade</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as '7' | '14' | '30')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="14">Últimos 14 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.today}</div>
            <p className="text-xs text-muted-foreground">atividades concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Esta Semana</CardTitle>
            <Target className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.thisWeek}</div>
            <div className="flex items-center gap-1 text-xs">
              {weekChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{weekChange}%</span>
                </>
              ) : weekChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">{weekChange}%</span>
                </>
              ) : (
                <>
                  <Minus className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">0%</span>
                </>
              )}
              <span className="text-muted-foreground">vs semana anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Semana Anterior</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.lastWeek}</div>
            <p className="text-xs text-muted-foreground">atividades concluídas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Este Mês</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.thisMonth}</div>
            <p className="text-xs text-muted-foreground">atividades concluídas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Atividades Concluídas por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg p-3">
                            <p className="text-sm font-medium capitalize">{data.fullDate}</p>
                            <p className="text-lg font-bold text-primary">{data.atividades} atividades</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="atividades" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Productivity by Seller */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Produtividade por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bySeller.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma atividade concluída no período selecionado
              </p>
            ) : (
              <div className="space-y-4">
                {stats.bySeller.map((seller, index) => {
                  const sellerChange = seller.lastWeek > 0
                    ? Math.round(((seller.thisWeek - seller.lastWeek) / seller.lastWeek) * 100)
                    : seller.thisWeek > 0 ? 100 : 0;

                  const maxTotal = stats.bySeller[0]?.totalCompleted || 1;
                  const barWidth = (seller.totalCompleted / maxTotal) * 100;

                  return (
                    <div key={seller.userId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge variant="default" className="text-xs">🏆 Top</Badge>}
                          <span className="font-medium">{seller.userName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Média: <span className="font-medium text-foreground">{seller.avgPerDay}/dia</span>
                          </span>
                          <span className="text-muted-foreground">
                            Semana: <span className="font-medium text-foreground">{seller.thisWeek}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {sellerChange > 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : sellerChange < 0 ? (
                              <TrendingDown className="h-3 w-3 text-destructive" />
                            ) : (
                              <Minus className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className={sellerChange > 0 ? 'text-green-500' : sellerChange < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                              {sellerChange > 0 ? '+' : ''}{sellerChange}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{seller.totalCompleted}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
