export type CloserPeriodKey =
  | 'current_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'current_quarter'
  | 'custom';

export type CloserWidgetAvailability = 'ready' | 'unavailable';
export type CloserSeverity = 'critical' | 'attention' | 'opportunity' | 'info';
export type CloserItemKind = 'activity' | 'proposal' | 'opportunity';

export type CloserPaceStatus =
  | 'Acima do pace'
  | 'No pace'
  | 'Atrasado'
  | 'Crítico'
  | 'Meta não configurada';

export type CloserPaceSeverity = 'success' | 'info' | 'attention' | 'critical' | 'warning';

export interface CloserPaceData {
  available: boolean;
  reason?: string;
  goal_value?: number;
  realized_value?: number;
  goal_attainment_percent?: number;
  business_days_total?: number;
  business_days_elapsed?: number;
  business_days_remaining?: number;
  expected_pace_today?: number;
  pace_gap_value?: number;
  remaining_to_goal?: number;
  required_daily_rate?: number;
  current_daily_average?: number;
  pace_percent?: number;
  status: CloserPaceStatus;
  severity: CloserPaceSeverity;
  business_days_rule?: string;
  pace_uses_current_month?: boolean;
  goal_source?: string;
  why_here?: string;
}

export interface CloserDashboardKpis {
  open_pipeline_value: number;
  open_pipeline_count: number;
  proposals_open_value: number;
  proposals_open_count: number;
  proposals_viewed_count: number;
  overdue_followups_count: number;
  risk_deals_count: number;
  monthly_goal_value: number | null;
  monthly_revenue_value: number;
  goal_attainment_percent: number | null;
  win_rate_percent: number | null;
  won_count: number;
  lost_count: number;
  average_ticket_value: number | null;
}

export interface CloserCentralCounts {
  today_activities_count: number;
  overdue_followups_count: number;
  proposals_expiring_today: number;
  proposals_expiring_48h: number;
  proposals_expired: number;
  proposals_viewed_no_followup: number;
  opportunities_without_next_activity: number;
  stalled_opportunities: number;
}

export interface CloserListItem {
  id: string;
  kind: CloserItemKind;
  title?: string | null;
  type?: string | null;
  value?: number | null;
  scheduled_date?: string | null;
  expires_at?: string | null;
  last_viewed_at?: string | null;
  last_contact_date?: string | null;
  customer_name?: string | null;
  opportunity_id?: string | null;
  stage_name?: string | null;
  days_overdue?: number;
  days_in_stage?: number;
  risk_reason?: string;
  severity: CloserSeverity;
  why_here: string;
}

export interface CloserNextAction {
  priority: number;
  severity: CloserSeverity;
  type: string;
  title: string;
  action_label: string;
  proposal_id: string | null;
  opportunity_id: string | null;
  customer_name: string | null;
  value: number | null;
  why_here: string;
}

export interface CloserGoalWarning {
  severity: CloserSeverity;
  audience: 'admin' | 'user';
  message: string;
  reason: string;
}

export interface CloserDashboardData {
  error?: 'not_a_closer';
  user: { id: string; name: string | null; email: string | null };
  context: {
    permission_key: string | null;
    department_key: string | null;
    business_function_key: string | null;
    requires_review: boolean;
  };
  period: { key: CloserPeriodKey; start_date: string; end_date: string };
  kpis: CloserDashboardKpis;
  central_do_dia: CloserCentralCounts;
  lists: {
    today_agenda: CloserListItem[];
    overdue_followups: CloserListItem[];
    proposals_expiring_today: CloserListItem[];
    proposals_expiring_48h: CloserListItem[];
    proposals_expired: CloserListItem[];
    proposals_viewed_no_followup: CloserListItem[];
    opportunities_without_next_activity: CloserListItem[];
    stalled_opportunities: CloserListItem[];
    risk_deals: CloserListItem[];
    top_actions_today: CloserNextAction[];
  };
  availability: Record<string, CloserWidgetAvailability>;
  goal_warning: CloserGoalWarning | null;
  pace?: CloserPaceData;
  metadata: {
    generated_at: string;
    source: string;
    goal_source?: string;
    warnings: string[];
  };
}
