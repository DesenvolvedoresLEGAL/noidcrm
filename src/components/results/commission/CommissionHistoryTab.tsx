import { Card, CardContent } from '@/components/ui/card';
import { useOTEMonthlyResults } from '@/hooks/useOTEData';
import { History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CommissionHistoryTab() {
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
      acc[k] ||= {
        period: k,
        commissionable: 0,
        generated: 0,
        paid: 0,
        pending: 0,
        sellers: new Set<string>(),
        statuses: new Set<string>(),
      };
      const amt = Number(r.final_variable_amount || 0);
      acc[k].commissionable += Number(r.total_sales || 0);
      acc[k].generated += amt;
      if (r.status === 'paid') acc[k].paid += amt;
      else acc[k].pending += amt;
      acc[k].sellers.add(r.user_id);
      acc[k].statuses.add(r.status);
      return acc;
    }, {} as Record<string, any>);

  const rows = Object.values(grouped)
    .map((r: any) => ({
      ...r,
      periodLabel: format(parseISO(r.period + '-01'), 'MMM/yy', { locale: ptBR }),
      sellersCount: r.sellers.size,
      status: Array.from(r.statuses).join(', '),
    }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 12);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhum histórico de comissão disponível.</p>
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
              <th className="text-right py-3 px-2">Receita comissionável</th>
              <th className="text-right py-3 px-2">Comissão gerada</th>
              <th className="text-right py-3 px-2">Comissão paga</th>
              <th className="text-right py-3 px-2">Comissão pendente</th>
              <th className="text-right py-3 px-2">Vendedores</th>
              <th className="text-left py-3 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.period} className="border-b hover:bg-muted/50">
                <td className="py-3 px-2 font-medium">{r.periodLabel}</td>
                <td className="py-3 px-2 text-right">{fmtBRL(r.commissionable)}</td>
                <td className="py-3 px-2 text-right">{fmtBRL(r.generated)}</td>
                <td className="py-3 px-2 text-right text-emerald-600">{fmtBRL(r.paid)}</td>
                <td className="py-3 px-2 text-right text-amber-600">{fmtBRL(r.pending)}</td>
                <td className="py-3 px-2 text-right">{r.sellersCount}</td>
                <td className="py-3 px-2 text-xs text-muted-foreground">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
