import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLostReasonsData } from '@/hooks/useReportsData';
import { useReportFiltersContext } from '@/contexts/ReportFiltersContext';
import { formatDateBR } from '@/lib/dateUtils';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { EmptyState } from '@/components/EmptyState';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--destructive))',
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function LostReasons() {
  const { data: reasons, isLoading, error } = useLostReasonsData();
  const { effectiveDates } = useReportFiltersContext();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar dados"
        description="Não foi possível carregar os motivos de perda."
      />
    );
  }

  if (!reasons || reasons.length === 0) {
    return (
      <EmptyState
        icon={TrendingDown}
        title="Nenhum motivo de perda registrado"
        description="Análises de motivos de perda aparecerão aqui quando você registrar oportunidades perdidas."
      />
    );
  }

  const totalLost = reasons.reduce((acc, r) => acc + r.count, 0);
  const totalValue = reasons.reduce((acc, r) => acc + r.value, 0);

  // Top 10 reasons for charts
  const topReasons = reasons.slice(0, 10);

  const barChartData = topReasons.map(r => ({
    name: r.name.length > 25 ? r.name.substring(0, 25) + '...' : r.name,
    fullName: r.name,
    quantidade: r.count,
    valor: r.value,
  }));

  const pieChartData = topReasons.map((r, i) => ({
    name: r.name.length > 20 ? r.name.substring(0, 20) + '...' : r.name,
    fullName: r.name,
    value: r.count,
    percentage: ((r.count / totalLost) * 100).toFixed(1),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Indicador de período */}
      <Badge variant="outline" className="text-xs">
        Período: {formatDateBR(effectiveDates.startDate)} a {formatDateBR(effectiveDates.endDate)}
      </Badge>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Perdidas</p>
                <p className="text-lg font-bold text-foreground">{totalLost}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Valor Perdido</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(totalValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Motivos Únicos</p>
              <p className="text-lg font-bold text-foreground">{reasons.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div>
              <p className="text-xs text-muted-foreground">Principal Motivo</p>
              <p className="text-sm font-medium text-foreground truncate" title={reasons[0]?.name}>
                {reasons[0]?.name || '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Motivos de Perda (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 10 }} 
                    className="fill-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'quantidade' ? value : formatCurrency(value),
                      name === 'quantidade' ? 'Quantidade' : 'Valor'
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="quantidade" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribuição por Motivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} (${props.payload.percentage}%)`,
                      props.payload.fullName
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {pieChartData.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Todos os Motivos de Perda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Motivo</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Quantidade</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor Perdido</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-3 font-medium">{r.name}</td>
                    <td className="text-right py-2 px-3">{r.count}</td>
                    <td className="text-right py-2 px-3 text-muted-foreground">
                      {((r.count / totalLost) * 100).toFixed(1)}%
                    </td>
                    <td className="text-right py-2 px-3 text-destructive">{formatCurrency(r.value)}</td>
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
