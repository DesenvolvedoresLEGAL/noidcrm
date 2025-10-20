import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function AccumulatedOpportunities() {
  const cumulativeData = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return {
      date: `${day.toString().padStart(2, '0')}/10/2025`,
      novas: 5 + Math.floor(Math.random() * 3) * day,
      ganhas: 2 + Math.floor(Math.random() * 2) * day,
      perdidas: 1 + Math.floor(Math.random() * 2) * day,
    };
  });

  const tableData = [
    { date: '01/10/2025', new: 5, processed: 0, qtd: 0, rate: '0,00%', leadTime: '0 dia', pas: 0, avgTicket: 0, mrr: 0 },
    { date: '02/10/2025', new: 7, processed: 3, qtd: 1, rate: '33,33%', leadTime: '5 dias', pas: 750, avgTicket: 750, mrr: 0 },
    { date: '03/10/2025', new: 6, processed: 6, qtd: 2, rate: '33,33%', leadTime: '0,5 dia', pas: 3100, avgTicket: 1550, mrr: 0 },
    { date: '04/10/2025', new: 0, processed: 0, qtd: 0, rate: '0,00%', leadTime: '0 dia', pas: 0, avgTicket: 0, mrr: 0 },
  ];

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Acompanhe o volume diário de oportunidades, valores acumulados (P&S e MRR) e tempo médio de conversão, 
          segmentando por status (ganhas/perdidas).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades por período (acumuladas por dia)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                dataKey="date" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                interval={4}
              />
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
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades processadas no período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DIA</TableHead>
                  <TableHead className="text-right">NOVAS OPORTUNIDADES</TableHead>
                  <TableHead className="text-right">OPORTUNIDADES PROCESSADAS (QTD. TOTAL)</TableHead>
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
                {tableData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right">{row.new}</TableCell>
                    <TableCell className="text-right">{row.processed}</TableCell>
                    <TableCell className="text-right">{row.qtd}</TableCell>
                    <TableCell className="text-right">{row.rate}</TableCell>
                    <TableCell className="text-right">{row.leadTime}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.pas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.avgTicket)}</TableCell>
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
