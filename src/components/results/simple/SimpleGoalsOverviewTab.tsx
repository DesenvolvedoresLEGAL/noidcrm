import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { useSimpleGoalsResults } from '@/hooks/useResultsByMode';
import { Target, TrendingUp, TrendingDown, DollarSign, BarChart3, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
  isLoading: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusColor: Record<string, string> = {
  'Meta batida': 'bg-emerald-100 text-emerald-800',
  'Em ritmo': 'bg-amber-100 text-amber-800',
  'Abaixo do ritmo': 'bg-red-100 text-red-800',
  'Sem meta configurada': 'bg-muted text-muted-foreground',
};

export function SimpleGoalsOverviewTab({ results, records, isLoading }: Props) {
  const summary = useSimpleGoalsResults(results, records);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Nenhum vendedor com meta neste período</h3>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { label: 'Receita realizada', value: fmtBRL(summary.totalRealized), icon: DollarSign, accent: true },
    { label: 'Meta do período', value: fmtBRL(summary.totalGoal), icon: Target },
    { label: 'Atingimento', value: `${summary.achievementPct.toFixed(1)}%`, icon: BarChart3 },
    { label: 'Vendedores acima da meta', value: String(summary.sellersAbove), icon: TrendingUp },
    { label: 'Vendedores abaixo da meta', value: String(summary.sellersBelow), icon: TrendingDown },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.accent ? 'text-primary' : ''}`}>{c.value}</p>
                </div>
                <c.icon className="h-8 w-8 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Atingimento por vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Vendedor</th>
                  <th className="text-right py-3 px-2">Meta</th>
                  <th className="text-right py-3 px-2">Receita realizada</th>
                  <th className="text-right py-3 px-2">% Meta</th>
                  <th className="text-right py-3 px-2">Gap para meta</th>
                  <th className="text-center py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.result.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{row.result.profile?.full_name || '-'}</td>
                    <td className="py-3 px-2 text-right">{fmtBRL(row.goal)}</td>
                    <td className="py-3 px-2 text-right font-semibold">{fmtBRL(row.realized)}</td>
                    <td className="py-3 px-2 text-right">{row.achievementPct.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{fmtBRL(row.gap)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={cn('px-2 py-0.5 rounded text-xs', statusColor[row.statusLabel])}>
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
