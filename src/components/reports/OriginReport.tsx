import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useOriginReportData, OriginReportItem } from '@/hooks/useReportsData';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { formatDateBR } from '@/lib/dateUtils';
import { Compass, AlertTriangle, TrendingUp, Award, DollarSign, Hash } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { EmptyState } from '@/components/EmptyState';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
];

function fmt(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface KPIProps { icon: React.ElementType; label: string; value: string; sub?: string; color?: string }
function KPICard({ icon: Icon, label, value, sub, color = 'text-primary' }: KPIProps) {
  return (
    <Card>
      <CardContent className="pt-6 pb-4 flex items-start gap-4">
        <div className={`p-3 rounded-xl bg-primary/10 ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OriginReport() {
  const { data, isLoading, error } = useOriginReportData();
  const { effectiveDates } = useReportFiltersContext();

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-80" /><Skeleton className="h-64" /></div>;
  }

  if (error) {
    return <EmptyState icon={AlertTriangle} title="Erro ao carregar dados" description="Não foi possível carregar o relatório de origens." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState icon={Compass} title="Nenhuma origem registrada" description="Análises por origem aparecerão aqui quando houver oportunidades com origem definida." />;
  }

  const totalDeals = data.reduce((s, d) => s + d.total, 0);
  const topByCount = data[0];
  const topByConversion = [...data].filter(d => d.total >= 3).sort((a, b) => b.conversionRate - a.conversionRate)[0] || data[0];
  const topByValue = [...data].sort((a, b) => b.wonValue - a.wonValue)[0];

  // Pie data
  const pieData = data.slice(0, 8).map((d) => ({ name: d.origem, value: d.total }));

  // Stacked bar data (top 10)
  const stackedData = data.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Period badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {formatDateBR(effectiveDates.startDate)} — {formatDateBR(effectiveDates.endDate)}
        </Badge>
        <Badge variant="secondary" className="text-xs">{data.length} origens · {totalDeals} oportunidades</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Hash} label="Origens Ativas" value={String(data.length)} sub={`${totalDeals} oportunidades no total`} />
        <KPICard icon={TrendingUp} label="Mais Oportunidades" value={topByCount.origem} sub={`${topByCount.total} deals`} />
        <KPICard icon={Award} label="Maior Conversão" value={topByConversion.origem} sub={pct(topByConversion.conversionRate)} />
        <KPICard icon={DollarSign} label="Maior Valor Ganho" value={topByValue.origem} sub={fmt(topByValue.wonValue)} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizontal bar - total by origin */}
        <Card>
          <CardHeader><CardTitle className="text-base">Oportunidades por Origem</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 36)}>
              <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" />
                <YAxis dataKey="origem" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [v, 'Total']} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Origem</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stacked bar: won vs lost vs open */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ganhas vs Perdidas vs Abertas por Origem</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={stackedData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="origem" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="won" name="Ganhas" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="open" name="Abertas" stackId="a" fill="hsl(var(--chart-4))" />
              <Bar dataKey="lost" name="Perdidas" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo por Origem</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-3 px-2 font-medium">Origem</th>
                <th className="text-right py-3 px-2 font-medium">Total</th>
                <th className="text-right py-3 px-2 font-medium">Ganhas</th>
                <th className="text-right py-3 px-2 font-medium">Perdidas</th>
                <th className="text-right py-3 px-2 font-medium">Abertas</th>
                <th className="text-right py-3 px-2 font-medium">Valor Ganho</th>
                <th className="text-right py-3 px-2 font-medium">Conversão</th>
                <th className="text-right py-3 px-2 font-medium">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.origem} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="py-2.5 px-2 font-medium">{row.origem}</td>
                  <td className="py-2.5 px-2 text-right">{row.total}</td>
                  <td className="py-2.5 px-2 text-right text-chart-2">{row.won}</td>
                  <td className="py-2.5 px-2 text-right text-destructive">{row.lost}</td>
                  <td className="py-2.5 px-2 text-right">{row.open}</td>
                  <td className="py-2.5 px-2 text-right font-medium">{fmt(row.wonValue)}</td>
                  <td className="py-2.5 px-2 text-right">
                    <Badge variant={row.conversionRate >= 30 ? 'default' : 'secondary'} className="text-xs">
                      {pct(row.conversionRate)}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2 text-right">{fmt(row.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
