import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Trophy, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { EmptyState } from '@/components/EmptyState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamVisibility } from '@/hooks/useTeamVisibility';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface SellerPerformance {
  user_id: string;
  name: string;
  avatar_url: string | null;
  won_count: number;
  won_value: number;
  lost_count: number;
  total_count: number;
  win_rate: number;
  avg_deal_value: number;
  rank: number;
}

export function TeamPerformanceReport() {
  const { visibleUserIds, canViewAll, loading: visibilityLoading } = useTeamVisibility();
  const { filters, effectiveDates } = useReportFiltersContext();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'team-performance', visibleUserIds, effectiveDates, filters.pipelines],
    queryFn: async () => {
      // Get processed opportunities in the period
      let query = supabase
        .from('opportunities')
        .select('id, owner_user_id, status, valor_previsto, updated_at, pipeline_id')
        .in('status', ['won', 'lost'])
        .gte('updated_at', effectiveDates.startDate)
        .lte('updated_at', effectiveDates.endDate + 'T23:59:59');

      if (!canViewAll && visibleUserIds && visibleUserIds.length > 0) {
        query = query.in('owner_user_id', visibleUserIds);
      }

      if (filters.pipelines.length > 0) {
        query = query.in('pipeline_id', filters.pipelines);
      }

      const { data: opportunities, error: oppsError } = await query;
      if (oppsError) throw oppsError;

      // Get user profiles
      const userIds = [...new Set((opportunities || []).map(o => o.owner_user_id).filter(Boolean))];
      
      if (userIds.length === 0) {
        return { sellers: [], totals: { won_value: 0, won_count: 0, avg_win_rate: 0 } };
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      // Aggregate by seller
      const sellerMap = new Map<string, SellerPerformance>();

      (opportunities || []).forEach(opp => {
        const userId = opp.owner_user_id;
        if (!userId) return;

        const existing = sellerMap.get(userId) || {
          user_id: userId,
          name: profiles?.find(p => p.user_id === userId)?.full_name || 'Usuário removido',
          avatar_url: profiles?.find(p => p.user_id === userId)?.avatar_url || null,
          won_count: 0,
          won_value: 0,
          lost_count: 0,
          total_count: 0,
          win_rate: 0,
          avg_deal_value: 0,
          rank: 0,
        };

        existing.total_count += 1;
        if (opp.status === 'won') {
          existing.won_count += 1;
          existing.won_value += opp.valor_previsto || 0;
        } else {
          existing.lost_count += 1;
        }

        sellerMap.set(userId, existing);
      });

      // Calculate derived metrics and rank
      const sellers = Array.from(sellerMap.values())
        .map(seller => ({
          ...seller,
          win_rate: seller.total_count > 0 ? (seller.won_count / seller.total_count) * 100 : 0,
          avg_deal_value: seller.won_count > 0 ? seller.won_value / seller.won_count : 0,
        }))
        .sort((a, b) => b.won_value - a.won_value)
        .map((seller, idx) => ({ ...seller, rank: idx + 1 }));

      const totals = {
        won_value: sellers.reduce((acc, s) => acc + s.won_value, 0),
        won_count: sellers.reduce((acc, s) => acc + s.won_count, 0),
        avg_win_rate: sellers.length > 0 
          ? sellers.reduce((acc, s) => acc + s.win_rate, 0) / sellers.length 
          : 0,
      };

      return { sellers, totals };
    },
    enabled: !visibilityLoading,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Erro ao carregar dados"
        description="Não foi possível carregar a performance da equipe."
      />
    );
  }

  if (!data || data.sellers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum dado de performance"
        description="Dados de performance aparecerão quando houver oportunidades processadas no período."
      />
    );
  }

  const chartData = data.sellers.slice(0, 10).map(s => ({
    name: s.name.split(' ')[0],
    fullName: s.name,
    valor: s.won_value,
    deals: s.won_count,
    winRate: s.win_rate,
  }));

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-yellow-950">🏆 1º</Badge>;
    if (rank === 2) return <Badge className="bg-gray-300 text-gray-800">🥈 2º</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-amber-50">🥉 3º</Badge>;
    return <Badge variant="outline">{rank}º</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-xl font-bold text-emerald-500">{formatCurrency(data.totals.won_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deals Fechados</p>
                <p className="text-xl font-bold">{data.totals.won_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa Média de Conversão</p>
                <p className="text-xl font-bold text-purple-500">{data.totals.avg_win_rate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ranking Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Ranking por Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate by Seller */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.sellers.slice(0, 8).map(seller => (
                <div key={seller.user_id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={seller.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {seller.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{seller.name}</span>
                      <span className="text-sm font-bold">{seller.win_rate.toFixed(0)}%</span>
                    </div>
                    <Progress value={seller.win_rate} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Detalhes por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Vendedor</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ganhos</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Perdidos</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Win Rate</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Receita</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {data.sellers.map(seller => (
                  <tr key={seller.user_id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3">{getRankBadge(seller.rank)}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={seller.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {seller.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{seller.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 text-emerald-500">{seller.won_count}</td>
                    <td className="text-right py-2 px-3 text-destructive">{seller.lost_count}</td>
                    <td className="text-right py-2 px-3">
                      <span className={seller.win_rate >= 50 ? 'text-emerald-500' : 'text-amber-500'}>
                        {seller.win_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-2 px-3 font-medium">{formatCurrency(seller.won_value)}</td>
                    <td className="text-right py-2 px-3 text-muted-foreground">
                      {formatCurrency(seller.avg_deal_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
