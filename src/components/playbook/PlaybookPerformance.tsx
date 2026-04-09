import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, TrendingUp, Users, DollarSign, Target, BarChart3 } from 'lucide-react';
import { usePlaybooks, usePlaybookROIAnalysis } from '@/hooks/usePlaybookSystem';
import { useLeadSearches } from '@/hooks/useLeadSourcing';
import { formatCurrencyFull } from '@/lib/i18n';

export function PlaybookPerformance() {
  const { data: playbooks, isLoading: pbLoading } = usePlaybooks();
  const { data: analysis, isLoading: analysisLoading } = usePlaybookROIAnalysis();
  const { data: searches } = useLeadSearches();

  const isLoading = pbLoading || analysisLoading;

  // Aggregate lead search stats per playbook type
  const searchStats = searches?.reduce((acc, s) => {
    const type = s.search_type;
    if (!acc[type]) acc[type] = { searches: 0, results: 0, approved: 0 };
    acc[type].searches++;
    acc[type].results += s.results_count;
    acc[type].approved += s.approved_count;
    return acc;
  }, {} as Record<string, { searches: number; results: number; approved: number }>) || {};

  const totalLeads = searches?.reduce((sum, s) => sum + s.results_count, 0) || 0;
  const totalApproved = searches?.reduce((sum, s) => sum + s.approved_count, 0) || 0;
  const totalRevenue = playbooks?.reduce((sum, p) => sum + (p.total_revenue_generated || 0), 0) || 0;
  const avgConversion = analysis?.summary?.avg_conversion_rate || 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <Users className="h-4 w-4" />
              Leads Gerados
            </div>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Target className="h-4 w-4" />
              Aprovados
            </div>
            <div className="text-2xl font-bold text-green-600">{totalApproved}</div>
            {totalLeads > 0 && (
              <div className="text-xs text-muted-foreground">
                {((totalApproved / totalLeads) * 100).toFixed(1)}% de aprovação
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Conversão Média
            </div>
            <div className="text-2xl font-bold">{avgConversion.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Revenue Total
            </div>
            <div className="text-2xl font-bold">{formatCurrencyFull(totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Playbook ROI Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ROI por Playbook
          </CardTitle>
          <CardDescription>Ranking de playbooks por retorno sobre investimento</CardDescription>
        </CardHeader>
        <CardContent>
          {analysis?.playbooks?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Playbook</TableHead>
                  <TableHead className="text-right">ROI/h</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.playbooks
                  .sort((a: any, b: any) => (b.metrics?.roi_per_hour || 0) - (a.metrics?.roi_per_hour || 0))
                  .map((p: any, i: number) => (
                    <TableRow key={p.playbook_id}>
                      <TableCell className="font-medium">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.category || 'Sem categoria'}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrencyFull(p.metrics?.roi_per_hour || 0)}</TableCell>
                      <TableCell className="text-right">{(p.metrics?.conversion_rate || 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{p.metrics?.total_executions || 0}</TableCell>
                      <TableCell className="text-right">{formatCurrencyFull(p.metrics?.total_revenue || 0)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado de performance disponível ainda
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Sourcing Stats */}
      {Object.keys(searchStats).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance por Tipo de Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Buscas</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Aprovados</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(searchStats).map(([type, stats]) => (
                  <TableRow key={type}>
                    <TableCell className="font-medium capitalize">{type}</TableCell>
                    <TableCell className="text-right">{stats.searches}</TableCell>
                    <TableCell className="text-right">{stats.results}</TableCell>
                    <TableCell className="text-right">{stats.approved}</TableCell>
                    <TableCell className="text-right">
                      {stats.results > 0 ? ((stats.approved / stats.results) * 100).toFixed(1) : '0'}%
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
