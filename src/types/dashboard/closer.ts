export type CloserPeriodKey =
  | 'current_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'current_quarter'
  | 'custom';

export type CloserWidgetAvailability = 'ready' | 'unavailable';

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

export interface CloserCentralDoDia {
  today_activities_count: number;
  overdue_followups_count: number;
  proposals_expiring_today: number;
  proposals_expiring_48h: number;
  proposals_expired: number;
  proposals_viewed_no_followup: number;
  opportunities_without_next_activity: number;
  stalled_opportunities: number;
}

export interface CloserRiskDeal {
  id: string;
  title: string;
  valor_previsto: number | null;
  stage_name: string | null;
  nome_fantasia: string | null;
  razao_social: string | null;
  last_contact_date: string | null;
  risk_reason: string;
}

export interface CloserOverdueFollowup {
  id: string;
  title: string;
  scheduled_date: string;
  type: string;
  opportunity_id: string | null;
  deal_title: string | null;
  customer_name: string | null;
  days_overdue: number;
}

export interface CloserViewedProposal {
  id: string;
  title: string | null;
  value: number | null;
  last_viewed_at: string;
  views_count: number | null;
  opportunity_id: string;
  customer_name: string | null;
}

export interface CloserProposalAction {
  id: string;
  title: string | null;
  value: number | null;
  status: string;
  expires_at: string | null;
  last_viewed_at: string | null;
  opportunity_id: string;
  customer_name: string | null;
  reason: string;
}

export interface CloserAgendaItem {
  id: string;
  title: string;
  type: string;
  scheduled_date: string;
  opportunity_id: string | null;
  customer_name: string | null;
}

export interface CloserNextAction {
  priority: number;
  type: string;
  title: string;
  action_label: string;
  proposal_id: string | null;
  opportunity_id: string | null;
  customer_name: string | null;
  value: number | null;
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
  central_do_dia: CloserCentralDoDia;
  lists: {
    risk_deals: CloserRiskDeal[];
    overdue_followups: CloserOverdueFollowup[];
    viewed_proposals: CloserViewedProposal[];
    proposals_action_required: CloserProposalAction[];
    today_agenda: CloserAgendaItem[];
    next_actions: CloserNextAction[];
  };
  availability: Record<string, CloserWidgetAvailability>;
  metadata: {
    generated_at: string;
    source: string;
    goal_source?: string;
    warnings: string[];
  };
}
