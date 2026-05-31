import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown, Target, Lightbulb, Brain, Eye, RotateCcw } from 'lucide-react';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';
import { getLossCategoryLabel } from '@/utils/category-labels';

interface SmartAlertsCardProps {
  losses: Array<{
    opportunity?: {
      created_at?: string;
    };
    reason?: { name: string } | null;
    reason_seller?: string;
    competitor?: string;
    price_factor?: boolean;
    timing_factor?: boolean;
    feature_factor?: boolean;
    relationship_factor?: boolean;
  }>;
  lossReasons: Array<{ reason: string; count: number }>;
  isLoading: boolean;
  contextLabel: string;
  semantic?: LossSemanticAggregates;
}

interface Alert {
  type: 'warning' | 'trend_up' | 'trend_down' | 'insight';
  icon: React.ReactNode;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export function SmartAlertsCard({ losses, lossReasons, isLoading, contextLabel, semantic }: SmartAlertsCardProps) {
  const alerts: Alert[] = [];

  if (losses && losses.length > 0 && lossReasons.length > 0) {
    const totalLosses = losses.length;
    
    // Alert 1: Top loss reason percentage
    const topReason = lossReasons[0];
    const topReasonPercentage = Math.round((topReason.count / totalLosses) * 100);
    
    if (topReasonPercentage >= 40) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: `⚠️ ${topReasonPercentage}% das ${contextLabel.toLowerCase()} são por "${topReason.reason}" - revise sua estratégia`,
        severity: 'high'
      });
    } else if (topReasonPercentage >= 25) {
      alerts.push({
        type: 'insight',
        icon: <Target className="h-4 w-4" />,
        message: `🎯 Principal motivo de ${contextLabel.toLowerCase()}: "${topReason.reason}" (${topReasonPercentage}%)`,
        severity: 'medium'
      });
    }

    // Alert 2: Price factor analysis
    const priceLosses = losses.filter(l => l.price_factor).length;
    const pricePercentage = Math.round((priceLosses / totalLosses) * 100);
    if (pricePercentage >= 30) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: `💰 ${pricePercentage}% das ${contextLabel.toLowerCase()} têm fator preço - considere revisar pricing`,
        severity: 'high'
      });
    }

    // Alert 3: Competition analysis
    const competitorLosses = losses.filter(l => l.competitor).length;
    if (competitorLosses >= 3) {
      const competitorPercentage = Math.round((competitorLosses / totalLosses) * 100);
      alerts.push({
        type: 'insight',
        icon: <Lightbulb className="h-4 w-4" />,
        message: `🏢 ${competitorPercentage}% das ${contextLabel.toLowerCase()} mencionam concorrência - analise diferenciais`,
        severity: 'medium'
      });
    }

    // Alert 4: Monthly trend analysis
    const now = new Date();
    const thisMonth = losses.filter(l => {
      const date = l.opportunity?.created_at;
      if (!date) return false;
      const lossDate = new Date(date);
      return lossDate.getMonth() === now.getMonth() && lossDate.getFullYear() === now.getFullYear();
    }).length;

    const lastMonth = losses.filter(l => {
      const date = l.opportunity?.created_at;
      if (!date) return false;
      const lossDate = new Date(date);
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return lossDate.getMonth() === prevMonth && lossDate.getFullYear() === prevYear;
    }).length;

    if (lastMonth > 0) {
      const changePercentage = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      if (changePercentage >= 20) {
        alerts.push({
          type: 'trend_up',
          icon: <TrendingUp className="h-4 w-4" />,
          message: `📈 ${contextLabel} aumentaram ${changePercentage}% este mês - investigue causas`,
          severity: 'high'
        });
      } else if (changePercentage <= -20) {
        alerts.push({
          type: 'trend_down',
          icon: <TrendingDown className="h-4 w-4" />,
          message: `📉 ${contextLabel} reduziram ${Math.abs(changePercentage)}% este mês - ótimo trabalho!`,
          severity: 'low'
        });
      }
    }

    // Alert 5: Feature factor analysis
    const featureLosses = losses.filter(l => l.feature_factor).length;
    const featurePercentage = Math.round((featureLosses / totalLosses) * 100);
    if (featurePercentage >= 25) {
      alerts.push({
        type: 'insight',
        icon: <Lightbulb className="h-4 w-4" />,
        message: `🔧 ${featurePercentage}% das ${contextLabel.toLowerCase()} citam funcionalidades - feedback para produto`,
        severity: 'medium'
      });
    }
  }

  if (isLoading) {
    return (
      <Card className="border-amber-500/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Alertas Inteligentes
          </CardTitle>
          <CardDescription>Insights automáticos sobre suas {contextLabel.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Lightbulb className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem alertas no momento</p>
            <p className="text-xs mt-1">Alertas aparecem quando padrões são detectados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Alertas Inteligentes
        </CardTitle>
        <CardDescription>Insights automáticos sobre suas {contextLabel.toLowerCase()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg border flex items-start gap-3 ${
                alert.severity === 'high' 
                  ? 'bg-destructive/5 border-destructive/20' 
                  : alert.severity === 'medium'
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-emerald-500/5 border-emerald-500/20'
              }`}
            >
              <div className={`mt-0.5 ${
                alert.severity === 'high' 
                  ? 'text-destructive' 
                  : alert.severity === 'medium'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
              }`}>
                {alert.icon}
              </div>
              <p className="text-sm flex-1">{alert.message}</p>
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  alert.severity === 'high' 
                    ? 'border-destructive/30 text-destructive' 
                    : alert.severity === 'medium'
                      ? 'border-amber-500/30 text-amber-600'
                      : 'border-emerald-500/30 text-emerald-600'
                }`}
              >
                {alert.severity === 'high' ? 'Alto' : alert.severity === 'medium' ? 'Médio' : 'Baixo'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
