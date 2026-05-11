import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { buildExecutiveDiagnosis, type Severity } from '@/lib/winloss/diagnosis';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

const SEVERITY_STYLES: Record<Severity, { badge: string; border: string; bg: string; label: string }> = {
  low:      { badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5',  label: 'Baixo' },
  medium:   { badge: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',   border: 'border-yellow-500/20',  bg: 'bg-yellow-500/5',   label: 'Médio' },
  high:     { badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30',     border: 'border-amber-500/20',   bg: 'bg-amber-500/5',    label: 'Alto' },
  critical: { badge: 'bg-red-500/15 text-red-600 border-red-500/30',           border: 'border-red-500/20',     bg: 'bg-red-500/5',      label: 'Crítico' },
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

interface Props {
  data: WinLossDataResult | undefined;
  dateRange: { from: Date; to: Date };
}

export function AIDiagnosisCard({ data, dateRange }: Props) {
  if (!data) return null;
  const diag = buildExecutiveDiagnosis(data, dateRange);
  if (!diag) return null;
  const sev = SEVERITY_STYLES[diag.severity];

  return (
    <Card className={`${sev.border} ${sev.bg}`}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Diagnóstico Executivo da IA</h3>
          </div>
          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${sev.badge}`}>
            Severidade: {sev.label}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed">{diag.copy}</p>

        <div className="grid sm:grid-cols-3 gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-muted-foreground">Top motivo:</span>
            <span className="font-semibold">{diag.topLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-muted-foreground">Valor perdido:</span>
            <span className="font-semibold">{fmtBRL(diag.topLostValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-muted-foreground">Δ ciclo (perda − ganho):</span>
            <span className="font-semibold">
              {diag.cycleDelta != null ? `${diag.cycleDelta > 0 ? '+' : ''}${diag.cycleDelta}d` : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
