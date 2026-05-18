import { Card, CardContent } from '@/components/ui/card';
import { Package, DollarSign, Hash, Receipt } from 'lucide-react';
import type { ProductSoldRow } from '@/hooks/useProductsReport';

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}
function fmtInt(v: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));
}

export function ProductsKpiCards({ data }: { data: ProductSoldRow[] }) {
  const totalRevenue = data.reduce((s, r) => s + Number(r.total_revenue || 0), 0);
  const totalSales = data.reduce((s, r) => s + Number(r.sales_count || 0), 0);
  const totalQty = data.reduce((s, r) => s + Number(r.total_quantity || 0), 0);
  const distinct = data.length;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const cards = [
    { icon: DollarSign, label: 'Receita de Produtos', value: fmtBRL(totalRevenue), tint: 'text-emerald-500' },
    { icon: Package, label: 'Produtos distintos', value: fmtInt(distinct), tint: 'text-indigo-500' },
    { icon: Hash, label: 'Unidades vendidas', value: fmtInt(totalQty), tint: 'text-sky-500' },
    { icon: Receipt, label: 'Ticket médio / item', value: fmtBRL(avgTicket), tint: 'text-amber-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${c.tint}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground truncate">{c.label}</div>
              <div className="text-lg font-bold tracking-tight">{c.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
