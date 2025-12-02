import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  TrendingUp,
  BarChart3,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getProposalAnalytics, getProposalViews, ProposalView } from '@/services/crm/proposal-analytics';

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
    refetchInterval: 30000, // Refresh every 30 seconds
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
          <p className="text-sm text-muted-foreground">Carregando analytics...</p>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Analytics de Visualização
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">Visualizações</span>
                </div>
                <p className="text-2xl font-bold">{analytics?.totalViews || 0}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Visitantes Únicos</span>
                </div>
                <p className="text-2xl font-bold">{analytics?.uniqueViewers || 0}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Tempo Médio</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatDuration(analytics?.avgSessionDuration || 0)}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Tempo Total</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatDuration(analytics?.totalTimeSpent || 0)}
                </p>
              </div>
            </div>

            {/* Last viewed */}
            {analytics?.lastViewedAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Última visualização:{' '}
                {formatDistanceToNow(new Date(analytics.lastViewedAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </div>
            )}

            {/* Device breakdown */}
            {analytics?.viewsByDevice && Object.keys(analytics.viewsByDevice).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Por Dispositivo</p>
                <div className="space-y-2">
                  {Object.entries(analytics.viewsByDevice).map(([device, count]) => {
                    const DeviceIcon = deviceIcons[device] || Monitor;
                    const percentage = Math.round((count / (analytics.totalViews || 1)) * 100);
                    return (
                      <div key={device} className="flex items-center gap-2">
                        <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="capitalize">{device}</span>
                            <span>{count} ({percentage}%)</span>
                          </div>
                          <Progress value={percentage} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <ScrollArea className="h-[300px]">
              {views.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma visualização registrada.
                </p>
              ) : (
                <div className="space-y-3">
                  {views.map((view: ProposalView) => (
                    <div
                      key={view.id}
                      className="flex items-start gap-3 p-2 rounded-lg border"
                    >
                      <div className="p-2 rounded-full bg-muted">
                        <Eye className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {format(new Date(view.viewed_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                          {view.device_type && (
                            <Badge variant="outline" className="text-xs">
                              {view.device_type}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {view.duration_seconds && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(view.duration_seconds)}
                            </span>
                          )}
                          {view.city && view.country && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {view.city}, {view.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="engagement">
            {!analytics?.sectionEngagement ||
            Object.keys(analytics.sectionEngagement).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Dados de engajamento indisponíveis.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">Tempo por Seção</p>
                {Object.entries(analytics.sectionEngagement)
                  .sort(([, a], [, b]) => b - a)
                  .map(([section, time]) => {
                    const totalTime = Object.values(analytics.sectionEngagement).reduce(
                      (a, b) => a + b,
                      0
                    );
                    const percentage = Math.round((time / totalTime) * 100);
                    return (
                      <div key={section}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize">{section}</span>
                          <span className="text-muted-foreground">
                            {formatDuration(time)} ({percentage}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
