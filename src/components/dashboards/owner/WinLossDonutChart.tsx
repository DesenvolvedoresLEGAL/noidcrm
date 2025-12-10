import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Target } from "lucide-react";

interface WinLossDonutChartProps {
  wonCount: number;
  lostCount: number;
  openCount: number;
}

const COLORS = {
  won: 'hsl(142, 76%, 36%)',
  lost: 'hsl(0, 84%, 60%)',
  open: 'hsl(var(--muted-foreground))',
};

export function WinLossDonutChart({ wonCount, lostCount, openCount }: WinLossDonutChartProps) {
  const data = [
    { name: 'Ganhos', value: wonCount, color: COLORS.won },
    { name: 'Perdidos', value: lostCount, color: COLORS.lost },
    { name: 'Em Aberto', value: openCount, color: COLORS.open },
  ].filter(item => item.value > 0);

  const total = wonCount + lostCount + openCount;
  const winRate = total > 0 ? ((wonCount / (wonCount + lostCount || 1)) * 100).toFixed(0) : 0;

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Taxa de Conversão
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Win Rate: <span className="font-semibold text-green-600">{winRate}%</span>
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhum negócio fechado ainda
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [value, name]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        
        {/* Summary stats below chart */}
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div className="p-2 rounded-lg bg-green-500/10">
            <p className="text-lg font-bold text-green-600">{wonCount}</p>
            <p className="text-xs text-muted-foreground">Ganhos</p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10">
            <p className="text-lg font-bold text-red-600">{lostCount}</p>
            <p className="text-xs text-muted-foreground">Perdidos</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-muted-foreground">{openCount}</p>
            <p className="text-xs text-muted-foreground">Abertos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
