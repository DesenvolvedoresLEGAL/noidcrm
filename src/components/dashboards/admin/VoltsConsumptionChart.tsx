import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface VoltsConsumptionChartProps {
  data: { operation: string; count: number }[];
  total: number;
}

const OPERATION_LABELS: Record<string, string> = {
  'score_deal': 'Score de Deal',
  'next_action': 'Próxima Ação',
  'coaching': 'Coaching',
  'briefing': 'Briefing',
  'email_assist': 'Assistente E-mail',
  'proposal_ai': 'IA Proposta',
  'roleplay': 'Roleplay',
  'insights': 'Insights'
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(43, 96%, 56%)'
];

export function VoltsConsumptionChart({ data, total }: VoltsConsumptionChartProps) {
  const chartData = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(d => ({
      ...d,
      name: OPERATION_LABELS[d.operation] || d.operation,
      percentage: total > 0 ? Math.round((d.count / total) * 100) : 0
    }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Consumo VOLTS por Operação</CardTitle>
        <span className="text-sm font-medium text-muted-foreground">{total} total</span>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhum consumo registrado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [`${value} (${chartData.find(d => d.name === name)?.percentage}%)`, name]}
              />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
