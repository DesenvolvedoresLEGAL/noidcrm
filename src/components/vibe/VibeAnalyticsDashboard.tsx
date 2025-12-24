import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  MessageSquare, 
  Clock, 
  DollarSign, 
  PieChart,
  AlertTriangle,
  Flame,
  BarChart3
} from 'lucide-react';
import { useVibeAnalytics } from '@/hooks/useVibeAnalytics';
import { cn } from '@/lib/utils';

const VIBE_STATE_COLORS: Record<string, string> = {
  curioso: 'bg-blue-500',
  exploratorio: 'bg-cyan-500',
  cetico: 'bg-amber-500',
  comparativo: 'bg-purple-500',
  em_decisao: 'bg-green-500',
  travado: 'bg-red-500',
  quente_silencioso: 'bg-orange-500',
  pronto_inseguro: 'bg-yellow-500',
  desconhecido: 'bg-gray-400',
};

const VIBE_STATE_LABELS: Record<string, string> = {
  curioso: 'Curioso',
  exploratorio: 'Exploratório',
  cetico: 'Cético',
  comparativo: 'Comparativo',
  em_decisao: 'Em Decisão',
  travado: 'Travado',
  quente_silencioso: 'Quente Silencioso',
  pronto_inseguro: 'Pronto Inseguro',
  desconhecido: 'Desconhecido',
};

export function VibeAnalyticsDashboard() {
  const { data: analytics, isLoading } = useVibeAnalytics();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Retomada
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.conversationResumptionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.conversationResumptionCount} conversas retomadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resposta Após Silêncio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.responseAfterSilenceRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Leads que voltaram a responder
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Quente → Ganho
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.avgHotSilentToWonDays} dias
            </div>
            <p className="text-xs text-muted-foreground">
              Média de conversão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendas Sem Desconto
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analytics.noDiscountWinsRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.noDiscountWinsCount} vendas no valor cheio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo e Distribuição */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Rápido */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Resumo de Vibe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-sm">Total Analisados</span>
              </div>
              <span className="font-medium">{analytics.totalDealsAnalyzed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="text-sm">Deals Quentes</span>
              </div>
              <span className="font-medium text-orange-600">{analytics.hotDeals}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                <span className="text-sm">Alto Risco</span>
              </div>
              <span className="font-medium text-red-600">{analytics.highRiskDeals}</span>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Vibe State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Distribuição por Vibe State
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.vibeStateDistribution.slice(0, 6).map(({ state, count, percentage }) => (
              <div key={state} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{VIBE_STATE_LABELS[state] || state}</span>
                  <span className="text-muted-foreground">{count} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all", VIBE_STATE_COLORS[state] || 'bg-gray-400')}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {analytics.vibeStateDistribution.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dado de vibe state ainda
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
