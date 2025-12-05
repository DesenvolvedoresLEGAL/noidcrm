import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface CRMHeatmapChartProps {
  data: { stage: string; avgDays: number; dropRate: number; value: number }[];
}

export function CRMHeatmapChart({ data }: CRMHeatmapChartProps) {
  const chartData = data.slice(0, 8).map(d => ({
    ...d,
    shortStage: d.stage.length > 12 ? d.stage.slice(0, 12) + '...' : d.stage
  }));

  const getDropColor = (dropRate: number) => {
    if (dropRate >= 30) return 'hsl(var(--destructive))';
    if (dropRate >= 15) return 'hsl(38, 92%, 50%)';
    return 'hsl(142, 76%, 36%)';
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Mapa de Calor do CRM (Gargalos)</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhum estágio configurado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number"
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                dataKey="shortStage" 
                type="category" 
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'avgDays') return [`${value} dias`, 'Tempo Médio'];
                  if (name === 'dropRate') return [`${value}%`, 'Taxa de Perda'];
                  return [value, name];
                }}
              />
              <Legend 
                formatter={(value) => value === 'avgDays' ? 'Dias no Estágio' : 'Taxa de Perda (%)'}
              />
              <Bar dataKey="avgDays" fill="hsl(var(--primary))" name="avgDays" radius={[0, 4, 4, 0]} />
              <Bar dataKey="dropRate" name="dropRate" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getDropColor(entry.dropRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="flex justify-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" /> &lt;15% perda
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500" /> 15-30% perda
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-destructive" /> &gt;30% perda
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
