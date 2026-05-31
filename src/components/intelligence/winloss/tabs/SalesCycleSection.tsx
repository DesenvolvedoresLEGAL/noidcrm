import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Clock, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WinLossDataResult } from '@/hooks/useWinLossData';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
}

export function SalesCycleSection({ data, isLoading }: Props) {
  if (isLoading || !data) return null;

  const { avgCycleWon, avgCycleLost, validWinCyclesCount, validLossCyclesCount, timeToLossDistribution } = data;
  const hasTimeToLoss = timeToLossDistribution.some(b => b.count > 0);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-violet-500" />
        Ciclo de Venda
      </h2>
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cycle comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ciclo Médio: Won vs Lost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-500">{avgCycleWon ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground">dias (ganhos)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{validWinCyclesCount} deals</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-4 w-4 text-red-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-500">{avgCycleLost ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground">dias (perdidos)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{validLossCyclesCount} deals</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-violet-500/10">
                <Clock className="h-4 w-4 text-violet-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-violet-500">
                  {avgCycleWon != null && avgCycleLost != null
                    ? `${avgCycleLost - avgCycleWon > 0 ? '+' : ''}${avgCycleLost - avgCycleWon}`
                    : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">diferença</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">lost − won</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time-to-Loss Histogram */}
        {hasTimeToLoss && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-red-500" />
                Time-to-Loss
              </CardTitle>
              <CardDescription className="text-xs">Em qual semana os deals morrem?</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={timeToLossDistribution.filter(b => b.count > 0)} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number) => [`${value} deals`, 'Perdidos']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
