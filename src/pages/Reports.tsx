import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { ReportFilters } from '@/components/ReportFilters';
import { ReportCharts } from '@/components/ReportCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listOpportunities } from '@/services/crm/opportunities';
import { useToast } from '@/hooks/use-toast';

export default function Reports() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    reportType: 'opportunities-processed',
    pipeline: 'all',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = async () => {
    try {
      const oppsData = await listOpportunities();
      const allOpps = oppsData.data;

      // Filtrar por pipeline se necessário
      const filteredOpps = filters.pipeline === 'all'
        ? allOpps
        : allOpps.filter(o => o.pipeline_id === filters.pipeline);

      // Filtrar por data
      const startDate = new Date(filters.startDate).getTime();
      const endDate = new Date(filters.endDate).getTime();
      const dateFilteredOpps = filteredOpps.filter(o => {
        const created = new Date(o.created_at).getTime();
        return created >= startDate && created <= endDate;
      });

      // Separar ganhas e perdidas
      const wonOpps = dateFilteredOpps.filter(o => o.meta?.status === 'Ganhou');
      const lostOpps = dateFilteredOpps.filter(o => o.meta?.status === 'Perdeu');

      // Agrupar por origem
      const groupByOrigem = (opps: any[]) => {
        const map = new Map();
        opps.forEach(opp => {
          const origem = opp.meta?.origem || 'Não definido';
          if (!map.has(origem)) {
            map.set(origem, { origem, count: 0, value: 0, mrr: 0 });
          }
          const current = map.get(origem);
          current.count += 1;
          current.value += opp.valor_previsto || 0;
          current.mrr += opp.meta?.mrr || 0;
        });
        return Array.from(map.values());
      };

      const wonByOrigem = groupByOrigem(wonOpps);
      const lostByOrigem = groupByOrigem(lostOpps);

      const totalOpps = dateFilteredOpps.length;
      const wonTotal = wonOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const wonMRR = wonOpps.reduce((sum, o) => sum + (o.meta?.mrr || 0), 0);
      const lostTotal = lostOpps.reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const lostMRR = lostOpps.reduce((sum, o) => sum + (o.meta?.mrr || 0), 0);

      setReportData({
        won: wonByOrigem,
        lost: lostByOrigem,
        totals: {
          won: {
            count: wonOpps.length,
            value: wonTotal,
            mrr: wonMRR,
            rate: totalOpps > 0 ? (wonOpps.length / totalOpps) * 100 : 0,
          },
          lost: {
            count: lostOpps.length,
            value: lostTotal,
            mrr: lostMRR,
            rate: totalOpps > 0 ? (lostOpps.length / totalOpps) * 100 : 0,
          },
        },
        table: [...wonByOrigem, ...lostByOrigem],
      });

      setReportGenerated(true);
      toast({
        title: 'Relatório gerado',
        description: 'Os dados foram processados com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar relatório',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setFilters({
      reportType: 'opportunities-processed',
      pipeline: 'all',
      startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    });
    setReportGenerated(false);
    setReportData(null);
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-foreground">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Análises detalhadas e métricas de performance
          </p>
        </div>

        {/* Filtros */}
        <ReportFilters
          filters={filters}
          onFiltersChange={setFilters}
          onGenerate={generateReport}
          onClear={clearFilters}
        />

        {/* Resultados */}
        {reportGenerated && reportData && (
          <div className="space-y-6">
            <Card className="shadow-card bg-muted/30">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  <strong>Período:</strong> {new Date(filters.startDate).toLocaleDateString('pt-BR')} até{' '}
                  {new Date(filters.endDate).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Funil:</strong> {filters.pipeline === 'all' ? 'Todos os funis' : filters.pipeline}
                </p>
              </CardContent>
            </Card>

            {/* Gráficos */}
            <ReportCharts data={reportData} totals={reportData.totals} />

            {/* Tabela Detalhada */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Oportunidades processadas por Origem</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ORIGEM</TableHead>
                      <TableHead className="text-right">QUANTIDADE</TableHead>
                      <TableHead className="text-right">VALOR P&S</TableHead>
                      <TableHead className="text-right">TICKET MÉDIO P&S</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.table.map((row: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.origem}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          }).format(row.value)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          }).format(row.count > 0 ? row.value / row.count : 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          }).format(row.mrr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {!reportGenerated && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              Configure os filtros e clique em "Gerar Relatório" para visualizar os dados.
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
