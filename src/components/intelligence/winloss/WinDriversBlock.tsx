import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, MessageSquareQuote } from 'lucide-react';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
}

export function WinDriversBlock({ data }: Props) {
  const aggregates = useMemo(() => {
    if (!data || data.wins.length === 0) return null;
    const reasonMap = new Map<string, { count: number; value: number }>();
    const diffMap = new Map<string, number>();
    const quotes: Array<{ feedback: string; reason?: string; value: number }> = [];

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

      if (w.customer_feedback && w.customer_feedback.trim().length > 0) {
        quotes.push({
          feedback: w.customer_feedback.trim(),
          reason: w.win_reason_name,
          value: Number(w.final_value) || 0,
        });
      }
    }

    return {
      reasons: [...reasonMap.entries()]
        .map(([reason, { count, value }]) => ({ reason, count, value }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      differentiators: [...diffMap.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      quotes: quotes.slice(0, 3),
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-emerald-600" />
          Drivers de Vitória
        </CardTitle>
        <CardDescription>Por que estamos ganhando — motivos, diferenciais e voz do cliente</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Top motivos de vitória
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Diferenciais decisivos
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

        {aggregates.quotes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Voz do cliente (vitórias)
            </p>
            <div className="space-y-2">
              {aggregates.quotes.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-xs italic text-muted-foreground">
                  <MessageSquareQuote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                  <p className="leading-snug">
                    "{q.feedback.length > 200 ? q.feedback.slice(0, 200) + '…' : q.feedback}"
                    {q.reason && <span className="not-italic"> — <span className="font-medium">{q.reason}</span></span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
