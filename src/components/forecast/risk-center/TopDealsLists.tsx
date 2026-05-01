import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LifeBuoy } from 'lucide-react';
import type { ForecastRiskDealV2 } from '@/types/forecast-risk-center';
import { cn } from '@/lib/utils';

interface Props {
  risky: ForecastRiskDealV2[];
  recovery: ForecastRiskDealV2[];
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('pt-BR'); } catch { return '—'; }
}

function riskBadge(level: string | null): string {
  switch (level) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function DealRow({ d }: { d: ForecastRiskDealV2 }) {
  const navigate = useNavigate();
  const reason = d.penalty_reasons?.[0] || d.exclusion_reasons?.[0] || d.recommended_action;
  return (
    <button
      type="button"
      onClick={() => navigate(`/oportunidades/${d.opportunity_id}`)}
      className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors space-y-1"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{d.company_name || d.deal_name || 'Sem empresa'}</div>
          <div className="text-xs text-muted-foreground truncate">{d.deal_name} · {d.seller_name || '—'}</div>
        </div>
        <div className="text-sm font-semibold tabular-nums shrink-0">{fmtBRL(d.deal_value)}</div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px]">{d.forecast_bucket}</Badge>
          {d.risk_level && <Badge variant="outline" className={cn('text-[10px]', riskBadge(d.risk_level))}>{d.risk_level}</Badge>}
          <span className="text-muted-foreground">close: {fmtDate(d.close_date)}</span>
        </div>
        <span className="text-muted-foreground truncate max-w-[40%]" title={String(reason)}>{String(reason)}</span>
      </div>
    </button>
  );
}

export function TopDealsLists({ risky, recovery }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Top Deals Mais Perigosos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {risky.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem deals críticos identificados.</p>
          ) : risky.map((d) => <DealRow key={d.opportunity_id} d={d} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-emerald-600" />
            Top Deals para Recuperar o Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recovery.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem deals recuperáveis no momento.</p>
          ) : recovery.map((d) => <DealRow key={d.opportunity_id} d={d} />)}
        </CardContent>
      </Card>
    </div>
  );
}
