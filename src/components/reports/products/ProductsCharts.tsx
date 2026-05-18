import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import type { ProductSoldRow, ProductMonthlyRow } from '@/hooks/useProductsReport';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);
}
function shortName(n: string, max = 26) {
  if (!n) return '';
  return n.length > max ? n.slice(0, max - 1) + '…' : n;
}

export function ProductsCharts({ data, monthly }: { data: ProductSoldRow[]; monthly: ProductMonthlyRow[] }) {
  const topRevenue = useMemo(
    () => data.slice().sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10)
      .map(r => ({ name: shortName(r.name), value: Number(r.total_revenue) })),
    [data],
  );
  const topSales = useMemo(
    () => data.slice().sort((a, b) => b.sales_count - a.sales_count).slice(0, 10)
      .map(r => ({ name: shortName(r.name), value: Number(r.sales_count) })),
    [data],
  );
  const billingMix = useMemo(() => {
    const acc: Record<string, number> = {};
    data.forEach(r => { acc[r.billing_type] = (acc[r.billing_type] || 0) + Number(r.total_revenue); });
    return Object.entries(acc).map(([k, v]) => ({
      name: k === 'recurring' ? 'Recorrente' : k === 'one_time' ? 'Pontual' : k,
      value: v,
    }));
  }, [data]);

  const monthlySeries = useMemo(() => {
    const months = Array.from(new Set(monthly.map(m => m.month))).sort();
    const products = Array.from(new Set(monthly.map(m => m.product_key)));
    const nameByKey = new Map(monthly.map(m => [m.product_key, m.name]));
    return {
      data: months.map(month => {
        const row: any = { month: new Date(month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) };
        products.forEach(k => {
          const found = monthly.find(m => m.month === month && m.product_key === k);
          row[k] = found ? Number(found.total_revenue) : 0;
        });
        return row;
      }),
      products: products.map(k => ({ key: k, name: shortName(nameByKey.get(k) || k, 20) })),
    };
  }, [monthly]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 por Receita</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topRevenue} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={(v) => fmtBRL(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="name" type="category" width={170} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 por Vendas</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topSales} layout="vertical" margin={{ left: 20, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis dataKey="name" type="category" width={170} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Mix por tipo de cobrança</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={billingMix} dataKey="value" nameKey="name" outerRadius={100} innerRadius={55} paddingAngle={2}>
                {billingMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução mensal — Top 5</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlySeries.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis tickFormatter={(v) => fmtBRL(v)} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              {monthlySeries.products.map((p, i) => (
                <Line key={p.key} type="monotone" dataKey={p.key} name={p.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
