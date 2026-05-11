import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MonthlyPulse } from '@/hooks/useWinLossData';

interface MonthlyPulseCardsProps {
  data: MonthlyPulse[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export function MonthlyPulseCards({ data }: MonthlyPulseCardsProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Pulso Mensal
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {data.map((pulse) => {
          const diff = pulse.prevWinRate !== null ? pulse.winRate - pulse.prevWinRate : null;
          return (
            <Card key={pulse.month} className="min-w-[140px] shrink-0">
              <CardContent className="pt-3 pb-3 px-3 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">{pulse.monthLabel}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold">{pulse.winRate}%</span>
                  {diff !== null && diff !== 0 && (
                    <span className={`flex items-center text-xs font-medium ${diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {diff > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                      {diff > 0 ? '+' : ''}{diff}pp
                    </span>
                  )}
                  {diff === 0 && (
                    <span className="flex items-center text-xs text-muted-foreground">
                      <Minus className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span className="text-emerald-500">{pulse.wins}W</span>
                  <span className="text-red-500">{pulse.losses}L</span>
                </div>
                <p className="text-[10px] text-emerald-600 truncate">+ {formatCurrency(pulse.wonValue)}</p>
                {pulse.lostValue > 0 && (
                  <p className="text-[10px] text-red-500 truncate">− {formatCurrency(pulse.lostValue)}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
