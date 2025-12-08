import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, BarChart3, Flame, History, Eye, Monitor, Smartphone, Tablet, Clock, MapPin } from 'lucide-react';
import { ProposalExecutiveHeader } from './ProposalExecutiveHeader';
import { ProposalContextSummary } from './ProposalContextSummary';
import { ProposalPreview } from './ProposalPreview';
import { 
  EngagementScoreCard, 
  ProposalTemperatureIndicator, 
  getProposalTemperature,
  ViewsTimelineChart,
  SectionHeatmap,
  HistoricalComparison
} from './analytics';
import { getProposalAnalytics, getProposalViews, ProposalView } from '@/services/crm/proposal-analytics';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProposalVisualizarTabProps {
  proposalId?: string;
  opportunityId?: string;
  content: {
    introduction?: string;
    terms?: string;
    notes?: string;
  };
  items?: ProposalItem[];
  paymentTerms?: PaymentTerm[];
  totalValue?: number;
  currency?: string;
  proposalNumber?: string;
  version?: number;
  contextData?: {
    account?: any;
    contact?: any;
    ownerName?: string;
    ownerAvatar?: string;
  };
  opportunityData?: any;
  activeViewers?: Array<{
    sessionId: string;
    viewedAt: string;
    deviceType?: string;
    city?: string;
  }>;
}

const deviceIcons: Record<string, any> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

export function ProposalVisualizarTab({
  proposalId,
  opportunityId,
  content,
  items = [],
  paymentTerms = [],
  totalValue = 0,
  currency = 'BRL',
  proposalNumber,
  version,
  contextData,
  opportunityData,
  activeViewers = [],
}: ProposalVisualizarTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('document');

  // Fetch analytics data
  const { data: analytics } = useQuery({
    queryKey: ['proposal-analytics-viz', proposalId],
    queryFn: () => getProposalAnalytics(proposalId!),
    enabled: !!proposalId,
  });

  // Fetch views data
  const { data: views = [] } = useQuery({
    queryKey: ['proposal-views-viz', proposalId],
    queryFn: () => getProposalViews(proposalId!),
    enabled: !!proposalId,
  });

  // Calculate temperature and metrics
  const engagementScore = analytics?.engagementScore || 0;
  const lastViewDate = analytics?.lastViewedAt ? new Date(analytics.lastViewedAt) : null;
  const daysSinceLastView = lastViewDate ? differenceInDays(new Date(), lastViewDate) : analytics?.daysSinceLastView || null;
  const temperature = getProposalTemperature(engagementScore, daysSinceLastView);

  // Prepare view timeline data
  const viewTimeline = views.reduce((acc: { date: string; views: number }[], view) => {
    const date = view.viewed_at.split('T')[0];
    const existing = acc.find(v => v.date === date);
    if (existing) {
      existing.views++;
    } else {
      acc.push({ date, views: 1 });
    }
    return acc;
  }, []);

  // Build context for ProposalContextSummary
  const account = contextData?.account;
  const contact = contextData?.contact;
  const owner = contextData?.ownerName ? {
    full_name: contextData.ownerName,
    avatar_url: contextData.ownerAvatar,
  } : undefined;
  const opportunity = opportunityData ? {
    id: opportunityData.id,
    title: opportunityData.title,
    valor_previsto: opportunityData.valor_previsto,
    close_date_prevista: opportunityData.close_date_prevista,
    stage_name: opportunityData.stage?.name,
    pipeline_name: opportunityData.pipeline?.name,
  } : undefined;

  // Current metrics for historical comparison
  const currentMetrics = {
    totalViews: analytics?.totalViews || 0,
    avgDuration: analytics?.avgSessionDuration || 0,
    engagementScore: analytics?.engagementScore || 0,
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <ProposalExecutiveHeader
        proposalNumber={proposalNumber}
        version={version}
        temperature={temperature}
        engagementScore={engagementScore}
        winProbabilityDelta={0} // Will be populated from AI analysis
        activeViewers={activeViewers}
      />

      {/* Context Summary */}
      <ProposalContextSummary
        account={account}
        contact={contact}
        owner={owner}
        opportunity={opportunity}
      />

      {/* Sub-Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="document" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documento
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="engagement" className="flex items-center gap-2">
            <Flame className="h-4 w-4" />
            Engajamento
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Document Tab */}
        <TabsContent value="document" className="mt-4">
          <ProposalPreview
            proposalId={proposalId}
            opportunityId={opportunityId}
            content={content}
            items={items}
            paymentTerms={paymentTerms}
            totalValue={totalValue}
            currency={currency}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Views Timeline Chart */}
            <ViewsTimelineChart views={views} viewTimeline={viewTimeline} />
            
            {/* Engagement Score */}
            <EngagementScoreCard score={engagementScore} />
          </div>

          {/* Views Detail Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Histórico de Visualizações ({views.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {views.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma visualização registrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {views.map((view, idx) => {
                      const DeviceIcon = deviceIcons[view.device_type || 'desktop'] || Monitor;
                      return (
                        <div 
                          key={view.id || idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <DeviceIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {format(parseISO(view.viewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {view.scroll_depth_percent && view.scroll_depth_percent > 80 && (
                                  <Badge variant="secondary" className="text-[10px]">Leitura completa</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {view.city && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {view.city}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(view.duration_seconds || 0)}
                                </span>
                                <span>{view.scroll_depth_percent || 0}% scroll</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section Heatmap */}
            <SectionHeatmap sections={analytics?.sectionEngagement || {}} />

            {/* Temperature & Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flame className="h-4 w-4" />
                  Indicadores de Engajamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Temperatura</span>
                  <ProposalTemperatureIndicator temperature={temperature} showLabel size="md" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <div className="text-2xl font-bold text-primary">{analytics?.totalViews || 0}</div>
                    <div className="text-xs text-muted-foreground">Visualizações</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <div className="text-2xl font-bold text-primary">{analytics?.uniqueViewers || 0}</div>
                    <div className="text-xs text-muted-foreground">Visitantes Únicos</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <div className="text-2xl font-bold text-primary">{formatDuration(analytics?.avgSessionDuration || 0)}</div>
                    <div className="text-xs text-muted-foreground">Tempo Médio</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <div className="text-2xl font-bold text-primary">{analytics?.forwardedCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Encaminhamentos</div>
                  </div>
                </div>

                {/* Device Breakdown */}
                {analytics?.viewsByDevice && Object.keys(analytics.viewsByDevice).length > 0 && (
                  <div className="pt-3 border-t">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Por Dispositivo</h4>
                    <div className="space-y-2">
                      {Object.entries(analytics.viewsByDevice).map(([device, count]) => {
                        const DeviceIcon = deviceIcons[device] || Monitor;
                        const total = Object.values(analytics.viewsByDevice!).reduce((a: number, b: number) => a + b, 0);
                        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={device} className="flex items-center gap-2">
                            <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right">{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4 space-y-6">
          <HistoricalComparison currentMetrics={currentMetrics} />
          
          {/* Version History Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Histórico de Versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">v{version || 1}</Badge>
                    <span className="text-sm">Versão atual</span>
                  </div>
                  <Badge variant="secondary">Ativa</Badge>
                </div>
                {(version || 1) > 1 && Array.from({ length: (version || 1) - 1 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">v{(version || 1) - 1 - i}</Badge>
                      <span className="text-sm text-muted-foreground">Versão anterior</span>
                    </div>
                    <Badge variant="outline">Arquivada</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
