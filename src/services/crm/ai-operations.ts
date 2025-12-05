import { supabase } from '@/integrations/supabase/client';

export interface AutomationStats {
  workflowExecutions: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    last24h: number;
  };
  aiSuggestions: {
    pending: number;
    accepted: number;
    dismissed: number;
    autoApplied: number;
  };
  notifications: {
    staleOpportunities: number;
    aiAutoApplied: number;
    workflowAlerts: number;
  };
  cronJobs: {
    name: string;
    schedule: string;
    active: boolean;
    lastRun?: string;
  }[];
}

export interface RecentAutomation {
  id: string;
  type: 'workflow' | 'ai_suggestion' | 'notification';
  title: string;
  description: string;
  status: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Fetch automation statistics for AI Operations Dashboard
 */
export async function getAutomationStats(): Promise<AutomationStats> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Workflow executions stats
  const { data: workflowStats } = await supabase
    .from('workflow_executions')
    .select('status, created_at')
    .gte('created_at', last24h);

  const workflowExecutions = {
    pending: workflowStats?.filter(w => w.status === 'pending').length || 0,
    running: workflowStats?.filter(w => w.status === 'running').length || 0,
    completed: workflowStats?.filter(w => w.status === 'completed').length || 0,
    failed: workflowStats?.filter(w => w.status === 'failed').length || 0,
    last24h: workflowStats?.length || 0,
  };

  // AI suggestions stats
  const { data: suggestionStats } = await supabase
    .from('ai_suggestions')
    .select('status');

  const aiSuggestions = {
    pending: suggestionStats?.filter(s => s.status === 'pending').length || 0,
    accepted: suggestionStats?.filter(s => s.status === 'accepted').length || 0,
    dismissed: suggestionStats?.filter(s => s.status === 'dismissed').length || 0,
    autoApplied: 0, // Will be calculated from notifications
  };

  // Notifications stats (recent)
  const { data: notificationStats } = await supabase
    .from('notifications')
    .select('type')
    .gte('created_at', last24h);

  const notifications = {
    staleOpportunities: notificationStats?.filter(n => n.type === 'stale_opportunity').length || 0,
    aiAutoApplied: notificationStats?.filter(n => n.type === 'ai_auto_applied').length || 0,
    workflowAlerts: notificationStats?.filter(n => n.type === 'workflow').length || 0,
  };

  // Update auto-applied count
  aiSuggestions.autoApplied = notifications.aiAutoApplied;

  // CRON jobs (static list since we can't query cron.job from client)
  const cronJobs = [
    { name: 'process-pending-workflows', schedule: 'A cada 5 minutos', active: true },
    { name: 'auto-apply-ai-suggestions', schedule: 'A cada 6 horas', active: true },
    { name: 'detect-stale-opportunities', schedule: 'A cada 12 horas', active: true },
    { name: 'activity-reminders', schedule: 'A cada hora', active: true },
    { name: 'daily-briefing-generator', schedule: 'Diário às 06:00 UTC', active: true },
    { name: 'auto-task-creator', schedule: 'Diário às 07:00 UTC', active: true },
    { name: 'daily-scoring-cron', schedule: 'Diário às 05:00 UTC', active: true },
  ];

  return {
    workflowExecutions,
    aiSuggestions,
    notifications,
    cronJobs,
  };
}

/**
 * Fetch recent automations for activity feed
 */
export async function getRecentAutomations(limit: number = 20): Promise<RecentAutomation[]> {
  const automations: RecentAutomation[] = [];

  // Get recent workflow executions
  const { data: workflows } = await supabase
    .from('workflow_executions')
    .select(`
      id,
      status,
      trigger_type,
      created_at,
      completed_at,
      workflow_rules(name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  for (const w of workflows || []) {
    const rule = Array.isArray(w.workflow_rules) ? w.workflow_rules[0] : w.workflow_rules;
    automations.push({
      id: w.id,
      type: 'workflow',
      title: rule?.name || 'Workflow',
      description: `Trigger: ${w.trigger_type} • Status: ${w.status}`,
      status: w.status,
      timestamp: w.created_at,
    });
  }

  // Get recent AI-related notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, message, created_at, metadata')
    .in('type', ['ai_auto_applied', 'stale_opportunity', 'workflow'])
    .order('created_at', { ascending: false })
    .limit(10);

  for (const n of notifications || []) {
    automations.push({
      id: n.id,
      type: n.type === 'workflow' ? 'workflow' : 'notification',
      title: n.title,
      description: n.message,
      status: 'sent',
      timestamp: n.created_at,
      metadata: n.metadata as Record<string, any>,
    });
  }

  // Sort by timestamp and limit
  return automations
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Manually trigger workflow processing
 */
export async function triggerWorkflowProcessing(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('process-pending-workflows', {
      body: {},
    });

    if (error) throw error;

    return {
      success: true,
      message: `Processados: ${data.processed || 0} workflows (${data.succeeded || 0} sucesso, ${data.failed || 0} falhas)`,
    };
  } catch (error) {
    console.error('Error triggering workflow processing:', error);
    return {
      success: false,
      message: String(error),
    };
  }
}

/**
 * Manually trigger AI suggestions auto-apply
 */
export async function triggerAISuggestionsAutoApply(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('auto-apply-ai-suggestions', {
      body: {},
    });

    if (error) throw error;

    return {
      success: true,
      message: `Aplicados: ${data.applied || 0} sugestões (${data.skipped || 0} ignoradas, ${data.errors || 0} erros)`,
    };
  } catch (error) {
    console.error('Error triggering AI suggestions auto-apply:', error);
    return {
      success: false,
      message: String(error),
    };
  }
}

/**
 * Manually trigger stale opportunities detection
 */
export async function triggerStaleOpportunitiesDetection(): Promise<{ success: boolean; message: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('detect-stale-opportunities', {
      body: {},
    });

    if (error) throw error;

    return {
      success: true,
      message: `Detectadas: ${data.total_stale || 0} oportunidades estagnadas, ${data.alerts_created || 0} alertas criados`,
    };
  } catch (error) {
    console.error('Error triggering stale opportunities detection:', error);
    return {
      success: false,
      message: String(error),
    };
  }
}
