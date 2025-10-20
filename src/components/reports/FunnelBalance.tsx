import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function FunnelBalance() {
  const funnelData = [
    { 
      responsible: 'Leonardo Honório', 
      open: 6, 
      pas: 11024, 
      mrr: 0,
      prob: { p90: 0, p75: 0, p50: 6, p25: 0, p0: 0 },
      temp: { hot: 0, warm: 4, cold: 0, frozen: 1, uninformed: 5 }
    },
    { 
      responsible: 'Ionara Nobre', 
      open: 14, 
      pas: 55125, 
      mrr: 16000,
      prob: { p90: 0, p75: 4, p50: 10, p25: 0, p0: 0 },
      temp: { hot: 0, warm: 4, cold: 0, frozen: 0, uninformed: 10 }
    },
    { 
      responsible: 'Jaqueline Mota', 
      open: 5, 
      pas: 6790, 
      mrr: 8000,
      prob: { p90: 0, p75: 2, p50: 2, p25: 0, p0: 0 },
      temp: { hot: 0, warm: 1, cold: 2, frozen: 0, uninformed: 2 }
    },
    { 
      responsible: 'Jéssica Machado', 
      open: 9, 
      pas: 34270, 
      mrr: 11000,
      prob: { p90: 0, p75: 4, p50: 5, p25: 0, p0: 0 },
      temp: { hot: 0, warm: 5, cold: 0, frozen: 0, uninformed: 4 }
    },
    { 
      responsible: 'Wagner Sansevero', 
      open: 1, 
      pas: 0, 
      mrr: 0,
      prob: { p90: 0, p75: 0, p50: 1, p25: 0, p0: 0 },
      temp: { hot: 0, warm: 0, cold: 0, frozen: 0, uninformed: 1 }
    },
  ];

  const totals = funnelData.reduce((acc, curr) => ({
    open: acc.open + curr.open,
    pas: acc.pas + curr.pas,
    mrr: acc.mrr + curr.mrr,
    prob: {
      p90: acc.prob.p90 + curr.prob.p90,
      p75: acc.prob.p75 + curr.prob.p75,
      p50: acc.prob.p50 + curr.prob.p50,
      p25: acc.prob.p25 + curr.prob.p25,
      p0: acc.prob.p0 + curr.prob.p0,
    },
    temp: {
      hot: acc.temp.hot + curr.temp.hot,
      warm: acc.temp.warm + curr.temp.warm,
      cold: acc.temp.cold + curr.temp.cold,
      frozen: acc.temp.frozen + curr.temp.frozen,
      uninformed: acc.temp.uninformed + curr.temp.uninformed,
    }
  }), { 
    open: 0, 
    pas: 0, 
    mrr: 0,
    prob: { p90: 0, p75: 0, p50: 0, p25: 0, p0: 0 },
    temp: { hot: 0, warm: 0, cold: 0, frozen: 0, uninformed: 0 }
  });

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Monitore a quantidade, valores e perfil das oportunidades abertas, organizadas por responsável, 
          probabilidade e temperatura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balanceamento do funil - Oportunidades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className="align-middle">RESPONSÁVEL</TableHead>
                  <TableHead rowSpan={2} className="text-right align-middle">ABERTAS</TableHead>
                  <TableHead rowSpan={2} className="text-right align-middle">VALOR DE P&S</TableHead>
                  <TableHead rowSpan={2} className="text-right align-middle">VALOR DE MRR</TableHead>
                  <TableHead colSpan={5} className="text-center border-l">Probabilidade</TableHead>
                  <TableHead colSpan={5} className="text-center border-l">Temperatura</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="text-center border-l">90%</TableHead>
                  <TableHead className="text-center">75%</TableHead>
                  <TableHead className="text-center">50%</TableHead>
                  <TableHead className="text-center">25%</TableHead>
                  <TableHead className="text-center">0%</TableHead>
                  <TableHead className="text-center border-l">
                    <span className="text-red-600">MUITO QUENTE</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="text-orange-600">QUENTE</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="text-blue-600">MORNA</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="text-gray-600">FRIA</span>
                  </TableHead>
                  <TableHead className="text-center">NÃO INFOR.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnelData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.responsible}</TableCell>
                    <TableCell className="text-right">{row.open}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.pas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.mrr)}</TableCell>
                    <TableCell className="text-center border-l">
                      <Badge variant={row.prob.p90 > 0 ? "default" : "outline"}>{row.prob.p90}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.prob.p75 > 0 ? "default" : "outline"}>{row.prob.p75}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.prob.p50 > 0 ? "default" : "outline"}>{row.prob.p50}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.prob.p25 > 0 ? "default" : "outline"}>{row.prob.p25}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.prob.p0 > 0 ? "default" : "outline"}>{row.prob.p0}</Badge>
                    </TableCell>
                    <TableCell className="text-center border-l">
                      <Badge variant={row.temp.hot > 0 ? "destructive" : "outline"}>{row.temp.hot}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.temp.warm > 0 ? "default" : "outline"}>{row.temp.warm}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.temp.cold > 0 ? "secondary" : "outline"}>{row.temp.cold}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.temp.frozen > 0 ? "outline" : "outline"}>{row.temp.frozen}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{row.temp.uninformed}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{totals.open}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.pas)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.mrr)}</TableCell>
                  <TableCell className="text-center border-l">{totals.prob.p90}</TableCell>
                  <TableCell className="text-center">{totals.prob.p75}</TableCell>
                  <TableCell className="text-center">{totals.prob.p50}</TableCell>
                  <TableCell className="text-center">{totals.prob.p25}</TableCell>
                  <TableCell className="text-center">{totals.prob.p0}</TableCell>
                  <TableCell className="text-center border-l">{totals.temp.hot}</TableCell>
                  <TableCell className="text-center">{totals.temp.warm}</TableCell>
                  <TableCell className="text-center">{totals.temp.cold}</TableCell>
                  <TableCell className="text-center">{totals.temp.frozen}</TableCell>
                  <TableCell className="text-center">{totals.temp.uninformed}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
