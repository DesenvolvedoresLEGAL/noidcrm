import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, Target, Calendar,
  ArrowUpRight, ArrowDownRight, BarChart3, AlertCircle
} from 'lucide-react';
import { useForecastWithSeats } from '@/hooks/useForecastWithSeats';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const nrrStatusConfig = {
  excellent: { color: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Excelente' },
  good: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'Bom' },
  warning: { color: 'text-yellow-600', bgColor: 'bg-yellow-500/10', label: 'Atenção' },
  critical: { color: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Crítico' },
};

const trendConfig = {
  growing: { icon: TrendingUp, color: 'text-green-600', label: 'Crescendo' },
  stable: { icon: BarChart3, color: 'text-blue-600', label: 'Estável' },
  declining: { icon: TrendingDown, color: 'text-red-600', label: 'Declinando' },
};

const confidenceConfig = {
  high: { color: 'bg-green-500', label: 'Alta' },
  medium: { color: 'bg-yellow-500', label: 'Média' },
  low: { color: 'bg-red-500', label: 'Baixa' },
};

export function SeatForecastCard() {
  const { data: forecast, isLoading } = useForecastWithSeats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Dados insuficientes para forecast</p>
        </CardContent>
      </Card>
    );
  }

  const {
    currentMrr,
    currentArr,
    totalSeats,
    revenuePerSeat,
    avgMonthlyExpansion,
    avgMonthlyContraction,
    avgNetChange,
    expansionTrend,
    nrrPercent,
    nrrStatus,
    projectedMrrNextMonth,
    projectedMrr3Months,
    projectedMrr6Months,
    projectedSeats3Months,
    forecastConfidence,
    dataPointsCount,
  } = forecast;

  const TrendIcon = trendConfig[expansionTrend].icon;
  const nrrConfig = nrrStatusConfig[nrrStatus];
  const confConfig = confidenceConfig[forecastConfidence];

  const mrrGrowth3M = currentMrr > 0 ? ((projectedMrr3Months - currentMrr) / currentMrr) * 100 : 0;
  const mrrGrowth6M = currentMrr > 0 ? ((projectedMrr6Months - currentMrr) / currentMrr) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* NRR and Confidence Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Forecast de Revenue</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <div className={`w-2 h-2 rounded-full ${confConfig.color}`} />
                Confiança: {confConfig.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {dataPointsCount} data points
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* NRR */}
            <div className={`p-4 rounded-lg ${nrrConfig.bgColor}`}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4" />
                Net Revenue Retention
              </div>
              <p className={`text-3xl font-bold mt-1 ${nrrConfig.color}`}>
                {nrrPercent.toFixed(1)}%
              </p>
              <Badge variant="outline" className={`mt-1 ${nrrConfig.color}`}>
                {nrrConfig.label}
              </Badge>
            </div>

            {/* Trend */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendIcon className="h-4 w-4" />
                Tendência
              </div>
              <p className={`text-xl font-bold mt-1 ${trendConfig[expansionTrend].color}`}>
                {trendConfig[expansionTrend].label}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Média: {avgNetChange >= 0 ? '+' : ''}{formatCurrency(avgNetChange)}/mês
              </p>
            </div>

            {/* Monthly Expansion */}
            <div className="p-4 rounded-lg bg-green-500/10">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                Expansão Média
              </div>
              <p className="text-xl font-bold mt-1 text-green-600">
                +{formatCurrency(avgMonthlyExpansion)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
            </div>

            {/* Monthly Contraction */}
            <div className="p-4 rounded-lg bg-red-500/10">
              <div className="flex items-center gap-2 text-sm text-red-600">
                <ArrowDownRight className="h-4 w-4" />
                Contração Média
              </div>
              <p className="text-xl font-bold mt-1 text-red-600">
                -{formatCurrency(avgMonthlyContraction)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projections */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Projeções de MRR</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Current */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Atual</p>
              <p className="text-2xl font-bold">{formatCurrency(currentMrr)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalSeats} seats • {formatCurrency(revenuePerSeat)}/seat
              </p>
            </div>

            {/* Next Month */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Próximo Mês</p>
              <p className="text-2xl font-bold">{formatCurrency(projectedMrrNextMonth)}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${avgNetChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgNetChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {avgNetChange >= 0 ? '+' : ''}{formatCurrency(avgNetChange)}
              </p>
            </div>

            {/* 3 Months */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Em 3 Meses</p>
              <p className="text-2xl font-bold">{formatCurrency(projectedMrr3Months)}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${mrrGrowth3M >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {mrrGrowth3M >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {mrrGrowth3M >= 0 ? '+' : ''}{mrrGrowth3M.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                ~{projectedSeats3Months} seats
              </p>
            </div>

            {/* 6 Months */}
            <div className="p-4 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Em 6 Meses</p>
              <p className="text-2xl font-bold">{formatCurrency(projectedMrr6Months)}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${mrrGrowth6M >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {mrrGrowth6M >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {mrrGrowth6M >= 0 ? '+' : ''}{mrrGrowth6M.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* ARR Projection */}
          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">ARR Projetado (6 meses)</p>
                <p className="text-xs text-muted-foreground">Baseado na tendência atual</p>
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(projectedMrr6Months * 12)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
