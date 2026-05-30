import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OTEMonthlyResult } from '@/hooks/useOTEData';
import type { OTESalesRecord } from '@/hooks/useOTESalesRecords';
import { useCommissionResults } from '@/hooks/useResultsByMode';
import { DollarSign, Wallet, AlertTriangle, ShoppingBag, Ban, Users } from 'lucide-react';

interface Props {
  results: OTEMonthlyResult[];
  records: OTESalesRecord[];
  isLoading: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CommissionOverviewTab({ results, records, isLoading }: Props) {
  const summary = useCommissionResults(results, records);

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
          <h3 className="text-lg font-semibold">Nenhuma comissão calculada</h3>
          <p className="text-muted-foreground mt-2">
            Clique em "Calcular" para gerar o relatório de comissão do período.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cards = [
    { label: 'Comissão a pagar', value: fmtBRL(summary.totalCommissionToPay), icon: Wallet, accent: true },
    { label: 'Receita comissionável', value: fmtBRL(summary.totalCommissionable), icon: DollarSign },
    { label: 'Receita não comissionável', value: fmtBRL(summary.totalNonCommissionable), icon: Ban },
    { label: 'Vendas com comissão', value: String(summary.salesWithCommission), icon: ShoppingBag },
    { label: 'Vendedores com comissão', value: String(summary.sellersWithCommission), icon: Users },
  ];

  // Validação: comissão calculada não pode existir se receita comissionável = 0
  const violation = summary.rows.find(
    (r) => r.commissionGenerated > 0.01 && r.commissionableRevenue < 0.01,
  );

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

      {violation && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div>
              <strong>Comissão calculada para item não comissionável.</strong> Revise as regras de produto/serviço.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Comissões por vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Vendedor</th>
                  <th className="text-right py-3 px-2">Receita comissionável</th>
                  <th className="text-right py-3 px-2">Receita não comissionável</th>
                  <th className="text-right py-3 px-2">% Comissão média</th>
                  <th className="text-right py-3 px-2">Comissão gerada</th>
                  <th className="text-right py-3 px-2">Comissão paga</th>
                  <th className="text-right py-3 px-2">Comissão pendente</th>
                  <th className="text-center py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.result.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">
                      {row.result.profile?.full_name || '-'}
                    </td>
                    <td className="py-3 px-2 text-right">{fmtBRL(row.commissionableRevenue)}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">
                      {fmtBRL(row.nonCommissionableRevenue)}
                    </td>
                    <td className="py-3 px-2 text-right">{row.avgCommissionRate.toFixed(1)}%</td>
                    <td className="py-3 px-2 text-right font-semibold">
                      {fmtBRL(row.commissionGenerated)}
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-600">
                      {fmtBRL(row.commissionPaid)}
                    </td>
                    <td className="py-3 px-2 text-right text-amber-600">
                      {fmtBRL(row.commissionPending)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded text-xs bg-muted">{row.statusLabel}</span>
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
