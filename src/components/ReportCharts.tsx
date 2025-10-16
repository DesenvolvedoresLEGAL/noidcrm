import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ReportChartsProps {
  data: {
    won: { origem: string; count: number; value: number }[];
    lost: { origem: string; count: number; value: number }[];
  };
  totals: {
    won: { count: number; value: number; mrr: number; rate: number };
    lost: { count: number; value: number; mrr: number; rate: number };
  };
}

export function ReportCharts({ data, totals }: ReportChartsProps) {
  const colors = {
    won: 'hsl(var(--primary))',
    lost: 'hsl(var(--destructive))',
  };

  return (
    <div className="space-y-6">
      {/* Oportunidades Ganhas */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Oportunidades processadas por origens - GANHAS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.won} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="origem" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [`${value} oportunidades`, 'Quantidade']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill={colors.won} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-4 gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">TOTAL</p>
              <p className="text-xl font-bold text-green-600">{totals.won.count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TAXA</p>
              <p className="text-xl font-bold text-green-600">{totals.won.rate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P&S</p>
              <p className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(totals.won.value)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(totals.won.mrr)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Oportunidades Perdidas */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Oportunidades processadas por origens - PERDIDAS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.lost} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="origem" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [`${value} oportunidades`, 'Quantidade']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill={colors.lost} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-4 gap-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">TOTAL</p>
              <p className="text-xl font-bold text-destructive">{totals.lost.count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">TAXA</p>
              <p className="text-xl font-bold text-destructive">{totals.lost.rate.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P&S</p>
              <p className="text-xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(totals.lost.value)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(totals.lost.mrr)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
