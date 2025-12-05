import { supabase } from '@/integrations/supabase/client';

export interface AIAction {
  id: string;
  organization_id: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  confidence_score: number;
  status: string;
  decision_data: Record<string, unknown>;
  context_data: Record<string, unknown>;
  executed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  override_data: Record<string, unknown> | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAlert {
  id: string;
  organization_id: string;
  user_id: string;
  alert_type: string;
  priority: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  status: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AIActionStats {
  total24h: number;
  autoExecuted: number;
  executedNotified: number;
  awaitingApproval: number;
  approved: number;
  rejected: number;
  overridden: number;
  successRate: number;
  avgConfidence: number;
}

export interface AIAlertStats {
  activeAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  acknowledgedToday: number;
}

// Fetch AI action stats for last 24h
export async function getAIActionStats(): Promise<AIActionStats> {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data, error } = await supabase
    .from('ai_actions')
    .select('status, confidence_score')
    .gte('created_at', since.toISOString());

  if (error) {
    console.error('Error fetching AI action stats:', error);
    throw error;
  }

  const actions = data || [];
  const total = actions.length;
  
  const autoExecuted = actions.filter(a => a.status === 'auto_executed').length;
  const executedNotified = actions.filter(a => a.status === 'executed_notified').length;
  const awaitingApproval = actions.filter(a => a.status === 'awaiting_approval').length;
  const approved = actions.filter(a => a.status === 'approved').length;
  const rejected = actions.filter(a => a.status === 'rejected').length;
  const overridden = actions.filter(a => a.status === 'overridden').length;

  const successfulActions = autoExecuted + executedNotified + approved;
  const completedActions = successfulActions + rejected;
  const successRate = completedActions > 0 ? (successfulActions / completedActions) * 100 : 100;

  const avgConfidence = total > 0 
    ? actions.reduce((sum, a) => sum + Number(a.confidence_score || 0), 0) / total 
    : 0;

  return {
    total24h: total,
    autoExecuted,
    executedNotified,
    awaitingApproval,
    approved,
    rejected,
    overridden,
    successRate: Math.round(successRate),
    avgConfidence: Math.round(avgConfidence * 100),
  };
}

// Fetch AI alert stats
export async function getAIAlertStats(): Promise<AIAlertStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: activeData } = await supabase
    .from('ai_alerts')
    .select('priority')
    .eq('status', 'active');

  const { data: acknowledgedData } = await supabase
    .from('ai_alerts')
    .select('id')
    .eq('status', 'acknowledged')
    .gte('acknowledged_at', today.toISOString());

  const active = activeData || [];
  
  return {
    activeAlerts: active.length,
    criticalAlerts: active.filter(a => a.priority === 'critical').length,
    highAlerts: active.filter(a => a.priority === 'high').length,
    acknowledgedToday: acknowledgedData?.length || 0,
  };
}

// Fetch recent AI actions
export async function getRecentAIActions(limit = 20): Promise<AIAction[]> {
  const { data, error } = await supabase
    .from('ai_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching AI actions:', error);
    throw error;
  }

  return (data || []) as unknown as AIAction[];
}

// Fetch pending approvals
export async function getPendingApprovals(): Promise<AIAction[]> {
  const { data, error } = await supabase
    .from('ai_actions')
    .select('*')
    .eq('status', 'awaiting_approval')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending approvals:', error);
    throw error;
  }

  return (data || []) as unknown as AIAction[];
}

// Fetch active alerts
export async function getActiveAlerts(): Promise<AIAlert[]> {
  const { data, error } = await supabase
    .from('ai_alerts')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active alerts:', error);
    throw error;
  }

  return (data || []) as unknown as AIAlert[];
}

// Approve an AI action
export async function approveAIAction(actionId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('ai_actions')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
    })
    .eq('id', actionId);

  if (error) {
    console.error('Error approving AI action:', error);
    throw error;
  }

  // Record feedback
  const { data: action } = await supabase
    .from('ai_actions')
    .select('decision_data, organization_id')
    .eq('id', actionId)
    .single();

  if (action) {
    await supabase.from('ai_feedback').insert({
      organization_id: action.organization_id,
      ai_action_id: actionId,
      feedback_type: 'approval',
      original_decision: action.decision_data as Record<string, unknown>,
      created_by: user.id,
    } as any);
  }
}

// Reject an AI action
export async function rejectAIAction(actionId: string, reason: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('ai_actions')
    .update({
      status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      override_reason: reason,
    })
    .eq('id', actionId);

  if (error) {
    console.error('Error rejecting AI action:', error);
    throw error;
  }

  // Record feedback
  const { data: action } = await supabase
    .from('ai_actions')
    .select('decision_data, organization_id')
    .eq('id', actionId)
    .single();

  if (action) {
    await supabase.from('ai_feedback').insert({
      organization_id: action.organization_id,
      ai_action_id: actionId,
      feedback_type: 'rejection',
      original_decision: action.decision_data as Record<string, unknown>,
      feedback_reason: reason,
      created_by: user.id,
    } as any);
  }
}

// Override an AI action with correction
export async function overrideAIAction(
  actionId: string, 
  correctedDecision: Record<string, unknown>,
  reason: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: action } = await supabase
    .from('ai_actions')
    .select('decision_data, organization_id')
    .eq('id', actionId)
    .single();

  if (!action) throw new Error('Action not found');

  const { error } = await supabase
    .from('ai_actions')
    .update({
      status: 'overridden',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      override_data: correctedDecision as any,
      override_reason: reason,
    })
    .eq('id', actionId);

  if (error) {
    console.error('Error overriding AI action:', error);
    throw error;
  }

  // Record feedback for ML learning
  await supabase.from('ai_feedback').insert({
    organization_id: action.organization_id,
    ai_action_id: actionId,
    feedback_type: 'correction',
    original_decision: action.decision_data as Record<string, unknown>,
    corrected_decision: correctedDecision,
    feedback_reason: reason,
    created_by: user.id,
  } as any);
}

// Acknowledge an alert
export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_alerts')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error acknowledging alert:', error);
    throw error;
  }
}

// Resolve an alert
export async function resolveAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

// Dismiss an alert
export async function dismissAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_alerts')
    .update({
      status: 'dismissed',
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error dismissing alert:', error);
    throw error;
  }
}

// Get action type label
export function getActionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    lead_routing: 'Roteamento de Lead',
    stage_change: 'Mudança de Etapa',
    follow_up: 'Follow-up',
    email_send: 'Envio de Email',
    task_create: 'Criação de Tarefa',
    score_update: 'Atualização de Score',
    opportunity_created: 'Oportunidade Criada',
    nurturing_enrolled: 'Inscrito em Nutrição',
  };
  return labels[type] || type;
}

// Get alert type label
export function getAlertTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    high_value_risk: 'Deal Alto Valor em Risco',
    exception: 'Exceção IA',
    imminent_close: 'Fechamento Iminente',
    performance_below: 'Performance Abaixo',
    escalation: 'Escalonamento',
  };
  return labels[type] || type;
}

// Get confidence level info
export function getConfidenceInfo(score: number): { level: string; color: string; action: string } {
  if (score >= 0.9) {
    return { level: 'Alta', color: 'bg-green-500', action: 'Auto-executado' };
  } else if (score >= 0.7) {
    return { level: 'Média', color: 'bg-yellow-500', action: 'Executado com notificação' };
  } else {
    return { level: 'Baixa', color: 'bg-red-500', action: 'Aguardando aprovação' };
  }
}
