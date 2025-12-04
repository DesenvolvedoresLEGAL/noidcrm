import { supabase } from '@/integrations/supabase/client';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
}

export interface WorkflowActionConfig {
  target_stage_id?: string;
  target_pipeline_id?: string;
  title_prefix?: string;
  loss_reason_id?: string;
  activity_type?: string;
  title?: string;
  description?: string;
  days_offset?: number;
  fields?: Array<{ name: string; value: any }>;
  user_id?: string;
  message?: string;
}

export interface WorkflowAction {
  type: 'move_stage' | 'duplicate' | 'close_won' | 'close_lost' | 'create_activity' | 'update_fields' | 'notify_user';
  config: WorkflowActionConfig;
}

export interface WorkflowRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: 'stage_enter' | 'stage_exit' | 'opportunity_won' | 'opportunity_lost' | 'activity_completed' | 'opportunity_created' | 'proposal_viewed';
  trigger_config: {
    pipeline_id?: string;
    stage_id?: string;
    activity_type?: string;
  };
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  execution_order: number;
  executions_count: number;
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_rule_id: string;
  organization_id: string;
  opportunity_id?: string;
  activity_id?: string;
  trigger_type: string;
  trigger_data: any;
  conditions_evaluated?: any[];
  actions_executed: any[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
  workflow_rules?: WorkflowRule;
}

// Trigger type labels
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  stage_enter: 'Ao entrar na etapa',
  stage_exit: 'Ao sair da etapa',
  opportunity_won: 'Ao ganhar oportunidade',
  opportunity_lost: 'Ao perder oportunidade',
  activity_completed: 'Ao concluir atividade',
  opportunity_created: 'Ao criar oportunidade',
  proposal_viewed: 'Ao cliente visualizar proposta',
};

// Action type labels
export const ACTION_TYPE_LABELS: Record<string, string> = {
  move_stage: 'Mover para etapa',
  duplicate: 'Duplicar oportunidade',
  close_won: 'Encerrar como ganha',
  close_lost: 'Encerrar como perdida',
  create_activity: 'Criar atividade',
  update_fields: 'Atualizar campos',
  notify_user: 'Notificar usuário',
};

// Condition operator labels
export const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  equals: 'Igual a',
  not_equals: 'Diferente de',
  contains: 'Contém',
  greater_than: 'Maior que',
  less_than: 'Menor que',
  is_empty: 'Está vazio',
  is_not_empty: 'Não está vazio',
};

// List workflow rules
export async function listWorkflowRules(): Promise<WorkflowRule[]> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .order('execution_order', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as WorkflowRule[];
}

// Get single workflow rule
export async function getWorkflowRule(id: string): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as WorkflowRule;
}

// Create workflow rule
export async function createWorkflowRule(rule: Partial<WorkflowRule>): Promise<WorkflowRule> {
  const orgId = await supabase.rpc('get_user_organization_id');
  
  const { data, error } = await supabase
    .from('workflow_rules')
    .insert({
      organization_id: orgId.data,
      name: rule.name,
      description: rule.description,
      is_active: rule.is_active ?? true,
      trigger_type: rule.trigger_type as any,
      trigger_config: rule.trigger_config || {},
      conditions: (rule.conditions || []) as any,
      actions: (rule.actions || []) as any,
      execution_order: rule.execution_order || 0,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as WorkflowRule;
}

// Update workflow rule
export async function updateWorkflowRule(id: string, rule: Partial<WorkflowRule>): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .update({
      name: rule.name,
      description: rule.description,
      is_active: rule.is_active,
      trigger_type: rule.trigger_type as any,
      trigger_config: rule.trigger_config as any,
      conditions: (rule.conditions || []) as any,
      actions: (rule.actions || []) as any,
      execution_order: rule.execution_order,
    } as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as WorkflowRule;
}

// Delete workflow rule
export async function deleteWorkflowRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('workflow_rules')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Toggle workflow rule active state
export async function toggleWorkflowRule(id: string, isActive: boolean): Promise<WorkflowRule> {
  const { data, error } = await supabase
    .from('workflow_rules')
    .update({ is_active: isActive })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as WorkflowRule;
}

// Duplicate workflow rule
export async function duplicateWorkflowRule(id: string): Promise<WorkflowRule> {
  const original = await getWorkflowRule(id);
  
  return createWorkflowRule({
    name: `${original.name} (Cópia)`,
    description: original.description,
    is_active: false,
    trigger_type: original.trigger_type,
    trigger_config: original.trigger_config,
    conditions: original.conditions,
    actions: original.actions,
  });
}

// List workflow executions
export async function listWorkflowExecutions(filters?: {
  workflowRuleId?: string;
  status?: string;
  limit?: number;
}): Promise<WorkflowExecution[]> {
  let query = supabase
    .from('workflow_executions')
    .select('*, workflow_rules(name)')
    .order('created_at', { ascending: false });

  if (filters?.workflowRuleId) {
    query = query.eq('workflow_rule_id', filters.workflowRuleId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as unknown as WorkflowExecution[];
}

// Execute workflow manually
export async function executeWorkflow(executionId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke('execute-workflow', {
    body: { execution_id: executionId },
  });

  if (error) throw error;
  return data;
}

// Process all pending workflows for an opportunity
export async function processPendingWorkflows(opportunityId: string): Promise<void> {
  // Fetch pending executions for this opportunity
  const { data: pendingExecutions, error: fetchError } = await supabase
    .from('workflow_executions')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('status', 'pending');

  if (fetchError) {
    console.error('Error fetching pending workflows:', fetchError);
    return;
  }

  // Execute each pending workflow
  for (const execution of pendingExecutions || []) {
    try {
      await executeWorkflow(execution.id);
      console.log(`Workflow execution ${execution.id} completed`);
    } catch (err) {
      console.error(`Error executing workflow ${execution.id}:`, err);
    }
  }
}

// Test workflow rule (create a test execution)
export async function testWorkflowRule(ruleId: string, opportunityId: string): Promise<WorkflowExecution> {
  const orgId = await supabase.rpc('get_user_organization_id');
  
  const { data: execution, error: insertError } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_rule_id: ruleId,
      organization_id: orgId.data,
      opportunity_id: opportunityId,
      trigger_type: 'stage_enter', // Default for testing
      trigger_data: { test: true },
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) throw insertError;

  // Execute immediately
  await executeWorkflow(execution.id);

  // Fetch updated execution
  const { data: updated, error: fetchError } = await supabase
    .from('workflow_executions')
    .select('*, workflow_rules(name)')
    .eq('id', execution.id)
    .single();

  if (fetchError) throw fetchError;
  return updated as unknown as WorkflowExecution;
}
