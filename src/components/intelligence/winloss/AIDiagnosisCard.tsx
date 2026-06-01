// Sprint WL-UI-02 — Cockpit executivo: 3 blocos escaneáveis.
// Principal Vazamento · Ação Recomendada · Impacto Estimado.
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, Clock, DollarSign, Eye, RotateCcw, Lightbulb, TrendingUp } from 'lucide-react';
import { buildExecutiveDiagnosis, buildImpactEstimate, type Severity } from '@/lib/winloss/diagnosis';
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
  const impact = buildImpactEstimate(data, diag, dateRange);

  const declaredTop = diag.topCategory;
  const inferredTop = semantic?.inferredRanking?.[0]?.category;
  const hasMismatch = !!inferredTop && inferredTop !== declaredTop;

  return (
    <Card className={`${sev.border} ${sev.bg}`}>
      <CardContent className="pt-4 pb-4 space-y-4">
        {/* Header */}
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

        {/* 3 blocos cockpit */}
        <div className="grid md:grid-cols-3 gap-3">
          {/* Principal Vazamento */}
          <div className="rounded-lg border bg-background/60 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Principal vazamento
            </div>
            <p className="text-sm font-semibold leading-tight">{diag.topLabel}</p>
            <p className="text-xs text-muted-foreground">
              {diag.topCount} {diag.topCount === 1 ? 'deal' : 'deals'}
            </p>
            <p className="text-base font-bold text-red-600">{fmtBRL(diag.topLostValue)} <span className="text-[11px] font-normal text-muted-foreground">perdidos</span></p>
          </div>

          {/* Ação Recomendada */}
          <div className="rounded-lg border bg-background/60 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Ação recomendada
            </div>
            <p className="text-sm leading-snug">{diag.shortRecommendation}</p>
          </div>

          {/* Impacto Estimado */}
          <div className="rounded-lg border bg-background/60 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Impacto estimado
            </div>
            {impact.available && impact.winRatePotentialPp != null && impact.monthlyRevenuePotential != null ? (
              <>
                <p className="text-base font-bold text-emerald-600 leading-tight">
                  +{impact.winRatePotentialPp}pp <span className="text-[11px] font-normal text-muted-foreground">Win Rate potencial</span>
                </p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  +{fmtBRL(impact.monthlyRevenuePotential)}<span className="text-[11px] font-normal text-muted-foreground">/mês estimados</span>
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground leading-snug">
                Impacto estimado indisponível por falta de histórico confiável.
              </p>
            )}
          </div>
        </div>

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

        {/* Footer: severidade + ciclo + valor perdido + motivo */}
        <div className="grid sm:grid-cols-3 gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-2 text-xs pt-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-muted-foreground">Top motivo:</span>
            <span className="font-semibold truncate">{diag.topLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-xs pt-2">
            <DollarSign className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-muted-foreground">Valor perdido:</span>
            <span className="font-semibold">{fmtBRL(diag.topLostValue)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs pt-2">
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
