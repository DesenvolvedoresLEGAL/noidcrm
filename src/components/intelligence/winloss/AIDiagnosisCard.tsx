import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, Clock, DollarSign, Eye, RotateCcw } from 'lucide-react';
import { buildExecutiveDiagnosis, type Severity } from '@/lib/winloss/diagnosis';
import { getLossCategoryLabel } from '@/utils/category-labels';
import type { WinLossDataResult } from '@/hooks/useWinLossData';
import type { LossSemanticAggregates } from '@/hooks/useLossSemantic';

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
  semantic?: LossSemanticAggregates;
}

export function AIDiagnosisCard({ data, dateRange, semantic }: Props) {
  if (!data) return null;
  const diag = buildExecutiveDiagnosis(data, dateRange);
  if (!diag) return null;
  const sev = SEVERITY_STYLES[diag.severity];

  // Síntese humano × IA: categoria mais reportada pelo vendedor (top do diag) vs categoria mais inferida pela IA
  const declaredTop = diag.topCategory;
  const inferredTop = semantic?.inferredRanking?.[0]?.category;
  const hasMismatch = !!inferredTop && inferredTop !== declaredTop;

  return (
    <Card className={`${sev.border} ${sev.bg}`}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold">Diagnóstico Executivo da IA</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {semantic && semantic.recoverableRevenue > 0 && (
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                <RotateCcw className="h-3 w-3 mr-1" />
                Recuperável: {fmtBRL(semantic.recoverableRevenue)}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${sev.badge}`}>
              Severidade: {sev.label}
            </Badge>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{diag.copy}</p>

        {hasMismatch && (
          <div className="flex items-start gap-2 text-xs p-2 rounded-md border border-amber-500/30 bg-amber-500/5">
            <Eye className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="leading-snug">
              <span className="font-semibold">Atenção:</span> vendedores reportam{' '}
              <span className="font-medium">{getLossCategoryLabel(declaredTop)}</span>, mas a IA detecta{' '}
              <span className="font-medium">{getLossCategoryLabel(inferredTop!)}</span> como causa real predominante.
            </p>
          </div>
        )}

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
