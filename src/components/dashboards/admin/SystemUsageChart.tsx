import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface SystemUsageChartProps {
  data: { role: string; count: number }[];
  totalUsers: number;
}

const ROLE_LABELS: Record<string, string> = {
  'owner': 'Owner',
  'admin': 'Admin',
  'manager': 'Gerente',
  'sales': 'Vendedor'
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))'
];

export function SystemUsageChart({ data, totalUsers }: SystemUsageChartProps) {
  const chartData = data.map(d => ({
    ...d,
    name: ROLE_LABELS[d.role] || d.role,
    percentage: totalUsers > 0 ? Math.round((d.count / totalUsers) * 100) : 0
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Usuários por Categoria</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">{totalUsers} usuários</span>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum usuário
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [`${value} usuários`, name]}
              />
              <Legend 
                layout="horizontal" 
                align="center" 
                verticalAlign="bottom"
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
