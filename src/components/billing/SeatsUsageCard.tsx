import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useSeatMetrics } from '@/hooks/useSeatMetrics';

interface SeatsUsageCardProps {
  compact?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function SeatsUsageCard({ compact = false }: SeatsUsageCardProps) {
  const { data: metrics, isLoading } = useSeatMetrics();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-2 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const { 
    active_seats, 
    mrr, 
    price_per_seat, 
    expansion_mrr_this_month,
    contraction_mrr_this_month
  } = metrics;

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {active_seats} usuários ativos
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {formatCurrency(mrr)}/mês
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Usuários da Organização</CardTitle>
        </div>
        <CardDescription>
          Gerencie os usuários da sua organização
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main metrics */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-bold">{active_seats}</span>
            <span className="text-muted-foreground ml-2">usuários ativos</span>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(mrr)}</p>
            <p className="text-xs text-muted-foreground">/mês</p>
          </div>
        </div>

        {/* Price info */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            Custo por usuário adicional
          </span>
          <span className="font-medium">+{formatCurrency(price_per_seat)}/mês</span>
        </div>

        {/* Monthly changes */}
        {(expansion_mrr_this_month > 0 || contraction_mrr_this_month > 0) && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {expansion_mrr_this_month > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+{formatCurrency(expansion_mrr_this_month)}</span>
              </div>
            )}
            {contraction_mrr_this_month > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600">-{formatCurrency(contraction_mrr_this_month)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
