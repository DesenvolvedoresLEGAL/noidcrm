import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Swords, Shuffle, TrendingUp } from 'lucide-react';
import { buildMonthSignals } from '@/lib/winloss/diagnosis';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  dateRange: { from: Date; to: Date };
}

const ICON_MAP = {
  competition: Swords,
  shift: Shuffle,
  rise: TrendingUp,
} as const;

export function MonthSignalsCard({ data, dateRange }: Props) {
  if (!data) return null;
  const signals = buildMonthSignals(data, dateRange);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Sinais do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem sinais relevantes detectados neste período.</p>
        ) : (
          <ul className="space-y-2">
            {signals.map((s, i) => {
              const Icon = ICON_MAP[s.icon];
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icon className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
                  <span>{s.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
