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
  /** SSoT CRM Trust Score (motor determinístico WL-LOSS-04). Sobrescreve o legado de loss_semantic_analyses. */
  crmTrustScore?: number;
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

  // Sprint WL-UI-02 — Mensagens curtas, executivas, sem emojis.
  if (losses && losses.length > 0 && lossReasons.length > 0) {
    const totalLosses = losses.length;

    // Top loss reason
    const topReason = lossReasons[0];
    const topReasonPercentage = Math.round((topReason.count / totalLosses) * 100);
    if (topReasonPercentage >= 40) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: `${topReasonPercentage}% das perdas por "${topReason.reason}". Revisar estratégia.`,
        severity: 'high',
      });
    } else if (topReasonPercentage >= 25) {
      alerts.push({
        type: 'insight',
        icon: <Target className="h-4 w-4" />,
        message: `Motivo dominante: ${topReason.reason} (${topReasonPercentage}% das perdas).`,
        severity: 'medium',
      });
    }

    // Price factor
    const priceLosses = losses.filter(l => l.price_factor).length;
    const pricePercentage = Math.round((priceLosses / totalLosses) * 100);
    if (pricePercentage >= 30) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: `Preço pesa em ${pricePercentage}% das perdas. Revisar pricing.`,
        severity: 'high',
      });
    }

    // Competition
    const competitorLosses = losses.filter(l => l.competitor).length;
    if (competitorLosses >= 3) {
      const competitorPercentage = Math.round((competitorLosses / totalLosses) * 100);
      alerts.push({
        type: 'insight',
        icon: <Lightbulb className="h-4 w-4" />,
        message: `Concorrência em ${competitorPercentage}% das perdas. Atualizar battlecards.`,
        severity: 'medium',
      });
    }

    // Trend mês vs mês anterior
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
          message: `Perdas +${changePercentage}% vs mês anterior. Investigar.`,
          severity: 'high',
        });
      } else if (changePercentage <= -20) {
        alerts.push({
          type: 'trend_down',
          icon: <TrendingDown className="h-4 w-4" />,
          message: `Perdas −${Math.abs(changePercentage)}% vs mês anterior.`,
          severity: 'low',
        });
      }
    }
  }

  // === Alertas semânticos (motor invisível da IA) ===
  if (semantic && semantic.total > 0) {
    if (semantic.crmTrustScore < 60) {
      alerts.push({
        type: 'warning',
        icon: <Brain className="h-4 w-4" />,
        message: `Trust Score ${semantic.crmTrustScore}/100. Diagnósticos de perda pouco confiáveis.`,
        severity: semantic.crmTrustScore < 40 ? 'high' : 'medium',
      });
    }

    const weakShare =
      semantic.total > 0
        ? Math.round(((semantic.qualityBuckets.weak + semantic.qualityBuckets.missing) / semantic.total) * 100)
        : 0;
    if (weakShare >= 30) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: `${weakShare}% das perdas sem diagnóstico confiável. Reforçar registro obrigatório.`,
        severity: weakShare >= 50 ? 'high' : 'medium',
      });
    }

    if (semantic.gapPct >= 20) {
      alerts.push({
        type: 'warning',
        icon: <Eye className="h-4 w-4" />,
        message: `Gap vendedor × cliente em ${semantic.gapPct}% das perdas.`,
        severity: semantic.gapPct >= 35 ? 'high' : 'medium',
      });
    }

    if (semantic.recoverableRevenue > 0 && semantic.recoverableCount > 0) {
      alerts.push({
        type: 'insight',
        icon: <RotateCcw className="h-4 w-4" />,
        message: `${fmtBRL(semantic.recoverableRevenue)} recuperáveis em ${semantic.recoverableCount} ${semantic.recoverableCount > 1 ? 'deals' : 'deal'}.`,
        severity: 'low',
      });
    }

    const declaredTop = semantic.declaredRanking[0];
    const inferredTop = semantic.inferredRanking[0];
    if (
      declaredTop &&
      inferredTop &&
      inferredTop.category !== declaredTop.category &&
      inferredTop.pct >= 25
    ) {
      alerts.push({
        type: 'insight',
        icon: <Brain className="h-4 w-4" />,
        message: `Motivo oculto: IA aponta ${getLossCategoryLabel(inferredTop.category)} em ${inferredTop.pct}% das perdas.`,
        severity: 'medium',
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

  // Ordenar por severidade (high > medium > low) e limitar a 3 para evitar poluição visual.
  const severityWeight: Record<Alert['severity'], number> = { high: 3, medium: 2, low: 1 };
  const sortedAlerts = [...alerts]
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 3);

  if (sortedAlerts.length === 0) {
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
          {sortedAlerts.map((alert, index) => (
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
