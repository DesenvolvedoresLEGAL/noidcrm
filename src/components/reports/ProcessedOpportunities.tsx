import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ProcessedOpportunities() {
  const dailyData = [
    { date: '01/10/2025', novas: 5, ganhas: 2, perdidas: 1 },
    { date: '02/10/2025', novas: 7, ganhas: 1, perdidas: 2 },
    { date: '03/10/2025', novas: 6, ganhas: 3, perdidas: 4 },
    { date: '04/10/2025', novas: 0, ganhas: 0, perdidas: 0 },
    { date: '05/10/2025', novas: 3, ganhas: 1, perdidas: 1 },
    { date: '06/10/2025', novas: 8, ganhas: 4, perdidas: 2 },
    { date: '07/10/2025', novas: 9, ganhas: 3, perdidas: 5 },
    { date: '08/10/2025', novas: 7, ganhas: 2, perdidas: 3 },
  ];

  const tableDataWon = [
    { date: '01/10/2025', new: 5, processed: 0, qtd: 0, rate: '0,00%', leadTime: '0 dia', pas: 0, avgTicket: 0, mrr: 0 },
    { date: '02/10/2025', new: 7, processed: 3, qtd: 1, rate: '33,33%', leadTime: '5 dias', pas: 750, avgTicket: 750, mrr: 0 },
    { date: '03/10/2025', new: 6, processed: 6, qtd: 2, rate: '33,33%', leadTime: '0,5 dia', pas: 3100, avgTicket: 1550, mrr: 0 },
  ];

  const tableDataLost = [
    { date: '01/10/2025', new: 5, processed: 0, qtd: 0, rate: '0,00%', leadTime: '0 dia', pas: 0, avgTicket: 0, mrr: 0 },
    { date: '02/10/2025', new: 7, processed: 3, qtd: 2, rate: '66,67%', leadTime: '12,5 dias', pas: 24240, avgTicket: 12120, mrr: 0 },
    { date: '03/10/2025', new: 6, processed: 6, qtd: 4, rate: '66,67%', leadTime: '37,3 dias', pas: 8490, avgTicket: 2122.5, mrr: 0 },
  ];

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades por período (diário)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
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
          <Tabs defaultValue="won" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="won" className="flex-1">Processadas ganhas</TabsTrigger>
              <TabsTrigger value="lost" className="flex-1">Processadas perdidas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="won" className="mt-4">
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
                    {tableDataWon.map((row, idx) => (
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
            </TabsContent>
            
            <TabsContent value="lost" className="mt-4">
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
                    {tableDataLost.map((row, idx) => (
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
