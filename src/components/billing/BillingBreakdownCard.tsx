import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBillingProjection } from '@/hooks/useSeatHistory';
import { formatCurrencyFull } from '@/lib/i18n';
import { 
  Users, 
  Calculator,
  TrendingUp,
  Info
} from 'lucide-react';

export function BillingBreakdownCard() {
  const { data: projection, isLoading } = useBillingProjection();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!projection) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Detalhamento de Custos
        </CardTitle>
        <CardDescription>
          Entenda como seu custo mensal é calculado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Cost Breakdown */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold">Custo Atual</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-primary">{projection.currentSeats}</div>
              <div className="text-xs text-muted-foreground">usuários</div>
            </div>
            <div className="flex items-center justify-center text-2xl text-muted-foreground">×</div>
            <div>
              <div className="text-2xl font-semibold">{formatCurrencyFull(projection.pricePerSeat)}</div>
              <div className="text-xs text-muted-foreground">por usuário</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-primary/20 text-center">
            <div className="text-sm text-muted-foreground">Total Mensal (MRR)</div>
            <div className="text-3xl font-bold text-primary">
              {formatCurrencyFull(projection.currentMrr)}
            </div>
          </div>
        </div>

        {/* Projections */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">+1 usuário</span>
            </div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrencyFull(projection.projectedMrrWithOneMore)}
              <span className="text-sm font-normal">/mês</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              +{formatCurrencyFull(projection.pricePerSeat)} ao total
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted border">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              <span className="text-sm font-medium">ARR Estimado</span>
            </div>
            <div className="text-xl font-bold">
              {formatCurrencyFull(projection.arr)}
              <span className="text-sm font-normal text-muted-foreground">/ano</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {projection.currentSeats} × {formatCurrencyFull(projection.pricePerSeat)} × 12
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
