import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVolts } from '@/hooks/useVolts';
import { usePlanType } from '@/hooks/usePlanType';
import { Zap, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface VoltsWidgetProps {
  compact?: boolean;
  className?: string;
}

export function VoltsWidget({ compact = false, className }: VoltsWidgetProps) {
  const navigate = useNavigate();
  const { isAutonomous, consumesVolts } = usePlanType();
  const { 
    totalVolts, 
    usedVolts, 
    availableVolts, 
    usagePercentage, 
    isLow, 
    isCritical, 
    isDepleted,
    daysUntilReset,
    isLoading 
  } = useVolts();

  // Don't show for non-autonomous plans
  if (!isAutonomous || !consumesVolts()) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="py-4">
          <div className="h-16 bg-muted/30 rounded" />
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = () => {
    if (isDepleted) return 'text-destructive';
    if (isCritical) return 'text-destructive';
    if (isLow) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getProgressColor = () => {
    if (isDepleted || isCritical) return 'bg-destructive';
    if (isLow) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border bg-card', className)}>
        <div className={cn('p-2 rounded-lg', getStatusColor().replace('text-', 'bg-') + '/10')}>
          <Zap className={cn('w-4 h-4', getStatusColor())} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">VOLTS</span>
            <span className={cn('text-sm font-bold', getStatusColor())}>
              {availableVolts.toLocaleString('pt-BR')}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-1.5" 
          />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Consumo de VOLTS
          </CardTitle>
          {(isLow || isCritical || isDepleted) && (
            <Badge 
              variant="outline" 
              className={cn(
                'gap-1',
                isDepleted && 'bg-destructive/10 text-destructive border-destructive/30',
                isCritical && !isDepleted && 'bg-destructive/10 text-destructive border-destructive/30',
                isLow && !isCritical && 'bg-amber-500/10 text-amber-600 border-amber-500/30'
              )}
            >
              <AlertTriangle className="w-3 h-3" />
              {isDepleted ? 'Esgotado' : isCritical ? 'Crítico' : 'Baixo'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usado este período</span>
            <span className={cn('font-semibold', getStatusColor())}>
              {usedVolts.toLocaleString('pt-BR')} / {totalVolts.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={usagePercentage} 
              className="h-3"
            />
            <div 
              className={cn(
                'absolute top-0 left-0 h-full rounded-full transition-all',
                getProgressColor()
              )}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Disponível</p>
            <p className={cn('font-bold', getStatusColor())}>
              {availableVolts.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Consumido</p>
            <p className="font-bold text-foreground">
              {usedVolts.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-0.5">Reset em</p>
            <p className="font-bold text-foreground flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" />
              {daysUntilReset}d
            </p>
          </div>
        </div>

        {/* Upgrade CTA when low */}
        {(isLow || isDepleted) && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2"
            onClick={() => navigate('/app/settings/billing')}
          >
            <TrendingUp className="w-4 h-4" />
            {isDepleted ? 'Comprar VOLTS extras' : 'Aumentar limite'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
