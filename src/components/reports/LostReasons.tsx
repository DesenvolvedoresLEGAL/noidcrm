import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function LostReasons() {
  const reasonsData = [
    { reason: 'Decisão interna do cliente (não detalhada)', qtd: 14, pas: 68007, mrr: 0 },
    { reason: 'Preço acima do budget do cliente', qtd: 7, pas: 12360, mrr: 0 },
    { reason: 'Vai usar internet móvel do celular', qtd: 7, pas: 17963, mrr: 0 },
    { reason: 'Vai usar roteador próprio', qtd: 6, pas: 8100, mrr: 0 },
    { reason: 'Não respondeu às tentativas de contato (mínim...', qtd: 5, pas: 4857, mrr: 0 },
    { reason: 'Não possui orçamento para locação de internet', qtd: 4, pas: 5250, mrr: 0 },
    { reason: 'Falta de aprovação final do cliente', qtd: 3, pas: 2520, mrr: 0 },
    { reason: 'Contratou concorrente homologado', qtd: 2, pas: 4690, mrr: 0 },
    { reason: 'Cliente reprovado na análise de crédito', qtd: 1, pas: 2430, mrr: 0 },
    { reason: 'Evento/projeto cancelado pelo cliente', qtd: 1, pas: 1260, mrr: 0 },
    { reason: 'Cliente bloqueou nossos canais', qtd: 1, pas: 1755, mrr: 0 },
  ];

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(var(--secondary))',
    'hsl(var(--muted))',
    'hsl(var(--destructive))',
    'hsl(var(--warning))',
  ];

  const totalQtd = reasonsData.reduce((sum, item) => sum + item.qtd, 0);
  const totalPas = reasonsData.reduce((sum, item) => sum + item.pas, 0);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades perdidas por motivo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={reasonsData} layout="vertical" margin={{ left: 250, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" />
              <YAxis dataKey="reason" type="category" width={240} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [`${value} oportunidades`, 'Quantidade']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                {reasonsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">TOTAL</p>
              <p className="text-2xl font-bold">{totalQtd} oportunidades</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">P&S</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPas)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MRR</p>
              <p className="text-2xl font-bold">{formatCurrency(0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades perdidas por motivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MOTIVOS DE PERDA</TableHead>
                  <TableHead className="text-right">QTD.</TableHead>
                  <TableHead className="text-right">TAXA</TableHead>
                  <TableHead className="text-right">LEAD TIME</TableHead>
                  <TableHead className="text-right">VALOR DE P&S</TableHead>
                  <TableHead className="text-right">TICKET MÉDIO DE P&S</TableHead>
                  <TableHead className="text-right">VALOR DE MRR</TableHead>
                  <TableHead className="text-right">TICKET MÉDIO DE MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reasonsData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.reason}</TableCell>
                    <TableCell className="text-right">{row.qtd}</TableCell>
                    <TableCell className="text-right">{((row.qtd / totalQtd) * 100).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">15,5 dias</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.pas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.pas / row.qtd)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.mrr)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
