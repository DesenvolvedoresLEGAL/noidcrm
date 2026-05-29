import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Clock, 
  Users, 
  Monitor, 
  Smartphone, 
  Tablet,
  MapPin,
  BarChart3,
  Share2,
  Activity
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProposalAnalytics, getProposalViews, ProposalView } from '@/services/crm/proposal-analytics';
import { 
  EngagementScoreCard, 
  ProposalTemperatureIndicator, 
  getProposalTemperature,
  AnalyticsKPICard,
  SectionHeatmap,
  ViewsTimelineChart,
  HistoricalComparison
} from './analytics';

interface ProposalAnalyticsPanelProps {
  proposalId: string;
}

const deviceIcons: Record<string, any> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Monitor,
};

export function ProposalAnalyticsPanel({ proposalId }: ProposalAnalyticsPanelProps) {
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['proposal-analytics', proposalId],
    queryFn: () => getProposalAnalytics(proposalId),
    enabled: !!proposalId,
    refetchInterval: 30000,
  });

  const { data: views = [] } = useQuery({
    queryKey: ['proposal-views', proposalId],
    queryFn: () => getProposalViews(proposalId),
    enabled: !!proposalId,
  });

  if (!proposalId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Salve a proposta para ver analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (analyticsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-xl" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const temperature = getProposalTemperature(
    analytics?.engagementScore || 0,
    analytics?.daysSinceLastView ?? null
  );

  return (
    <div className="space-y-6">
      {/* Header with Temperature and Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Analytics de Visualização</h3>
        </div>
        <ProposalTemperatureIndicator temperature={temperature} size="md" />
      </div>

      {/* Engagement Score Card - Full Width */}
      <EngagementScoreCard
        score={analytics?.engagementScore || 0}
        label={analytics?.scoring?.engagement_label}
        explanation={analytics?.scoring?.score_explanation}
        historicalScore={analytics?.scoring?.historical_interest_score}
        riskScore={analytics?.scoring?.risk_score}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnalyticsKPICard
          icon={Eye}
          label="Visualizações"
          value={analytics?.totalViews || 0}
          subtitle={analytics?.lastViewedAt 
            ? `Última: ${formatDistanceToNow(new Date(analytics.lastViewedAt), { addSuffix: true, locale: ptBR })}`
            : undefined
          }
          variant={analytics?.totalViews && analytics.totalViews >= 3 ? 'success' : 'default'}
        />
        
        <AnalyticsKPICard
          icon={Users}
          label="Visitantes Únicos"
          value={analytics?.uniqueViewers || 0}
          subtitle={analytics?.forwardedCount && analytics.forwardedCount > 0 
            ? `${analytics.forwardedCount} possível encaminhamento`
            : undefined
          }
          variant={analytics?.uniqueViewers && analytics.uniqueViewers > 1 ? 'primary' : 'default'}
        />
        
        <AnalyticsKPICard
          icon={Clock}
          label="Tempo Médio"
          value={formatDuration(analytics?.avgSessionDuration || 0)}
          subtitle={`Total: ${formatDuration(analytics?.totalTimeSpent || 0)}`}
          variant={analytics?.avgSessionDuration && analytics.avgSessionDuration > 120 ? 'success' : 'default'}
        />
        
        <AnalyticsKPICard
          icon={Share2}
          label="Encaminhamentos"
          value={analytics?.forwardedCount || 0}
          subtitle={analytics?.forwardedCount && analytics.forwardedCount > 0 
            ? 'Proposta foi compartilhada!'
            : 'Nenhum detectado'
          }
          variant={analytics?.forwardedCount && analytics.forwardedCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="heatmap" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="heatmap">Atenção</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="comparison">Comparativo</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap">
          <SectionHeatmap sections={analytics?.sectionEngagement || {}} />
        </TabsContent>

        <TabsContent value="timeline">
          <div className="space-y-4">
            {/* Chart */}
            <ViewsTimelineChart 
              views={views} 
              viewTimeline={analytics?.viewTimeline || []} 
            />
            
            {/* Detailed list */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Histórico Detalhado</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[200px]">
                  {views.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma visualização registrada.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {views.map((view: ProposalView, index: number) => (
                        <div
                          key={view.id}
                          className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                        >
                          <div className="relative">
                            <div className="p-1.5 rounded-full bg-primary/10">
                              <Eye className="h-3 w-3 text-primary" />
                            </div>
                            {index === 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-background" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium">
                                {format(new Date(view.viewed_at), "dd/MM 'às' HH:mm", {
                                  locale: ptBR,
                                })}
                              </span>
                              {index === 0 && (
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-600">
                                  Recente
                                </Badge>
                              )}
                              {view.device_type && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {view.device_type}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {view.duration_seconds && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatDuration(view.duration_seconds)}
                                </span>
                              )}
                              {view.scroll_depth_percent && (
                                <span>Scroll: {view.scroll_depth_percent}%</span>
                              )}
                              {view.city && view.country && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {view.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison">
          <HistoricalComparison 
            currentMetrics={{
              totalViews: analytics?.totalViews || 0,
              avgDuration: analytics?.avgSessionDuration || 0,
              engagementScore: analytics?.engagementScore || 0,
            }}
          />
        </TabsContent>

        <TabsContent value="devices">
          <Card>
            <CardContent className="pt-4">
              {analytics?.viewsByDevice && Object.keys(analytics.viewsByDevice).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(analytics.viewsByDevice).map(([device, count]) => {
                    const DeviceIcon = deviceIcons[device] || Monitor;
                    const percentage = Math.round((count / (analytics.totalViews || 1)) * 100);
                    return (
                      <div key={device} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <DeviceIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium capitalize">{device}</span>
                            <span className="text-sm text-muted-foreground">
                              {count} {count === 1 ? 'visualização' : 'visualizações'}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground mt-1">{percentage}% do total</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Location info */}
                  {analytics.viewsByLocation && analytics.viewsByLocation.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Por Localização
                      </p>
                      <div className="space-y-2">
                        {analytics.viewsByLocation.slice(0, 5).map((loc, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {loc.city}, {loc.country}
                            </span>
                            <Badge variant="secondary">{loc.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum dado de dispositivo disponível.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
