import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChannelTrends } from '@/hooks/useSalesMetrics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, TrendingDown, Minus, PieChart as PieIcon } from 'lucide-react';

const COLORS = {
  outbound: 'hsl(221, 83%, 53%)',    // Blue
  inbound: 'hsl(142, 76%, 36%)',     // Green
  indicacao: 'hsl(45, 93%, 47%)',    // Amber
  outros: 'hsl(215, 16%, 47%)',      // Gray
};

const getColor = (channel: string) => COLORS[channel as keyof typeof COLORS] || COLORS.outros;

export function ChannelDistributionChart() {
  const { trends, isLoading } = useChannelTrends();

  if (isLoading) {
    return (
      <Card className="bg-background/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando gráfico...
        </CardContent>
      </Card>
    );
  }

  if (trends.length === 0) {
    return (
      <Card className="bg-background/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Sem dados de vendas para gerar gráfico
        </CardContent>
      </Card>
    );
  }

  // Prepare data for charts
  const barData = trends.map(t => ({
    name: t.label,
    channel: t.channel,
    'Histórico (3-6m)': Number(t.historical.toFixed(1)),
    'Atual (0-3m)': Number(t.projection.toFixed(1)),
  }));

  const pieDataHistorical = trends.filter(t => t.historical > 0).map(t => ({
    name: t.label,
    value: Number(t.historical.toFixed(1)),
    channel: t.channel,
  }));

  const pieDataCurrent = trends.filter(t => t.projection > 0).map(t => ({
    name: t.label,
    value: Number(t.projection.toFixed(1)),
    channel: t.channel,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-muted-foreground">
              {entry.name}: <span className="font-medium">{entry.value}%</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-background/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Distribuição por Canal - Histórico vs Atual</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Comparação entre período histórico (3-6 meses atrás) e atual (últimos 3 meses)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bar Chart Comparison */}
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Histórico (3-6m)" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[0, 4, 4, 0]} />
              <Bar dataKey="Atual (0-3m)" radius={[0, 4, 4, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.channel)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Charts Side by Side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-center text-muted-foreground mb-2">Histórico (3-6m)</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDataHistorical}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    label={({ name, value }) => `${value}%`}
                    labelLine={false}
                  >
                    {pieDataHistorical.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColor(entry.channel)} opacity={0.6} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs text-center text-muted-foreground mb-2">Atual (0-3m)</p>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDataCurrent}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    label={({ name, value }) => `${value}%`}
                    labelLine={false}
                  >
                    {pieDataCurrent.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColor(entry.channel)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Trend Indicators */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          {trends.map((t) => (
            <div key={t.channel} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: getColor(t.channel) }}
              />
              <span className="font-medium">{t.label}</span>
              <div className={`flex items-center gap-0.5 ${
                t.trend === 'up' ? 'text-emerald-600' : 
                t.trend === 'down' ? 'text-red-500' : 
                'text-muted-foreground'
              }`}>
                {t.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                {t.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                {t.trend === 'stable' && <Minus className="h-3 w-3" />}
                <span>{(t.projection - t.historical).toFixed(1)}pp</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
