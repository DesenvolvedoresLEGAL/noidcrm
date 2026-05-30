import { Card, CardContent } from '@/components/ui/card';
import { useOTEMonthlyResults } from '@/hooks/useOTEData';
import { History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function SimpleGoalsHistoryTab() {
  const { data: allResults, isLoading } = useOTEMonthlyResults();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const grouped = (allResults || [])
    .filter((r) => !r.is_team_target)
    .reduce((acc, r) => {
      const k = r.period_month;
      acc[k] ||= { period: k, goal: 0, realized: 0, sellers: new Set<string>() };
      acc[k].goal += Number(r.goal_amount || 0);
      acc[k].realized += Number(r.total_sales || 0);
      acc[k].sellers.add(r.user_id);
      return acc;
    }, {} as Record<string, any>);

  const rows = Object.values(grouped)
    .map((r: any) => ({
      ...r,
      sellersCount: r.sellers.size,
      pct: r.goal > 0 ? (r.realized / r.goal) * 100 : 0,
      periodLabel: format(parseISO(r.period + '-01'), 'MMM/yy', { locale: ptBR }),
    }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 12);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhum histórico de metas disponível.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-2">Período</th>
              <th className="text-right py-3 px-2">Meta total</th>
              <th className="text-right py-3 px-2">Receita realizada</th>
              <th className="text-right py-3 px-2">% Atingimento</th>
              <th className="text-right py-3 px-2">Vendedores</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.period} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2 font-medium">{r.periodLabel}</td>
                <td className="py-3 px-2 text-right">{fmtBRL(r.goal)}</td>
                <td className="py-3 px-2 text-right font-semibold">{fmtBRL(r.realized)}</td>
                <td className="py-3 px-2 text-right">{r.pct.toFixed(1)}%</td>
                <td className="py-3 px-2 text-right">{r.sellersCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
