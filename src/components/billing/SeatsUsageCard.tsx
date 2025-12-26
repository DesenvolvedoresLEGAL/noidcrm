import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useSeatMetrics } from '@/hooks/useSeatMetrics';
import { useNavigate } from 'react-router-dom';

interface SeatsUsageCardProps {
  compact?: boolean;
  showUpgradeButton?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function SeatsUsageCard({ compact = false, showUpgradeButton = true }: SeatsUsageCardProps) {
  const { data: metrics, isLoading } = useSeatMetrics();
  const navigate = useNavigate();

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
    max_users, 
    mrr, 
    price_per_seat, 
    seats_usage_percent,
    expansion_mrr_this_month,
    contraction_mrr_this_month,
    net_mrr_change_this_month
  } = metrics;

  // max_users = null means unlimited users
  const hasUserLimit = max_users !== null && max_users > 0;
  const isNearLimit = hasUserLimit && seats_usage_percent !== null && seats_usage_percent >= 80;
  const isAtLimit = hasUserLimit && seats_usage_percent !== null && seats_usage_percent >= 100;

  if (compact) {
    return (
      <Card className={isNearLimit ? 'border-warning' : ''}>
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
          {hasUserLimit && (
            <Progress 
              value={seats_usage_percent || 0} 
              className={`h-1.5 mt-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`} 
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isNearLimit ? 'border-warning' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Usuários da Organização</CardTitle>
          </div>
          {isNearLimit && !isAtLimit && (
            <Badge variant="outline" className="gap-1 text-warning border-warning">
              <AlertTriangle className="h-3 w-3" />
              Próximo do limite
            </Badge>
          )}
          {isAtLimit && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Limite atingido
            </Badge>
          )}
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

        {/* Progress bar - only show if there's a user limit */}
        {hasUserLimit && (
          <div className="space-y-1">
            <Progress 
              value={seats_usage_percent || 0} 
              className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`} 
            />
            <p className="text-xs text-muted-foreground text-right">
              {active_seats} / {max_users} ({seats_usage_percent?.toFixed(0)}%)
            </p>
          </div>
        )}

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

        {/* Upgrade button - only show if there's a limit and near it */}
        {showUpgradeButton && hasUserLimit && isNearLimit && (
          <Button 
            className="w-full mt-2" 
            onClick={() => navigate('/app/settings/billing')}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Aumentar limite de usuários
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
