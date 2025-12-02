import { supabase } from '@/integrations/supabase/client';

export interface ProposalView {
  id: string;
  proposal_id: string;
  viewed_at: string;
  duration_seconds: number | null;
  viewer_ip: string | null;
  viewer_user_agent: string | null;
  section_views: Record<string, number>;
  device_type: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
}

export interface ProposalAlert {
  id: string;
  proposal_id: string;
  organization_id: string;
  alert_type: 'high_engagement' | 'price_focus' | 'multiple_views' | 'long_session' | 'stale_proposal' | 'pending_approval';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'critical';
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface ProposalAnalytics {
  totalViews: number;
  uniqueViewers: number;
  totalTimeSpent: number;
  avgSessionDuration: number;
  lastViewedAt: string | null;
  viewsByDevice: Record<string, number>;
  viewsByLocation: { country: string; city: string; count: number }[];
  viewTimeline: { date: string; views: number }[];
  sectionEngagement: Record<string, number>;
}

export async function getProposalViews(proposalId: string): Promise<ProposalView[]> {
  const { data, error } = await supabase
    .from('proposal_views')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('viewed_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ProposalView[];
}

export async function getProposalAnalytics(proposalId: string): Promise<ProposalAnalytics> {
  const views = await getProposalViews(proposalId);
  
  // Calculate analytics from views
  const uniqueIps = new Set(views.map(v => v.viewer_ip).filter(Boolean));
  const totalTimeSpent = views.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
  
  // Views by device
  const viewsByDevice: Record<string, number> = {};
  views.forEach(v => {
    const device = v.device_type || 'unknown';
    viewsByDevice[device] = (viewsByDevice[device] || 0) + 1;
  });
  
  // Views by location
  const locationMap = new Map<string, number>();
  views.forEach(v => {
    if (v.country) {
      const key = `${v.country}|${v.city || 'Unknown'}`;
      locationMap.set(key, (locationMap.get(key) || 0) + 1);
    }
  });
  const viewsByLocation = Array.from(locationMap.entries()).map(([key, count]) => {
    const [country, city] = key.split('|');
    return { country, city, count };
  });
  
  // View timeline (last 30 days)
  const timelineMap = new Map<string, number>();
  views.forEach(v => {
    const date = v.viewed_at.split('T')[0];
    timelineMap.set(date, (timelineMap.get(date) || 0) + 1);
  });
  const viewTimeline = Array.from(timelineMap.entries())
    .map(([date, viewCount]) => ({ date, views: viewCount }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Section engagement
  const sectionEngagement: Record<string, number> = {};
  views.forEach(v => {
    if (v.section_views) {
      Object.entries(v.section_views).forEach(([section, time]) => {
        sectionEngagement[section] = (sectionEngagement[section] || 0) + (time as number);
      });
    }
  });
  
  return {
    totalViews: views.length,
    uniqueViewers: uniqueIps.size,
    totalTimeSpent,
    avgSessionDuration: views.length > 0 ? totalTimeSpent / views.length : 0,
    lastViewedAt: views[0]?.viewed_at || null,
    viewsByDevice,
    viewsByLocation,
    viewTimeline,
    sectionEngagement,
  };
}

export async function getProposalAlerts(proposalId: string): Promise<ProposalAlert[]> {
  const { data, error } = await supabase
    .from('proposal_alerts')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ProposalAlert[];
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('proposal_alerts')
    .update({ is_read: true })
    .eq('id', alertId);

  if (error) throw error;
}

export async function createProposalAlert(alert: Omit<ProposalAlert, 'id' | 'created_at' | 'is_read'>): Promise<ProposalAlert> {
  const { data, error } = await supabase
    .from('proposal_alerts')
    .insert({ ...alert, is_read: false })
    .select()
    .single();

  if (error) throw error;
  return data as ProposalAlert;
}

// Generate smart alerts based on viewing behavior
export async function analyzeAndGenerateAlerts(proposalId: string, organizationId: string): Promise<void> {
  const analytics = await getProposalAnalytics(proposalId);
  const existingAlerts = await getProposalAlerts(proposalId);
  
  const recentAlertTypes = new Set(
    existingAlerts
      .filter(a => new Date(a.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .map(a => a.alert_type)
  );
  
  // High engagement alert (multiple views in short time)
  if (analytics.totalViews >= 3 && !recentAlertTypes.has('multiple_views')) {
    await createProposalAlert({
      proposal_id: proposalId,
      organization_id: organizationId,
      alert_type: 'multiple_views',
      title: 'Alto interesse detectado',
      message: `A proposta foi visualizada ${analytics.totalViews} vezes. O cliente demonstra alto interesse!`,
      severity: 'success',
      metadata: { viewCount: analytics.totalViews },
    });
  }
  
  // Long session alert
  if (analytics.avgSessionDuration > 300 && !recentAlertTypes.has('long_session')) {
    await createProposalAlert({
      proposal_id: proposalId,
      organization_id: organizationId,
      alert_type: 'long_session',
      title: 'Sessão longa detectada',
      message: `O cliente passou em média ${Math.round(analytics.avgSessionDuration / 60)} minutos analisando a proposta.`,
      severity: 'info',
      metadata: { avgDuration: analytics.avgSessionDuration },
    });
  }
  
  // Price focus alert
  const priceTime = analytics.sectionEngagement['pricing'] || 0;
  const totalTime = Object.values(analytics.sectionEngagement).reduce((a, b) => a + b, 0);
  if (totalTime > 0 && priceTime / totalTime > 0.4 && !recentAlertTypes.has('price_focus')) {
    await createProposalAlert({
      proposal_id: proposalId,
      organization_id: organizationId,
      alert_type: 'price_focus',
      title: 'Foco em preços',
      message: 'O cliente passou mais de 40% do tempo na seção de preços. Considere fazer follow-up sobre condições.',
      severity: 'warning',
      metadata: { pricePercentage: Math.round((priceTime / totalTime) * 100) },
    });
  }
}
