import { useMemo } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Users,
  BarChart3,
  Activity,
  Zap,
  CheckCircle,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemoryReads } from '@/hooks/useMemories';
import { useGraphStats } from '@/hooks/useKnowledgeGraph';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface MemoryImpactMetrics {
  total_reads: number;
  unique_memories_used: number;
  reads_with_outcome: number;
  applied_rate: number;
  deals_with_memory: number;
}

interface MemoryStatsExtended {
  total: number;
  active: number;
  validated: number;
  totalUsage: number;
}

export function MemoryImpactDashboard() {
  const { data: currentUser } = useCurrentUser();
  const organizationId = currentUser?.profile?.organization_id;

  const { data: graphStats, isLoading: graphLoading } = useGraphStats();
  const { data: memoryReads, isLoading: readsLoading } = useMemoryReads();

  // Extended memory stats with validated count
  const { data: memoryStats, isLoading: statsLoading } = useQuery({
    queryKey: ['memory-stats-extended', organizationId],
    queryFn: async (): Promise<MemoryStatsExtended | null> => {
      if (!organizationId) return null;

      const { data: memories, error } = await supabase
        .from('memories')
        .select('status, validated, usage_count')
        .eq('organization_id', organizationId);

      if (error) throw error;

      return {
        total: memories?.length || 0,
        active: memories?.filter(m => m.status === 'active').length || 0,
        validated: memories?.filter(m => m.validated === true).length || 0,
        totalUsage: memories?.reduce((sum, m) => sum + (m.usage_count || 0), 0) || 0,
      };
    },
    enabled: !!organizationId
  });

  // Calculate memory impact metrics
  const memoryImpact = useMemo<MemoryImpactMetrics | null>(() => {
    if (!memoryReads) return null;

    const totalReads = memoryReads.length;
    const uniqueMemories = new Set(memoryReads.map(r => r.memory_id)).size;
    const readsWithOutcome = memoryReads.filter(r => r.outcome && r.outcome !== 'pending').length;
    const appliedCount = memoryReads.filter(r => r.outcome === 'applied').length;
    const dealsWithMemory = new Set(
      memoryReads
        .filter(r => r.entity_type === 'opportunity' && r.entity_id)
        .map(r => r.entity_id)
    ).size;

    return {
      total_reads: totalReads,
      unique_memories_used: uniqueMemories,
      reads_with_outcome: readsWithOutcome,
      applied_rate: readsWithOutcome > 0 ? (appliedCount / readsWithOutcome) * 100 : 0,
      deals_with_memory: dealsWithMemory,
    };
  }, [memoryReads]);

  // Graph density metrics from graph_nodes
  const { data: graphDensityData, isLoading: densityLoading } = useQuery({
    queryKey: ['graph-density-analysis', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      // Get opportunity nodes with their connectivity scores
      const { data: nodes, error: nodesError } = await supabase
        .from('graph_nodes')
        .select('entity_id, connectivity_score, node_type')
        .eq('organization_id', organizationId)
        .eq('node_type', 'opportunity');

      if (nodesError) throw nodesError;

      // Get opportunities with final status
      const { data: opportunities, error: oppsError } = await supabase
        .from('opportunities')
        .select('id, status')
        .eq('organization_id', organizationId)
        .in('status', ['won', 'lost']);

      if (oppsError) throw oppsError;

      // Build connectivity map
      const connectivityMap: Record<string, number> = {};
      nodes?.forEach(n => {
        connectivityMap[n.entity_id] = n.connectivity_score || 0;
      });

      // Calculate win rate by density
      const densityBuckets = {
        fraco: { total: 0, won: 0 },
        medio: { total: 0, won: 0 },
        denso: { total: 0, won: 0 },
      };

      opportunities?.forEach(opp => {
        const score = connectivityMap[opp.id] || 0;
        const density: 'fraco' | 'medio' | 'denso' = score > 0.7 ? 'denso' : score > 0.3 ? 'medio' : 'fraco';
        
        densityBuckets[density].total++;
        if (opp.status === 'won') {
          densityBuckets[density].won++;
        }
      });

      return Object.entries(densityBuckets).map(([density, data]) => ({
        density: density as 'fraco' | 'medio' | 'denso',
        total_deals: data.total,
        won: data.won,
        win_rate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
      }));
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isLoading = statsLoading || graphLoading || readsLoading || densityLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32" />
        ))}
        <div className="md:col-span-2 lg:col-span-4">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const densityLabels = {
    fraco: { label: 'Fraco', color: 'text-red-600', bg: 'bg-red-500' },
    medio: { label: 'Médio', color: 'text-yellow-600', bg: 'bg-yellow-500' },
    denso: { label: 'Denso', color: 'text-green-600', bg: 'bg-green-500' },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Memory Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Uso de Memória
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memoryImpact?.total_reads || 0}</div>
            <p className="text-xs text-muted-foreground">leituras totais</p>
            <div className="flex items-center gap-2 mt-2">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">{memoryImpact?.unique_memories_used || 0} memórias únicas</span>
            </div>
          </CardContent>
        </Card>

        {/* Applied Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Taxa de Aplicação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(memoryImpact?.applied_rate || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">memórias marcadas úteis</p>
            <Progress 
              value={memoryImpact?.applied_rate || 0} 
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>

        {/* Deals with Memory */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Deals com Memória
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memoryImpact?.deals_with_memory || 0}</div>
            <p className="text-xs text-muted-foreground">oportunidades impactadas</p>
          </CardContent>
        </Card>

        {/* Graph Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              Saúde do Grafo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{graphStats?.total_nodes || 0}</div>
            <p className="text-xs text-muted-foreground">nós no grafo</p>
            <div className="flex items-center gap-2 mt-2">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">{graphStats?.total_edges || 0} conexões</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Win Rate by Graph Density */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Win Rate por Densidade do Grafo
          </CardTitle>
          <CardDescription>
            Correlação entre densidade de relacionamentos e taxa de conversão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {graphDensityData && graphDensityData.some(d => d.total_deals > 0) ? (
            <div className="space-y-4">
              {graphDensityData.map((item) => {
                const config = densityLabels[item.density];
                return (
                  <div key={item.density} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", config.color)}
                        >
                          {config.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.total_deals} deals
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.win_rate}%</span>
                        <span className="text-xs text-muted-foreground">
                          ({item.won} ganhos)
                        </span>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all", config.bg)}
                        style={{ width: `${item.win_rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              {/* Insight callout */}
              {graphDensityData.length >= 2 && graphDensityData.some(d => d.total_deals > 0) && (
                <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Insight</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const denso = graphDensityData.find(d => d.density === 'denso');
                          const fraco = graphDensityData.find(d => d.density === 'fraco');
                          if (denso && fraco && denso.total_deals > 0 && fraco.total_deals > 0 && denso.win_rate > fraco.win_rate) {
                            const diff = denso.win_rate - fraco.win_rate;
                            return `Deals com grafo denso têm ${diff}% mais chance de fechar comparados a grafos fracos. Invista em expandir a rede de stakeholders.`;
                          }
                          return 'Continue construindo relacionamentos para ver correlações com win-rate.';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                Dados insuficientes para análise
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Complete mais deals para ver correlações de win-rate
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Insights Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumo de Insights Ativos
          </CardTitle>
          <CardDescription>
            Lacunas identificadas no pipeline que precisam de ação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="text-2xl font-bold text-red-600">
                {graphStats?.active_insights || 0}
              </div>
              <p className="text-xs text-red-700 dark:text-red-400">
                insights ativos
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">
                {memoryStats?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                memórias no sistema
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted">
              <div className="text-2xl font-bold">
                {memoryStats?.validated || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                memórias validadas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
