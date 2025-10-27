import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OpportunitiesByStageProps {
  data: Array<{
    stage: string;
    [key: string]: string | number;
  }>;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function OpportunitiesByStage({ data }: OpportunitiesByStageProps) {
  // Get all product keys (excluding 'stage')
  const productKeys = data.length > 0 
    ? Object.keys(data[0]).filter(key => key !== 'stage')
    : [];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Oportunidades por Estágio</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(value),
                '',
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {productKeys.map((product, index) => (
              <Bar 
                key={product} 
                dataKey={product} 
                fill={COLORS[index % COLORS.length]} 
                radius={[8, 8, 0, 0]} 
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
