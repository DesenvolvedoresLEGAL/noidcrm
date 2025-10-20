import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ConversionRate() {
  const alugueData = {
    stages: [
      { 
        stage: '+ OPP', 
        in: 76, out: 79, rate: 103.95, leadTimeWon: '0 dias', 
        won: { qtd: 0, leadTime: '0 dias', count: 1, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 25, pas: 0 }
      },
      { 
        stage: 'Proposta na Mesa', 
        in: 79, out: 77, rate: 97.47, leadTimeWon: '1 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 }
      },
      { 
        stage: 'Negociação FUP-1', 
        in: 70, out: 65, rate: 92.86, leadTimeWon: '2 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 9, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 4, pas: 0 }
      },
      { 
        stage: 'Negociação FUP-2', 
        in: 59, out: 50, rate: 84.75, leadTimeWon: '2 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 12, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 12, pas: 0 }
      },
      { 
        stage: 'Negociação FUP-3', 
        in: 49, out: 17, rate: 34.69, leadTimeWon: '3 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 31, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 18, pas: 0 }
      },
      { 
        stage: 'Negociação FUP-4', 
        in: 13, out: 1, rate: 7.69, leadTimeWon: '7 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 3, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 14, pas: 0 }
      },
      { 
        stage: 'Pré-Aprovação', 
        in: 4, out: 2, rate: 50.0, leadTimeWon: '7 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 }
      },
      { 
        stage: 'Ganhamos', 
        in: 17, out: 1, rate: 5.88, leadTimeWon: '0 dias',
        won: { qtd: 16, leadTime: '2 dias', count: 0, pas: 26420.5 },
        lost: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 }
      },
      { 
        stage: 'Perdemos', 
        in: 0, out: 0, rate: 0, leadTimeWon: '0 dias',
        won: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 },
        lost: { qtd: 0, leadTime: '0 dias', count: 0, pas: 0 }
      },
    ],
    summary: {
      newOpps: 75,
      wonRate: 21.33,
      won: 16,
      wonPercent: 22.22,
      wonPas: 26420.5,
      wonMrr: 0,
      lost: 56,
      lostPercent: 77.78,
      lostPas: 278154.39,
      lostMrr: 0
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  const StageBar = ({ in: inCount, out: outCount, rate }: { in: number; out: number; rate: number }) => {
    const color = rate > 80 ? 'bg-green-500' : rate > 50 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="flex-1 h-8 bg-muted rounded overflow-hidden">
          <div 
            className={`h-full ${color} transition-all`} 
            style={{ width: `${Math.min(rate, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Acompanhe a movimentação na pipeline, taxa de conversão e lead time, filtrados por etapas e desempenho no período.
        </p>
      </div>

      <Tabs defaultValue="alugue" className="w-full">
        <TabsList>
          <TabsTrigger value="alugue">ALUGUE: VENDAS</TabsTrigger>
          <TabsTrigger value="assinatura">ASSINATURA: VENDAS</TabsTrigger>
          <TabsTrigger value="aero">AERO: VENDAS</TabsTrigger>
        </TabsList>

        <TabsContent value="alugue" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Movimentações no período - ALUGUE: VENDAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ETAPAS</TableHead>
                      <TableHead className="text-center">ENTRADA</TableHead>
                      <TableHead className="text-center">SAÍDA</TableHead>
                      <TableHead className="text-center">TAXA</TableHead>
                      <TableHead className="text-center">LEAD TIME</TableHead>
                      <TableHead colSpan={2} className="text-center border-l">Oportunidades ganhas</TableHead>
                      <TableHead colSpan={2} className="text-center border-l">Oportunidades perdidas</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead></TableHead>
                      <TableHead className="text-center border-l">QUANTIDADE</TableHead>
                      <TableHead className="text-center">LEAD TIME</TableHead>
                      <TableHead className="text-center border-l">QUANTIDADE</TableHead>
                      <TableHead className="text-center">LEAD TIME</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alugueData.stages.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.stage}</TableCell>
                        <TableCell className="text-center">{row.in}</TableCell>
                        <TableCell className="text-center">{row.out}</TableCell>
                        <TableCell className="text-center">{row.rate.toFixed(2)}%</TableCell>
                        <TableCell className="text-center">{row.leadTimeWon}</TableCell>
                        <TableCell className="text-center border-l text-green-600 font-semibold">{row.won.qtd}</TableCell>
                        <TableCell className="text-center">{row.won.leadTime}</TableCell>
                        <TableCell className="text-center border-l text-red-600 font-semibold">{row.lost.qtd}</TableCell>
                        <TableCell className="text-center">{row.lost.leadTime}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-center">367</TableCell>
                      <TableCell className="text-center">292</TableCell>
                      <TableCell className="text-center">79.56%</TableCell>
                      <TableCell className="text-center">4 dias</TableCell>
                      <TableCell className="text-center border-l text-green-600">16</TableCell>
                      <TableCell className="text-center">2 dias</TableCell>
                      <TableCell className="text-center border-l text-red-600">56</TableCell>
                      <TableCell className="text-center">15 dias</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-4">RESUMO DO FUNIL:</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Novas oportunidades:</p>
                    <p className="text-xl font-bold">{alugueData.summary.newOpps}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Taxa de ganhas:</p>
                    <p className="text-xl font-bold text-green-600">{alugueData.summary.wonRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ganhas:</p>
                    <p className="text-xl font-bold text-green-600">
                      {alugueData.summary.won} ({alugueData.summary.wonPercent}%)
                    </p>
                    <p className="text-sm">P&S: {formatCurrency(alugueData.summary.wonPas)}</p>
                    <p className="text-sm">MRR: {formatCurrency(alugueData.summary.wonMrr)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Perdidas:</p>
                    <p className="text-xl font-bold text-red-600">
                      {alugueData.summary.lost} ({alugueData.summary.lostPercent}%)
                    </p>
                    <p className="text-sm">P&S: {formatCurrency(alugueData.summary.lostPas)}</p>
                    <p className="text-sm">MRR: {formatCurrency(alugueData.summary.lostMrr)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assinatura">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Não há dados registrados para este funil no período selecionado.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aero">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Não há dados registrados para este funil no período selecionado.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
