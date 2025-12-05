import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FailureHistoryChartProps {
  data: { date: string; count: number }[];
}

export function FailureHistoryChart({ data }: FailureHistoryChartProps) {
  const chartData = data.map(d => ({
    ...d,
    label: format(parseISO(d.date), 'EEE', { locale: ptBR })
  }));

  const totalFailures = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Histórico de Falhas (7 dias)</CardTitle>
        <span className={`text-sm font-medium ${totalFailures > 0 ? 'text-destructive' : 'text-green-500'}`}>
          {totalFailures} falhas
        </span>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip 
              formatter={(value: number) => [value, 'Falhas']}
              labelFormatter={(label) => `Dia: ${label}`}
            />
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="hsl(var(--destructive))" 
              fill="hsl(var(--destructive) / 0.2)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
