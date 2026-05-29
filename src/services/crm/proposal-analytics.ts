import { supabase } from '@/integrations/supabase/client';
import {
  calculateProposalAnalyticsScore,
  type ProposalScoringResult,
  PROPOSAL_ANALYTICS_SCORING_VERSION,
} from '@/lib/proposals/analyticsScoring';

export interface ProposalView {
  id: string;
  proposal_id: string;
  viewed_at: string;
  duration_seconds: number | null;
  viewer_ip: string | null;
  viewer_user_agent: string | null;
  section_views: Record<string, number> | null;
  device_type: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
  // Sprint 2: Enhanced tracking fields
  scroll_depth_percent: number | null;
  sections_viewed: string[] | null;
  time_per_section: Record<string, number> | null;
  interactions: {
    clicks: number;
    copied_text: boolean;
    downloaded_pdf: boolean;
    printed: boolean;
  } | null;
  referrer: string | null;
  is_forwarded: boolean | null;
  viewport_width: number | null;
  viewport_height: number | null;
  session_id: string | null;
  view_end_at: string | null;
  // Internal vs External viewer tracking
  viewer_type: 'internal' | 'external' | null;
  viewer_user_id: string | null;
}

export interface ProposalViewEvent {
  id: string;
  proposal_id: string;
  view_id: string | null;
  session_id: string;
  event_type: 'scroll' | 'click' | 'section_enter' | 'section_exit' | 'copy' | 'download' | 'print';
  event_data: Record<string, any>;
  timestamp: string;
}

export type ProposalAlertType = 
  | 'high_engagement' 
  | 'price_focus' 
  | 'multiple_views' 
  | 'long_session' 
  | 'stale_proposal' 
  | 'pending_approval' 
  | 'forwarded' 
  | 'viewing_now'
  | 'deadline_approaching'
  | 'competitor_signal'
  | 'ready_to_close';

export interface ProposalAlert {
  id: string;
  proposal_id: string;
  organization_id: string;
  alert_type: ProposalAlertType;
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
  daysSinceLastView: number | null;
  viewsByDevice: Record<string, number>;
  viewsByLocation: { country: string; city: string; count: number }[];
  viewTimeline: { date: string; views: number }[];
  sectionEngagement: Record<string, number>;
  engagementScore: number;
  forwardedCount: number;
}

export async function getProposalViews(proposalId: string, externalOnly: boolean = true): Promise<ProposalView[]> {
  let query = supabase
    .from('proposal_views')
    .select('*')
    .eq('proposal_id', proposalId);
  
  // Filter to only external views (from clients, not internal CRM users)
  if (externalOnly) {
    query = query.eq('viewer_type', 'external');
  }
  
  const { data, error } = await query.order('viewed_at', { ascending: false });

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
  
  // Calculate days since last view
  const lastViewedAt = views[0]?.viewed_at || null;
  const daysSinceLastView = lastViewedAt
    ? Math.floor((Date.now() - new Date(lastViewedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  // Detect potential forwards (different IPs viewing)
  const forwardedCount = Math.max(0, uniqueIps.size - 1);
  
  // Calculate engagement score (0-100)
  const engagementScore = calculateEngagementScore({
    totalViews: views.length,
    uniqueViewers: uniqueIps.size,
    avgSessionDuration: views.length > 0 ? totalTimeSpent / views.length : 0,
    daysSinceLastView,
    sectionEngagement,
  });
  
  return {
    totalViews: views.length,
    uniqueViewers: uniqueIps.size,
    totalTimeSpent,
    avgSessionDuration: views.length > 0 ? totalTimeSpent / views.length : 0,
    lastViewedAt,
    daysSinceLastView,
    viewsByDevice,
    viewsByLocation,
    viewTimeline,
    sectionEngagement,
    engagementScore,
    forwardedCount,
  };
}

// Calculate engagement score based on multiple factors
function calculateEngagementScore(params: {
  totalViews: number;
  uniqueViewers: number;
  avgSessionDuration: number;
  daysSinceLastView: number | null;
  sectionEngagement: Record<string, number>;
}): number {
  const { totalViews, uniqueViewers, avgSessionDuration, daysSinceLastView, sectionEngagement } = params;
  
  // No views = 0 score
  if (totalViews === 0) return 0;
  
  let score = 0;
  
  // Views component (max 25 points)
  // 1 view = 10, 2 views = 15, 3+ views = 20-25
  score += Math.min(25, 10 + (totalViews - 1) * 5);
  
  // Multiple viewers bonus (max 15 points) - indicates forwarding/sharing
  if (uniqueViewers > 1) {
    score += Math.min(15, uniqueViewers * 5);
  }
  
  // Session duration component (max 30 points)
  // 30s = 5, 1min = 10, 2min = 15, 3min+ = 20-30
  const durationMinutes = avgSessionDuration / 60;
  score += Math.min(30, Math.floor(durationMinutes * 10));
  
  // Recency component (max 20 points)
  if (daysSinceLastView !== null) {
    if (daysSinceLastView === 0) score += 20;      // Today
    else if (daysSinceLastView <= 1) score += 18;  // Yesterday
    else if (daysSinceLastView <= 3) score += 15;  // Last 3 days
    else if (daysSinceLastView <= 7) score += 10;  // Last week
    else if (daysSinceLastView <= 14) score += 5;  // Last 2 weeks
    // Older than 2 weeks = 0 points
  }
  
  // Section engagement diversity (max 10 points)
  const sectionsViewed = Object.keys(sectionEngagement).length;
  score += Math.min(10, sectionsViewed * 2);
  
  return Math.min(100, Math.round(score));
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
