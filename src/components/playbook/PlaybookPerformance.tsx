import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, TrendingUp, Users, Target, BarChart3, Download, Clock, XCircle } from 'lucide-react';
import { usePlaybookPerformanceStats } from '@/hooks/useLeadSourcingV2';

const typeLabels: Record<string, string> = {
  manual_import: 'Importação Manual',
  import: 'Importação',
  event: 'Evento',
  directory: 'Diretório',
  geo: 'Geográfica',
  seed: 'Seed',
  unknown: 'Outro',
};

export function PlaybookPerformance() {
  const { data: stats, isLoading } = usePlaybookPerformanceStats();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <BarChart3 className="h-4 w-4" />
              Execuções
            </div>
            <div className="text-2xl font-bold">{stats.totalRuns}</div>
            <div className="text-xs text-muted-foreground">
              {stats.completedRuns} concluídas
              {stats.failedRuns > 0 && (
                <span className="text-destructive"> · {stats.failedRuns} falhas</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Prospects Criados
            </div>
            <div className="text-2xl font-bold">{stats.totalProspects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="h-4 w-4" />
              Taxa de Aprovação
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.approvalRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {stats.approvedProspects} de {stats.totalProspects}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Download className="h-4 w-4" />
              Taxa de Importação
            </div>
            <div className="text-2xl font-bold">{stats.importRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {stats.importedProspects} importados
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </div>
            <div className="text-2xl font-bold">
              {stats.avgExecutionTime > 0 ? `${(stats.avgExecutionTime / 1000).toFixed(1)}s` : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <XCircle className="h-4 w-4" />
              Taxa de Falha
            </div>
            <div className="text-2xl font-bold">
              {stats.totalRuns > 0 ? ((stats.failedRuns / stats.totalRuns) * 100).toFixed(1) : '0'}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Conversão Geral
            </div>
            <div className="text-2xl font-bold">
              {stats.totalProspects > 0 ? ((stats.importedProspects / stats.totalProspects) * 100).toFixed(1) : '0'}%
            </div>
            <div className="text-xs text-muted-foreground">prospect → CRM</div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance por Tipo
            </CardTitle>
            <CardDescription>Breakdown por tipo de playbook</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Prospects</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">Importados</TableHead>
                  <TableHead className="text-right">Taxa Aprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b.prospects - a.prospects)
                  .map(([type, data]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{typeLabels[type] || type}</TableCell>
                      <TableCell className="text-right">{data.runs}</TableCell>
                      <TableCell className="text-right">{data.prospects}</TableCell>
                      <TableCell className="text-right text-green-600">{data.approved}</TableCell>
                      <TableCell className="text-right">{data.imported}</TableCell>
                      <TableCell className="text-right">
                        {data.prospects > 0 ? ((data.approved / data.prospects) * 100).toFixed(1) : '0'}%
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
