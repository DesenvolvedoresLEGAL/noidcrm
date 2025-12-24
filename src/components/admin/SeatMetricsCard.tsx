import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Bell, Calendar } from 'lucide-react';
import { useGlobalSeatMetrics, useSeatEvents } from '@/hooks/useSeatMetrics';
import { SeatAlertsCard } from './SeatAlertsCard';
import { SeatForecastCard } from './SeatForecastCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function SeatMetricsCard() {
  const { data: metrics, isLoading } = useGlobalSeatMetrics();
  const { data: recentEvents } = useSeatEvents(undefined, 5);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const {
    total_mrr,
    total_arr,
    total_seats,
    paying_orgs,
    avg_seats_per_org,
    revenue_per_seat,
    expansion_mrr,
    contraction_mrr,
    net_mrr_change,
    nrr_percent
  } = metrics;

  const expansionPercent = total_mrr > 0 ? (expansion_mrr / total_mrr) * 100 : 0;
  const contractionPercent = total_mrr > 0 ? (contraction_mrr / total_mrr) * 100 : 0;

  return (
    <Tabs defaultValue="metrics" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="metrics" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Métricas
        </TabsTrigger>
        <TabsTrigger value="alerts" className="gap-2">
          <Bell className="h-4 w-4" />
          Alertas
        </TabsTrigger>
        <TabsTrigger value="forecast" className="gap-2">
          <Calendar className="h-4 w-4" />
          Forecast
        </TabsTrigger>
      </TabsList>

      <TabsContent value="metrics" className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              MRR (Per-Seat)
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(total_mrr)}</p>
            <p className="text-xs text-muted-foreground">
              {total_seats} seats × {formatCurrency(revenue_per_seat)}/seat
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total Seats
            </div>
            <p className="text-2xl font-bold mt-1">{total_seats}</p>
            <p className="text-xs text-muted-foreground">
              {paying_orgs} orgs • ~{avg_seats_per_org} seats/org
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Target className="h-4 w-4" />
              NRR
            </div>
            <p className={`text-2xl font-bold mt-1 ${nrr_percent >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
              {nrr_percent}%
            </p>
            <p className="text-xs text-muted-foreground">
              Net Revenue Retention
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BarChart3 className="h-4 w-4" />
              Revenue/Seat
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(revenue_per_seat)}</p>
            <p className="text-xs text-muted-foreground">
              Receita média por usuário
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expansion vs Contraction */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Movimentação de MRR (Este Mês)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                Expansão
              </div>
              <p className="text-xl font-bold text-green-600">+{formatCurrency(expansion_mrr)}</p>
              <p className="text-xs text-muted-foreground">Seats adicionados</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-red-600">
                <TrendingDown className="h-4 w-4" />
                Contração
              </div>
              <p className="text-xl font-bold text-red-600">-{formatCurrency(contraction_mrr)}</p>
              <p className="text-xs text-muted-foreground">Seats removidos</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Net Change
              </div>
              <p className={`text-xl font-bold ${net_mrr_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {net_mrr_change >= 0 ? '+' : ''}{formatCurrency(net_mrr_change)}
              </p>
              <p className="text-xs text-muted-foreground">Variação líquida</p>
            </div>
          </div>

          {/* Progress bars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">Expansion Rate</span>
              <span>{expansionPercent.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(expansionPercent, 100)} className="h-2 [&>div]:bg-green-500" />
            
            <div className="flex items-center justify-between text-xs mt-3">
              <span className="text-red-600">Contraction Rate</span>
              <span>{contractionPercent.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(contractionPercent, 100)} className="h-2 [&>div]:bg-red-500" />
          </div>
        </CardContent>
      </Card>

      {/* Recent seat events */}
      {recentEvents && recentEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Eventos Recentes de Seats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEvents.map((event: any) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${
                      event.delta_mrr > 0 
                        ? 'bg-green-500/10 text-green-600' 
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {event.delta_mrr > 0 
                        ? <TrendingUp className="h-4 w-4" /> 
                        : <TrendingDown className="h-4 w-4" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {event.event_type === 'seat_added' && 'Seat adicionado'}
                        {event.event_type === 'seat_removed' && 'Seat removido'}
                        {event.event_type === 'reactivation' && 'Seat reativado'}
                        {event.event_type === 'plan_upgrade' && 'Upgrade de plano'}
                        {event.event_type === 'plan_downgrade' && 'Downgrade de plano'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.previous_seats} → {event.new_seats} seats
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={event.delta_mrr > 0 ? 'default' : 'destructive'} className="text-xs">
                      {event.delta_mrr > 0 ? '+' : ''}{formatCurrency(event.delta_mrr)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </TabsContent>

      <TabsContent value="alerts">
        <SeatAlertsCard />
      </TabsContent>

      <TabsContent value="forecast">
        <SeatForecastCard />
      </TabsContent>
    </Tabs>
  );
}
