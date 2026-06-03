// Sprint WL-UI-03 — Drivers de Vitória Executivos.
// Destaque: Principal Driver + Top 3 com qtd / receita / participação %.
// Diferenciais decisivos com nomenclatura executiva (não-técnica).
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Trophy, Sparkles } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
}

/** Mapa para nomenclatura executiva dos diferenciais (não-técnica). */
const DIFFERENTIATOR_LABELS: Record<string, string> = {
  price: 'Preço Competitivo',
  service: 'Atendimento',
  product: 'Qualidade da Solução',
  relationship: 'Relacionamento',
  timing: 'Timing',
  brand: 'Marca',
};

function executiveDifferentiatorLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return DIFFERENTIATOR_LABELS[key] || raw.trim();
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function WinDriversBlock({ data }: Props) {
  const aggregates = useMemo(() => {
    if (!data || data.wins.length === 0) return null;
    const reasonMap = new Map<string, { count: number; value: number }>();
    const diffMap = new Map<string, number>();
    let totalRevenue = 0;
    let totalWins = 0;

    for (const w of data.wins) {
      const reason =
        w.win_reason_name ||
        (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
      const r = reasonMap.get(reason) || { count: 0, value: 0 };
      const value = Number(w.final_value) || 0;
      r.count++;
      r.value += value;
      totalRevenue += value;
      totalWins++;
      reasonMap.set(reason, r);

      if (w.key_differentiator) {
        w.key_differentiator
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
          .forEach((d) => {
            const label = executiveDifferentiatorLabel(d);
            diffMap.set(label, (diffMap.get(label) || 0) + 1);
          });
      }
    }

    const rankedReasons = [...reasonMap.entries()]
      .map(([reason, { count, value }]) => ({
        reason,
        count,
        value,
        pct: totalWins > 0 ? Math.round((count / totalWins) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || b.value - a.value);

    return {
      totalRevenue,
      totalWins,
      principal: rankedReasons[0] || null,
      topDrivers: rankedReasons.slice(0, 6),
      differentiators: [...diffMap.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  }, [data]);

  if (!aggregates || aggregates.topDrivers.length === 0) return null;

  const principal = aggregates.principal;

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-emerald-600" />
              O que mais gera vitória
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Principais fatores associados aos negócios ganhos.
            </CardDescription>
          </div>
          <span className="text-xs text-muted-foreground">
            Receita associada:{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {fmtBRL(aggregates.totalRevenue)}
            </span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Principal Driver de Vitória — destaque */}
        {principal && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium mb-2">
              <Crown className="h-3.5 w-3.5" />
              Principal driver de vitória
            </div>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-base font-bold leading-tight truncate">{principal.reason}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {principal.count} {principal.count === 1 ? 'ganho' : 'ganhos'} ·{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {fmtBRL(principal.value)}
                  </span>
                </p>
              </div>
              <Badge
                variant="outline"
                className="text-[11px] uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                {principal.pct}% das vitórias
              </Badge>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Top 3 drivers */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Top 6 drivers
            </p>
            <div className="space-y-2">
              {aggregates.topDrivers.map((r) => (
                <div
                  key={r.reason}
                  className="flex items-center justify-between gap-2 text-sm rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
                >
                  <span className="truncate min-w-0">{r.reason}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {r.count} {r.count === 1 ? 'ganho' : 'ganhos'}
                    </Badge>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {fmtBRL(r.value)}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
                      {r.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diferenciais decisivos (executive labels) */}
          {aggregates.differentiators.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                Diferenciais decisivos
              </p>
              <div className="space-y-1.5">
                {aggregates.differentiators.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between gap-2 text-sm rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5"
                  >
                    <span className="truncate text-emerald-900 dark:text-emerald-100">{d.label}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {d.count} {d.count === 1 ? 'citação' : 'citações'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
