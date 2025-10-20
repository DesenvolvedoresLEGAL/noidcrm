import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Contract } from '@/services/crm/types';

interface ContractChartsProps {
  contracts: Contract[];
}

export function ContractCharts({ contracts }: ContractChartsProps) {
  // Distribuição por Status
  const statusData = [
    { name: 'Ativos', value: contracts.filter(c => c.status === 'active').length, color: 'hsl(var(--primary))' },
    { name: 'Pendentes', value: contracts.filter(c => c.status === 'pending').length, color: 'hsl(var(--chart-2))' },
    { name: 'Expirando', value: contracts.filter(c => c.status === 'expiring').length, color: 'hsl(var(--chart-3))' },
    { name: 'Expirados', value: contracts.filter(c => c.status === 'expired').length, color: 'hsl(var(--muted))' },
    { name: 'Cancelados', value: contracts.filter(c => c.status === 'cancelled').length, color: 'hsl(var(--destructive))' },
  ].filter(item => item.value > 0);

  // Receita por Tipo de Contrato
  const revenueByType = [
    {
      name: 'Mensal',
      receita: contracts.filter(c => c.type === 'monthly' && c.status === 'active').reduce((sum, c) => sum + c.value, 0),
    },
    {
      name: 'Trimestral',
      receita: contracts.filter(c => c.type === 'quarterly' && c.status === 'active').reduce((sum, c) => sum + c.value, 0),
    },
    {
      name: 'Anual',
      receita: contracts.filter(c => c.type === 'annual' && c.status === 'active').reduce((sum, c) => sum + c.value, 0),
    },
    {
      name: 'Único',
      receita: contracts.filter(c => c.type === 'one-time' && c.status === 'active').reduce((sum, c) => sum + c.value, 0),
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Distribuição por Status */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          <CardDescription>Visão geral dos contratos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="hsl(var(--primary))"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Receita por Tipo */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Receita por Tipo de Contrato</CardTitle>
          <CardDescription>Contratos ativos</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
