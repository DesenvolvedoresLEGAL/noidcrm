import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';

interface GeneralOverviewProps {
  data: any;
}

export function GeneralOverview({ data }: GeneralOverviewProps) {
  const weeklyData = [
    { week: 'Semana 2025-40', novas: 18, ganhas: 5, perdidas: 6, congeladas: 4 },
    { week: 'Semana 2025-41', novas: 24, ganhas: 7, perdidas: 8, congeladas: 5 },
    { week: 'Semana 2025-42', novas: 32, ganhas: 9, perdidas: 7, congeladas: 3 },
    { week: 'Semana 2025-43', novas: 15, ganhas: 2, perdidas: 1, congeladas: 2 },
  ];

  const salesDistribution = [
    { name: 'Jéssica Machado', value: 36.25, count: 5 },
    { name: 'Leonardo Honório', value: 23.09, count: 3 },
    { name: 'Jaqueline Mota', value: 19.58, count: 2 },
    { name: 'Ionara Nobre', value: 11.08, count: 1 },
  ];

  const mrrDistribution = [
    { name: 'Leonardo Honório', value: 33.09 },
    { name: 'Jéssica Machado', value: 23.09 },
    { name: 'Jaqueline Mota', value: 19.58 },
    { name: 'Ionara Nobre', value: 11.08 },
  ];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Novas oportunidades</p>
                <p className="text-3xl font-bold mt-2">80</p>
                <p className="text-sm text-muted-foreground mt-1">P&S: R$ 213.170,49</p>
                <p className="text-sm text-muted-foreground">MRR: R$ 27.000,00</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-950 rounded-lg">
                <Target className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-red-600 flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                -60%
              </span>
              <span className="text-muted-foreground">Lead time: 6.1 dias</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Oportunidades ganhas</p>
                <p className="text-3xl font-bold mt-2 text-green-600">17</p>
                <p className="text-sm text-muted-foreground mt-1">P&S: R$ 27.170,50</p>
                <p className="text-sm text-muted-foreground">MRR: R$ 0,00</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-950 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-green-600">23.61%</span>
              <span className="text-muted-foreground">Taxa • 8.95%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Oportunidades perdidas</p>
                <p className="text-3xl font-bold mt-2 text-red-600">55</p>
                <p className="text-sm text-muted-foreground mt-1">P&S: R$ 276.374,39</p>
                <p className="text-sm text-muted-foreground">MRR: R$ 0,00</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-950 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-red-600">76.39%</span>
              <span className="text-muted-foreground">Taxa • 91.05%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em aberto no momento</p>
                <p className="text-3xl font-bold mt-2">35</p>
                <p className="text-sm text-muted-foreground mt-1">P&S: R$ 107.219,00</p>
                <p className="text-sm text-muted-foreground">MRR: R$ 27.000,00</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Lead time médio: 14.3 dias
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de tendência semanal */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Semanal de Oportunidades</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="novas" stroke="#f59e0b" name="Novas" strokeWidth={2} />
              <Line type="monotone" dataKey="ganhas" stroke="#10b981" name="Ganhas" strokeWidth={2} />
              <Line type="monotone" dataKey="perdidas" stroke="#ef4444" name="Perdidas" strokeWidth={2} />
              <Line type="monotone" dataKey="congeladas" stroke="#6b7280" name="Congeladas" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuição de vendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendas P&S</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={salesDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.value.toFixed(2)}%`}
                >
                  {salesDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(2)}% (${props.payload.count} vendas)`,
                    props.payload.name
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {salesDistribution.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-medium">{entry.count} vendas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">Não há dados disponíveis neste período.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
