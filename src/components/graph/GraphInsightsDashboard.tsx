import { useState } from 'react';
import { 
  AlertTriangle, Users, TrendingDown, Target, RefreshCw, 
  CheckCircle2, XCircle, Clock, Filter, ChevronRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useOrganizationInsights, 
  useGraphStats, 
  useGraphBuilds,
  useTriggerGraphBuild,
  useUpdateInsightStatus 
} from '@/hooks/useKnowledgeGraph';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const insightTypeLabels: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  missing_champion: { label: 'Sem Champion', icon: Users },
  missing_decision_maker: { label: 'Sem Decisor', icon: Users },
  silent_stakeholder: { label: 'Stakeholder Silencioso', icon: Clock },
  isolated_deal: { label: 'Deal Isolado', icon: Target },
  weak_relationship: { label: 'Relacionamento Fraco', icon: TrendingDown },
  network_gap: { label: 'Gap de Rede', icon: AlertTriangle },
  high_centrality: { label: 'Alta Centralidade', icon: Target },
  engagement_decay: { label: 'Engajamento Caindo', icon: TrendingDown },
};

const severityOrder = ['critical', 'high', 'medium', 'low'];

export function GraphInsightsDashboard() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: insights, isLoading: insightsLoading } = useOrganizationInsights(statusFilter, 100);
  const { data: stats, isLoading: statsLoading } = useGraphStats();
  const { data: builds, isLoading: buildsLoading } = useGraphBuilds(5);
  const triggerBuild = useTriggerGraphBuild();
  const updateStatus = useUpdateInsightStatus();

  const isLoading = insightsLoading || statsLoading || buildsLoading;

  // Filter and sort insights
  const filteredInsights = (insights || [])
    .filter(i => typeFilter === 'all' || i.insight_type === typeFilter)
    .sort((a, b) => {
      const severityDiff = severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Count by type
  const insightCounts = (insights || []).reduce((acc, i) => {
    acc[i.insight_type] = (acc[i.insight_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleNavigateToEntity = (entityType: string, entityId: string) => {
    if (entityType === 'opportunity') {
      navigate(`/app/opportunities/${entityId}`);
    } else if (entityType === 'account') {
      navigate(`/app/accounts/${entityId}`);
    } else if (entityType === 'contact') {
      navigate(`/app/contacts/${entityId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Nós</p>
                <p className="text-2xl font-bold">{stats?.total_nodes || 0}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Conexões</p>
                <p className="text-2xl font-bold">{stats?.total_edges || 0}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Insights Ativos</p>
                <p className="text-2xl font-bold text-orange-500">{stats?.active_insights || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Último Build</p>
                <p className="text-sm font-medium">
                  {stats?.last_build?.completed_at 
                    ? new Date(stats.last_build.completed_at).toLocaleDateString('pt-BR')
                    : 'Nunca'
                  }
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => triggerBuild.mutate('full')}
                disabled={triggerBuild.isPending}
              >
                <RefreshCw className={cn(
                  "h-4 w-4 mr-1",
                  triggerBuild.isPending && "animate-spin"
                )} />
                Rebuild
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="builds">Histórico de Builds</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="acknowledged">Reconhecidos</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="dismissed">Descartados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(insightTypeLabels).map(([type, { label }]) => (
                  <SelectItem key={type} value={type}>
                    {label} ({insightCounts[type] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="ml-auto">
              {filteredInsights.length} insights
            </Badge>
          </div>

          {/* Insights List */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {filteredInsights.length > 0 ? (
                  <div className="divide-y">
                    {filteredInsights.map(insight => {
                      const typeInfo = insightTypeLabels[insight.insight_type] || { 
                        label: insight.insight_type, 
                        icon: AlertTriangle 
                      };
                      const Icon = typeInfo.icon;

                      return (
                        <div 
                          key={insight.id}
                          className="p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <Icon className={cn(
                              "h-5 w-5 mt-0.5 flex-shrink-0",
                              insight.severity === 'critical' && "text-red-500",
                              insight.severity === 'high' && "text-orange-500",
                              insight.severity === 'medium' && "text-yellow-500",
                              insight.severity === 'low' && "text-muted-foreground"
                            )} />
                            
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {typeInfo.label}
                                </Badge>
                                <Badge 
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    insight.severity === 'critical' && "border-red-500 text-red-600",
                                    insight.severity === 'high' && "border-orange-500 text-orange-600",
                                    insight.severity === 'medium' && "border-yellow-500 text-yellow-600"
                                  )}
                                >
                                  {insight.severity}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(insight.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              
                              <p className="font-medium">{insight.title}</p>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                              
                              {insight.suggested_action && (
                                <p className="text-sm text-primary mt-2">
                                  💡 {insight.suggested_action}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {insight.status === 'active' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => updateStatus.mutate({ 
                                      insightId: insight.id, 
                                      status: 'resolved' 
                                    })}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                                    Resolver
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => updateStatus.mutate({ 
                                      insightId: insight.id, 
                                      status: 'dismissed' 
                                    })}
                                  >
                                    <XCircle className="h-4 w-4 mr-1 text-muted-foreground" />
                                  </Button>
                                </>
                              )}
                              
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleNavigateToEntity(insight.entity_type, insight.entity_id)}
                              >
                                Ver
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                    <p className="text-lg font-medium">Nenhum insight encontrado</p>
                    <p className="text-sm">Todos os deals estão com boa cobertura</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="builds">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Builds</CardTitle>
              <CardDescription>Últimas execuções do Knowledge Graph</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {builds?.map(build => (
                  <div 
                    key={build.id}
                    className="flex items-center justify-between p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={build.status === 'completed' ? 'default' : 'destructive'}>
                        {build.status}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">
                          Build {build.build_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(build.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p>{build.nodes_created} nós</p>
                      <p>{build.edges_created} conexões</p>
                      <p>{build.insights_generated} insights</p>
                      {build.duration_ms && (
                        <p className="text-xs text-muted-foreground">
                          {(build.duration_ms / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Nós por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.nodes_by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conexões por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.edges_by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
