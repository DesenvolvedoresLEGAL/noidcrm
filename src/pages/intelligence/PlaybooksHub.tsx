import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, Plus, Search, LayoutGrid, List, Sparkles, 
  BookOpen, Trophy, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, XCircle, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { 
  usePlaybooks, 
  useCreatePlaybook, 
  useUpdatePlaybook, 
  useTogglePlaybook,
  useDeployPlaybookVersion,
  useGeneratePlaybookFromWinLoss,
  usePlaybookROIAnalysis,
  usePlaybookExecutions,
  type Playbook 
} from '@/hooks/usePlaybookSystem';
import { PlaybookCard } from '@/components/playbook/PlaybookCard';
import { PlaybookEditor } from '@/components/playbook/PlaybookEditor';
import { PlaybookVersionHistory } from '@/components/playbook/PlaybookVersionHistory';
import { formatCurrencyFull } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'prospecting', label: 'Prospecção' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'negotiation', label: 'Negociação' },
  { id: 'closing', label: 'Fechamento' },
];

export default function PlaybooksHub() {
  const { data: playbooks, isLoading } = usePlaybooks();
  const createMutation = useCreatePlaybook();
  const updateMutation = useUpdatePlaybook();
  const toggleMutation = useTogglePlaybook();
  const deployMutation = useDeployPlaybookVersion();
  const generateFromWinLoss = useGeneratePlaybookFromWinLoss();
  
  // ROI Analysis for Leaderboard
  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis, isFetching } = usePlaybookROIAnalysis();
  const { data: executions } = usePlaybookExecutions();

  const [activeTab, setActiveTab] = useState('board');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState('leaderboard');

  const filteredPlaybooks = playbooks?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  }) || [];

  const activePlaybooks = filteredPlaybooks.filter(p => p.is_active && !p.auto_disabled);
  const disabledPlaybooks = filteredPlaybooks.filter(p => !p.is_active || p.auto_disabled);

  const handleSavePlaybook = (data: Partial<Playbook>) => {
    if (data.id) {
      updateMutation.mutate(data as Playbook);
    } else {
      createMutation.mutate(data);
    }
    setEditingPlaybook(null);
  };

  const handleEdit = (playbook: Playbook) => {
    setEditingPlaybook(playbook);
    setEditorOpen(true);
  };

  const handleDeploy = (playbookId: string) => {
    deployMutation.mutate({ playbookId });
  };

  const handleViewVersions = (playbookId: string) => {
    setSelectedPlaybookId(playbookId);
    setVersionHistoryOpen(true);
  };

  const handleDuplicate = (playbook: Playbook) => {
    const { id, created_at, updated_at, usage_count, roi_score, ...rest } = playbook;
    createMutation.mutate({
      ...rest,
      name: `${playbook.name} (cópia)`,
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    toggleMutation.mutate({ id, isActive });
  };

  const selectedPlaybook = playbooks?.find(p => p.id === selectedPlaybookId);

  // Stats
  const totalPlaybooks = playbooks?.length || 0;
  const activeCount = playbooks?.filter(p => p.is_active && !p.auto_disabled).length || 0;
  const autoDisabledCount = playbooks?.filter(p => p.auto_disabled).length || 0;
  const totalRevenue = playbooks?.reduce((sum, p) => sum + (p.total_revenue_generated || 0), 0) || 0;

  // Leaderboard helpers
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
    <Layout pageTitle="Playbooks">
      <div className="space-y-6 p-6">
        {/* Header */}
        <PageHeader
          icon={BookOpen}
          title="Playbooks"
          subtitle="Gerencie playbooks de vendas com versionamento, métricas de ROI e ranking"
          badge={{ label: "Inteligência", icon: Sparkles }}
          variant="indigo"
          actions={
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => generateFromWinLoss.mutate({})}
                disabled={generateFromWinLoss.isPending}
              >
                {generateFromWinLoss.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Gerar com IA
              </Button>
              <Button onClick={() => {
                setEditingPlaybook(null);
                setEditorOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Playbook
              </Button>
            </div>
          }
        />

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="board">📋 Board</TabsTrigger>
            <TabsTrigger value="ranking">🏆 ROI Ranking</TabsTrigger>
          </TabsList>

          {/* Board Tab */}
          <TabsContent value="board" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{totalPlaybooks}</div>
                  <div className="text-sm text-muted-foreground">Total Playbooks</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-500">{activeCount}</div>
                  <div className="text-sm text-muted-foreground">Ativos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-destructive">{autoDisabledCount}</div>
                  <div className="text-sm text-muted-foreground">Auto-desativados</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalRevenue)}
                  </div>
                  <div className="text-sm text-muted-foreground">Revenue Total</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar playbooks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={category} onValueChange={setCategory}>
                <TabsList>
                  {CATEGORIES.map(cat => (
                    <TabsTrigger key={cat.id} value={cat.id} className="text-xs sm:text-sm">
                      {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPlaybooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-muted-foreground mb-4">
                    {search || category !== 'all' 
                      ? 'Nenhum playbook encontrado com os filtros aplicados'
                      : 'Você ainda não tem playbooks'}
                  </div>
                  <Button onClick={() => {
                    setEditingPlaybook(null);
                    setEditorOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Playbook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Active Playbooks */}
                {activePlaybooks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">Playbooks Ativos</h2>
                      <Badge variant="secondary">{activePlaybooks.length}</Badge>
                    </div>
                    <div className={viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      : "space-y-3"
                    }>
                      {activePlaybooks.map(playbook => (
                        <PlaybookCard
                          key={playbook.id}
                          playbook={playbook}
                          onToggle={handleToggle}
                          onEdit={handleEdit}
                          onDeploy={handleDeploy}
                          onViewVersions={handleViewVersions}
                          onDuplicate={handleDuplicate}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Disabled Playbooks */}
                {disabledPlaybooks.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-muted-foreground">
                        Playbooks Inativos / Auto-desativados
                      </h2>
                      <Badge variant="secondary">{disabledPlaybooks.length}</Badge>
                    </div>
                    <div className={viewMode === 'grid' 
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      : "space-y-3"
                    }>
                      {disabledPlaybooks.map(playbook => (
                        <PlaybookCard
                          key={playbook.id}
                          playbook={playbook}
                          onToggle={handleToggle}
                          onEdit={handleEdit}
                          onDeploy={handleDeploy}
                          onViewVersions={handleViewVersions}
                          onDuplicate={handleDuplicate}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => refetchAnalysis()}
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

            {analysisLoading ? (
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

                {/* Leaderboard Content */}
                <Tabs value={leaderboardTab} onValueChange={setLeaderboardTab}>
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
                                <TableHead>Data</TableHead>
                                <TableHead>Playbook</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {executions.slice(0, 20).map((exec: any) => (
                                <TableRow key={exec.id}>
                                  <TableCell className="text-sm">
                                    {format(new Date(exec.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                  </TableCell>
                                  <TableCell>{exec.playbook?.name || 'N/A'}</TableCell>
                                  <TableCell>
                                    <Badge variant={
                                      exec.status === 'completed' ? 'default' :
                                      exec.status === 'in_progress' ? 'secondary' : 'outline'
                                    }>
                                      {exec.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {exec.final_value ? formatCurrencyFull(exec.final_value) : '-'}
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
          </TabsContent>
        </Tabs>

        {/* Editor Modal */}
        <PlaybookEditor
          playbook={editingPlaybook}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSave={handleSavePlaybook}
        />

        {/* Version History Modal */}
        <PlaybookVersionHistory
          playbookId={selectedPlaybookId}
          currentVersionId={selectedPlaybook?.current_version_id || null}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
        />
      </div>
    </Layout>
  );
}
