import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, TrendingDown, AlertCircle, LifeBuoy, Gauge } from 'lucide-react';
import type { ForecastRiskSummaryV2 } from '@/types/forecast-risk-center';
import { getRiskScoreLabel } from '@/types/forecast-risk-center';
import { cn } from '@/lib/utils';

interface Props {
  summary: ForecastRiskSummaryV2;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function toneClass(tone: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (tone) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    default: return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
  }
}

export function RiskSummaryCards({ summary }: Props) {
  const score = summary.risk_score ?? 0;
  const scoreLabel = getRiskScoreLabel(score);

  const cards = [
    { title: 'Valor Total em Risco', value: fmtBRL(summary.total_risk_amount), icon: AlertTriangle, hint: `${summary.total_risk_deals} deals`, tone: 'high' as const },
    { title: 'Deals em Risco', value: String(summary.total_risk_deals ?? 0), icon: AlertCircle, hint: 'Oportunidades afetadas', tone: 'medium' as const },
    { title: 'Slipping', value: fmtBRL(summary.slipping_amount), icon: TrendingDown, hint: `${summary.slipping_deals} deals`, tone: 'high' as const },
    { title: 'Forecast Contaminado', value: fmtBRL(summary.contaminated_realistic_amount), icon: ShieldAlert, hint: `${summary.contaminated_realistic_deals} deals`, tone: 'critical' as const },
    { title: 'Valor Recuperável', value: fmtBRL(summary.recoverable_amount), icon: LifeBuoy, hint: 'Potencial de recuperação', tone: 'low' as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.title} className="border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.title}</span>
              <c.icon className={cn('h-4 w-4', c.tone === 'critical' && 'text-red-600', c.tone === 'high' && 'text-orange-600', c.tone === 'medium' && 'text-amber-600', c.tone === 'low' && 'text-emerald-600')} />
            </div>
            <div className="text-lg font-semibold tabular-nums">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.hint}</div>
          </CardContent>
        </Card>
      ))}
      <Card className={cn('border', toneClass(scoreLabel.tone))}>
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs">Score de Risco</span>
            <Gauge className="h-4 w-4" />
          </div>
          <div className="text-lg font-semibold tabular-nums">{score}/100</div>
          <Badge variant="outline" className={cn('mt-1', toneClass(scoreLabel.tone))}>{scoreLabel.label}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
