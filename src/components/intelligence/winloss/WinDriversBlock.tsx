import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
}

// Bloco compacto: Top 3 motivos de vitória + Top 3 diferenciais decisivos + receita associada.
export function WinDriversBlock({ data }: Props) {
  const aggregates = useMemo(() => {
    if (!data || data.wins.length === 0) return null;
    const reasonMap = new Map<string, { count: number; value: number }>();
    const diffMap = new Map<string, number>();

    for (const w of data.wins) {
      const reason = w.win_reason_name || 'Não informado';
      const r = reasonMap.get(reason) || { count: 0, value: 0 };
      r.count++;
      r.value += Number(w.final_value) || 0;
      reasonMap.set(reason, r);

      if (w.key_differentiator) {
        w.key_differentiator
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
          .forEach((d) => diffMap.set(d, (diffMap.get(d) || 0) + 1));
      }
    }

    return {
      reasons: [...reasonMap.entries()]
        .map(([reason, { count, value }]) => ({ reason, count, value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      differentiators: [...diffMap.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    };
  }, [data]);

  if (!aggregates || aggregates.reasons.length === 0) return null;

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <Card className="border-emerald-500/20 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-emerald-600" />
          Drivers de Vitória
        </CardTitle>
        <CardDescription className="text-xs">O que está gerando ganho</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Top 3 motivos
          </p>
          <div className="space-y-1.5">
            {aggregates.reasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between text-sm">
                <span className="truncate">{r.reason}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{r.count}</Badge>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {fmtBRL(r.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {aggregates.differentiators.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Top 3 diferenciais decisivos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {aggregates.differentiators.map((d) => (
                <Badge
                  key={d.label}
                  variant="outline"
                  className="bg-emerald-100/50 dark:bg-emerald-900/30 border-emerald-300/50 text-emerald-800 dark:text-emerald-200"
                >
                  {d.label} · {d.count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

