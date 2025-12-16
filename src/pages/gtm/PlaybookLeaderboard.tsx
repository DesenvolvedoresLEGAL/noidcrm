import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, Trophy, TrendingUp, TrendingDown, Minus, 
  AlertTriangle, CheckCircle2, XCircle, ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { usePlaybookROIAnalysis, usePlaybookExecutions } from '@/hooks/usePlaybookSystem';
import { formatCurrencyFull } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PlaybookLeaderboard() {
  const { data: analysis, isLoading, refetch, isFetching } = usePlaybookROIAnalysis();
  const { data: executions } = usePlaybookExecutions();
  const [activeTab, setActiveTab] = useState('leaderboard');

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'good': return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const sortedPlaybooks = analysis?.playbooks?.sort((a: any, b: any) => 
    b.metrics.roi_per_hour - a.metrics.roi_per_hour
  ) || [];

  const topPerformers = sortedPlaybooks.slice(0, 5);
  const needsAttention = sortedPlaybooks.filter((p: any) => 
    p.health_status === 'warning' || p.health_status === 'critical'
  );

  return (
    <Layout pageTitle="Playbook Leaderboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500" />
              ROI Leaderboard
            </h1>
            <p className="text-muted-foreground">
              Ranking de playbooks por ROI e métricas de performance
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar Análise
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !analysis ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Não foi possível carregar a análise de ROI
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{analysis.summary.total_playbooks}</div>
                  <div className="text-sm text-muted-foreground">Total Playbooks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-500">{analysis.summary.active_playbooks}</div>
                  <div className="text-sm text-muted-foreground">Ativos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{analysis.summary.total_executions}</div>
                  <div className="text-sm text-muted-foreground">Execuções (90d)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{(analysis.summary.avg_conversion_rate || 0).toFixed(1)}%</div>
                  <div className="text-sm text-muted-foreground">Conversão Média</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">
                    {formatCurrencyFull(analysis.summary.total_revenue || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Revenue Total</div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="leaderboard">🏆 Ranking</TabsTrigger>
                <TabsTrigger value="attention">⚠️ Atenção ({needsAttention.length})</TabsTrigger>
                <TabsTrigger value="executions">📊 Execuções</TabsTrigger>
              </TabsList>

              <TabsContent value="leaderboard" className="space-y-4">
                {/* Top Performers Highlight */}
                {topPerformers.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topPerformers.slice(0, 3).map((playbook: any, index: number) => (
                      <Card key={playbook.playbook_id} className={cn(
                        "relative overflow-hidden",
                        index === 0 && "border-amber-500/50 bg-amber-500/5"
                      )}>
                        <div className="absolute top-2 right-2">
                          {index === 0 && <Trophy className="h-5 w-5 text-amber-500" />}
                          {index === 1 && <span className="text-lg">🥈</span>}
                          {index === 2 && <span className="text-lg">🥉</span>}
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            {getHealthIcon(playbook.health_status)}
                            {playbook.name}
                          </CardTitle>
                          <CardDescription>
                            {playbook.category || 'Sem categoria'} • v{playbook.version}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">ROI/hora</div>
                              <div className="text-xl font-bold">
                                {formatCurrencyFull(playbook.metrics.roi_per_hour || 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversão</div>
                              <div className="text-xl font-bold">
                                {(playbook.metrics.conversion_rate || 0).toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Execuções</div>
                              <div className="font-medium">{playbook.metrics.total_executions}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground flex items-center gap-1">
                                Tendência {getTrendIcon(playbook.trend.direction)}
                              </div>
                              <div className="font-medium">
                                {playbook.trend.recent_executions} recentes
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Full Ranking Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ranking Completo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Playbook</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">ROI/h</TableHead>
                          <TableHead className="text-right">Conversão</TableHead>
                          <TableHead className="text-right">Execuções</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Ciclo (dias)</TableHead>
                          <TableHead>Tendência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPlaybooks.map((playbook: any, index: number) => (
                          <TableRow key={playbook.playbook_id}>
                            <TableCell className="font-medium">
                              {index === 0 && '🥇'}
                              {index === 1 && '🥈'}
                              {index === 2 && '🥉'}
                              {index > 2 && index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getHealthIcon(playbook.health_status)}
                                <div>
                                  <div className="font-medium">{playbook.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {playbook.category || 'Sem categoria'} • v{playbook.version}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  playbook.auto_disabled ? 'destructive' :
                                  playbook.is_active ? 'default' : 'secondary'
                                }
                              >
                                {playbook.auto_disabled ? 'Auto-off' :
                                 playbook.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrencyFull(playbook.metrics.roi_per_hour || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {(playbook.metrics.conversion_rate || 0).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {playbook.metrics.total_executions}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrencyFull(playbook.metrics.total_revenue || 0)}
                            </TableCell>
                            <TableCell className="text-right">
                              {playbook.metrics.avg_cycle_days || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {getTrendIcon(playbook.trend.direction)}
                                <span className="text-xs text-muted-foreground">
                                  {playbook.trend.recent_executions} / 30d
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attention" className="space-y-4">
                {needsAttention.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <div className="text-lg font-medium">Tudo em ordem!</div>
                      <div className="text-muted-foreground">
                        Nenhum playbook precisa de atenção no momento
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {needsAttention.map((playbook: any) => (
                      <Card key={playbook.playbook_id} className="border-amber-500/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {getHealthIcon(playbook.health_status)}
                                {playbook.name}
                              </CardTitle>
                              <CardDescription>
                                {playbook.category} • v{playbook.version}
                              </CardDescription>
                            </div>
                            <Badge variant={playbook.auto_disabled ? 'destructive' : 'secondary'}>
                              {playbook.auto_disabled ? 'Auto-desativado' : 'Atenção'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">ROI/hora</div>
                              <div className="font-medium text-destructive">
                                {formatCurrencyFull(playbook.metrics.roi_per_hour || 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Threshold</div>
                              <div className="font-medium">
                                {formatCurrencyFull(playbook.thresholds.roi_threshold || 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Execuções</div>
                              <div className="font-medium">
                                {playbook.metrics.total_executions} / {playbook.thresholds.min_sample_size}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversão</div>
                              <div className="font-medium">
                                {(playbook.metrics.conversion_rate || 0).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                          
                          {playbook.recommendations?.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">Recomendações:</div>
                              <ul className="text-sm text-muted-foreground space-y-1">
                                {playbook.recommendations.map((rec: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <ArrowUpRight className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="executions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Execuções Recentes</CardTitle>
                    <CardDescription>
                      Últimas execuções de playbooks e seus resultados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!executions?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma execução encontrada
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Playbook</TableHead>
                            <TableHead>Oportunidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Converteu?</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">ROI</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {executions.slice(0, 20).map((exec: any) => (
                            <TableRow key={exec.id}>
                              <TableCell className="font-medium">
                                {exec.ai_playbooks?.name || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px] truncate">
                                  {exec.opportunities?.title || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  exec.status === 'completed' ? 'default' :
                                  exec.status === 'in_progress' ? 'secondary' :
                                  'outline'
                                }>
                                  {exec.status === 'completed' ? 'Concluído' :
                                   exec.status === 'in_progress' ? 'Em andamento' :
                                   exec.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {exec.converted ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : exec.status === 'completed' ? (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {exec.converted ? formatCurrencyFull(exec.revenue_generated || 0) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {exec.roi_value ? formatCurrencyFull(exec.roi_value) + '/h' : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(exec.started_at), "dd/MM HH:mm", { locale: ptBR })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
}
