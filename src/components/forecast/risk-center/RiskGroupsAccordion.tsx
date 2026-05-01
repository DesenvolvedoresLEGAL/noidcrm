import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import type { ForecastRiskGroupV2 } from '@/types/forecast-risk-center';
import { cn } from '@/lib/utils';

interface Props {
  groups: ForecastRiskGroupV2[];
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}

function severityClass(s: string): string {
  switch (s) {
    case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/30';
    case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function RiskGroupsAccordion({ groups }: Props) {
  const navigate = useNavigate();
  const visible = groups.filter((g) => (g.deals_count ?? 0) > 0);
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum grupo de risco identificado neste período.</p>;
  }
  return (
    <Accordion type="multiple" className="space-y-2">
      {visible.map((g) => (
        <AccordionItem key={g.group_key} value={g.group_key} className="border rounded-md">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex flex-1 items-center justify-between pr-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="outline" className={cn('shrink-0', severityClass(g.severity))}>{g.severity}</Badge>
                <span className="font-medium truncate">{g.title}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                <span>{g.deals_count} deals</span>
                <span className="font-semibold text-foreground">{fmtBRL(g.gross_amount)}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            <p className="text-sm text-muted-foreground">{g.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Bruto" value={fmtBRL(g.gross_amount)} />
              <Stat label="Ajustado" value={fmtBRL(g.adjusted_amount)} />
              <Stat label="Impacto Forecast" value={fmtBRL(g.forecast_impact)} />
              <Stat label="Recuperável" value={fmtBRL(g.recoverable_amount)} />
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Ação recomendada: </span>
              <span className="font-medium">{g.recommended_action}</span>
            </div>
            {g.deals.slice(0, 5).map((d) => (
              <button
                key={d.opportunity_id}
                type="button"
                onClick={() => navigate(`/oportunidades/${d.opportunity_id}`)}
                className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.deal_name || d.company_name || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {d.company_name} · {d.seller_name || '—'} · {d.forecast_bucket}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums shrink-0">{fmtBRL(d.deal_value)}</div>
                </div>
              </button>
            ))}
            {g.deals.length > 5 && (
              <p className="text-xs text-muted-foreground">+{g.deals.length - 5} deals adicionais neste grupo</p>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
