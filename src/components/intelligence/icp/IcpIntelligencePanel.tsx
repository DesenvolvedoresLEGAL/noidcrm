import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Target, Info } from 'lucide-react';
import { useIcpIntelligence } from '@/hooks/intelligence/useIcpIntelligence';
import { IcpClusterCard } from './IcpClusterCard';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function IcpIntelligencePanel() {
  const { data, isLoading, error } = useIcpIntelligence();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao calcular ICPs: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ainda não há clientes ganhos suficientes na base para gerar clusters de ICP.
          Assim que oportunidades forem fechadas, os clusters aparecerão automaticamente.
        </AlertDescription>
      </Alert>
    );
  }

  const totalRevenue = data.reduce((s, c) => s + c.totalRevenue, 0);
  const totalClients = data.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Visão Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Clusters identificados</div>
              <div className="text-2xl font-bold">{data.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Clientes únicos</div>
              <div className="text-2xl font-bold">{totalClients}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Receita total mapeada</div>
              <div className="text-2xl font-bold">{fmtBRL(totalRevenue)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(c => <IcpClusterCard key={c.id} cluster={c} />)}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking de ICPs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ICP</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
                <TableHead className="text-right">Deals ganhos</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                <TableHead className="text-right">Recompra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">{c.wonDeals}</TableCell>
                  <TableCell className="text-right">{fmtBRL(c.totalRevenue)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(c.avgTicket)}</TableCell>
                  <TableCell className="text-right">{fmtBRL(c.ltv)}</TableCell>
                  <TableCell className="text-right">{c.repurchaseRate.toFixed(0)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
