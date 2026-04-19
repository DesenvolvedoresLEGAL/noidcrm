export type AgentStatus = 'draft' | 'test' | 'production' | 'paused';

export type AutonomyLevel = 'observer' | 'recommender' | 'assisted' | 'autonomous' | 'multi_agent';

export type AgentScope =
  | 'lead' | 'contact' | 'account' | 'opportunity' | 'proposal'
  | 'activity' | 'pipeline' | 'forecast' | 'playbook' | 'external_signal';

export type AgentSuggestedType = 'reactive' | 'proactive' | 'hybrid' | 'utility';

export interface AIAgent {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: AgentStatus;
  autonomy_level: AutonomyLevel;
  agent_scope: AgentScope[];
  primary_channel: string | null;
  objective: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAgentVersion {
  id: string;
  agent_id: string;
  organization_id: string;
  version_number: number;
  config_json: Record<string, unknown>;
  prompt_system: string | null;
  prompt_deliberation: string | null;
  prompt_generation: string | null;
  prompt_review: string | null;
  is_active: boolean;
  is_published: boolean;
  published_at: string | null;
  published_by: string | null;
  environment: string;
  change_summary: string | null;
  created_at: string;
}

export interface AIAgentAudit {
  id: string;
  organization_id: string;
  agent_id: string;
  actor_id: string | null;
  action_type: string;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface AgentBlueprint {
  name: string;
  objective: string;
  description: string;
  suggested_type?: AgentSuggestedType;
  autonomy_level: AutonomyLevel;
  primary_channel?: string | null;
  agent_scope: AgentScope[];
  prompts: {
    system?: string;
    deliberation?: string;
    generation?: string;
    review?: string;
  };
  suggested_triggers?: Array<{ event: string; condition?: string; description: string }>;
  suggested_tools?: string[];
  suggested_rules?: Array<{ rule: string; priority?: string }>;
  escalation_criteria?: string[];
  warnings?: string[];
  missing_info?: string[];
  source_type: 'conversation' | 'prompt_import' | 'manual';
  source_text: string;
}

export interface CreateAgentPayload {
  name: string;
  description?: string;
  objective?: string;
  autonomy_level?: AutonomyLevel;
  agent_scope?: AgentScope[];
  primary_channel?: string;
}

export interface CreateAgentFromBlueprintPayload extends CreateAgentPayload {
  prompt_system?: string;
  prompt_deliberation?: string;
  prompt_generation?: string;
  prompt_review?: string;
  source_type?: 'conversation' | 'prompt_import' | 'manual';
  source_text?: string;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string | null;
  objective?: string | null;
  status?: AgentStatus;
  autonomy_level?: AutonomyLevel;
  agent_scope?: AgentScope[];
  primary_channel?: string | null;
  is_active?: boolean;
  environment?: AgentEnvironment;
  is_paused?: boolean;
}

// === Builder Types ===

export type AgentBuilderSection = 'overview' | 'triggers' | 'tools' | 'memory' | 'rules' | 'prompts' | 'escalation';

export type TriggerKind = 'event' | 'schedule' | 'condition' | 'hybrid';

export type ToolExecutionMode = 'allowed' | 'approval_required' | 'blocked';

export type BuilderStatus = 'incomplete' | 'draft_ready' | 'review_required' | 'publish_ready';

export interface AIAgentTrigger {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  trigger_kind: TriggerKind;
  trigger_name: string;
  entity_type?: string | null;
  event_name?: string | null;
  schedule_cron?: string | null;
  condition_json?: Record<string, unknown>;
  priority?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AIToolRegistry {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  entity_scope: string[];
  action_type: string;
  input_schema_json: Record<string, unknown>;
  output_schema_json: Record<string, unknown>;
  risk_level: string;
  requires_approval_by_default: boolean;
  supports_autonomous: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AIAgentTool {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  tool_id: string;
  is_enabled: boolean;
  execution_mode: ToolExecutionMode;
  config_json?: Record<string, unknown>;
  guardrails_json?: Record<string, unknown>;
  ai_tools_registry?: AIToolRegistry;
  created_at?: string;
  updated_at?: string;
}

export interface AIAgentMemoryProfile {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  short_term_enabled: boolean;
  operational_memory_enabled: boolean;
  learning_memory_enabled: boolean;
  short_term_window: number;
  context_sources_json: string[];
  retention_policy_json: Record<string, unknown>;
  recent_interactions_enabled?: boolean;
  recent_interactions_lookback_hours?: number;
  created_at?: string;
  updated_at?: string;
}

// === Sprint 1.5/1.6 — Granular Decision Policy ===
export interface AutoSendRules {
  confidence_min?: number;       // 0..1
  deal_value_max?: number | null;
  risk_max?: 'low' | 'medium' | 'high' | 'critical';
}
export interface RequireApprovalRules {
  deal_value_min?: number | null;
  risk_min?: 'low' | 'medium' | 'high' | 'critical';
  vip_account?: boolean;
}
export interface BlockRules {
  last_contact_hours_min?: number | null;
  max_emails_in_window?: number | null;
  window_days?: number | null;
}

export interface AIAgentRuleset {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  rules_json: Array<{ rule: string; priority?: string }>;
  business_constraints_json: Record<string, unknown>;
  risk_controls_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AIAgentPromptLayer {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  system_prompt: string | null;
  role_prompt: string | null;
  context_builder_prompt: string | null;
  deliberation_prompt: string | null;
  generation_prompt: string | null;
  review_prompt: string | null;
  output_contract_json: Record<string, unknown>;
  style_rules_json: Array<Record<string, unknown>>;
  forbidden_patterns_json: Array<Record<string, unknown>>;
  created_at?: string;
  updated_at?: string;
}

export interface AIAgentEscalationPolicy {
  id?: string;
  organization_id?: string;
  agent_id?: string;
  agent_version_id?: string;
  escalation_mode: 'never' | 'always' | 'conditional';
  confidence_threshold: number | null;
  risk_threshold: string | null;
  escalation_targets_json: Array<Record<string, unknown>>;
  approval_rules_json: Array<Record<string, unknown>>;
  fallback_actions_json: Array<Record<string, unknown>>;
  auto_send_rules?: AutoSendRules;
  require_approval_rules?: RequireApprovalRules;
  block_rules?: BlockRules;
  created_at?: string;
  updated_at?: string;
}

export interface AgentRunOutcome {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_version_id: string;
  run_id: string;
  email_message_id: string | null;
  opportunity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  email_sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  deal_progressed_at: string | null;
  deal_won_at: string | null;
  deal_lost_at: string | null;
  attribution_window_days: number;
  attribution_closes_at: string | null;
  computed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentBuilderConfig {
  agent: AIAgent;
  version: AIAgentVersion & { builder_status?: BuilderStatus; config_summary_json?: Record<string, unknown>; validation_json?: Record<string, unknown> };
  triggers: AIAgentTrigger[];
  tools: AIAgentTool[];
  memory: AIAgentMemoryProfile | null;
  rulesets: AIAgentRuleset | null;
  prompts: AIAgentPromptLayer | null;
  escalation: AIAgentEscalationPolicy | null;
}

export const BUILDER_STATUS_LABELS: Record<BuilderStatus, string> = {
  incomplete: 'Incompleto',
  draft_ready: 'Draft Pronto',
  review_required: 'Revisão Necessária',
  publish_ready: 'Pronto para Publicar',
};

export const BUILDER_STATUS_COLORS: Record<BuilderStatus, string> = {
  incomplete: 'bg-muted text-muted-foreground',
  draft_ready: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  review_required: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  publish_ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export const TRIGGER_KIND_LABELS: Record<TriggerKind, string> = {
  event: 'Evento',
  schedule: 'Agendamento',
  condition: 'Condição',
  hybrid: 'Híbrido',
};

export const TOOL_EXECUTION_MODE_LABELS: Record<ToolExecutionMode, string> = {
  allowed: 'Permitido',
  approval_required: 'Requer Aprovação',
  blocked: 'Bloqueado',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

export const RISK_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export type AgentEnvironment = 'draft' | 'test' | 'production' | 'paused';

export const ENVIRONMENT_LABELS: Record<AgentEnvironment, string> = {
  draft: 'Draft',
  test: 'Teste',
  production: 'Produção',
  paused: 'Pausado',
};

export const ENVIRONMENT_COLORS: Record<AgentEnvironment, string> = {
  draft: 'bg-muted text-muted-foreground',
  test: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  production: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export interface AIAgentPermission {
  id: string;
  organization_id: string;
  user_id: string;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_execute: boolean;
  can_run_autonomous: boolean;
  can_approve: boolean;
  created_at: string;
}

export interface AIAgentEnvironmentConfig {
  id: string;
  organization_id: string;
  environment: AgentEnvironment;
  allow_execution: boolean;
  require_approval: boolean;
  allow_autonomous: boolean;
  max_actions_per_hour: number;
  created_at: string;
}

export interface AIAgentPublishHistory {
  id: string;
  organization_id: string;
  agent_id: string;
  version_id: string;
  published_by: string | null;
  previous_version_id: string | null;
  environment: string;
  created_at: string;
}

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  draft: 'Rascunho',
  test: 'Teste',
  production: 'Produção',
  paused: 'Pausado',
};

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  observer: 'Observador',
  recommender: 'Recomendador',
  assisted: 'Assistido',
  autonomous: 'Autônomo',
  multi_agent: 'Multi-Agente',
};

export const AGENT_SCOPE_LABELS: Record<AgentScope, string> = {
  lead: 'Lead',
  contact: 'Contato',
  account: 'Conta',
  opportunity: 'Oportunidade',
  proposal: 'Proposta',
  activity: 'Atividade',
  pipeline: 'Pipeline',
  forecast: 'Forecast',
  playbook: 'Playbook',
  external_signal: 'Sinal Externo',
};

export const AGENT_TYPE_LABELS: Record<AgentSuggestedType, string> = {
  reactive: 'Reativo',
  proactive: 'Proativo',
  hybrid: 'Híbrido',
  utility: 'Utilitário',
};

// === Simulator Types ===

export type SimulationExecutionMode = 'preview_only' | 'dry_run' | 'guarded_test';
export type SimulationRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ValidationOverallStatus = 'passed' | 'review_required' | 'blocked';

export const SIMULATION_MODE_LABELS: Record<SimulationExecutionMode, string> = {
  preview_only: 'Preview Only',
  dry_run: 'Dry Run',
  guarded_test: 'Guarded Test',
};

export const VALIDATION_STATUS_LABELS: Record<ValidationOverallStatus, string> = {
  passed: 'Aprovado',
  review_required: 'Revisão Necessária',
  blocked: 'Bloqueado',
};

export const VALIDATION_STATUS_COLORS: Record<ValidationOverallStatus, string> = {
  passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  review_required: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// === Execution Types (Sprint 1.3) ===

export type ExecutionRunStatus = 'queued' | 'running' | 'awaiting_approval' | 'approved' | 'executed' | 'skipped' | 'blocked' | 'failed' | 'cancelled';
export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';
export type EmailSendStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'failed' | 'cancelled';
export type DeliveryStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';
export type ImpactType = 'timeline_logged' | 'email_sent' | 'email_opened' | 'email_replied' | 'activity_completed' | 'opportunity_advanced' | 'opportunity_reactivated' | 'deal_influenced';
export type ApprovalQueueStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AIAgentExecutionRun {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_version_id: string;
  trigger_id: string | null;
  entity_type: string;
  entity_id: string;
  scenario_label: string | null;
  execution_mode: string;
  execution_status: ExecutionRunStatus;
  approval_status: ApprovalStatus;
  decision_json: Record<string, unknown>;
  context_snapshot_json: Record<string, unknown>;
  tool_plan_json: Array<Record<string, unknown>>;
  output_preview_json: Record<string, unknown>;
  final_output_json: Record<string, unknown>;
  validation_result_json: Record<string, unknown>;
  total_tokens: number | null;
  estimated_cost: number | null;
  execution_time_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AIAgentExecutionAction {
  id: string;
  organization_id: string;
  run_id: string;
  agent_id: string;
  agent_version_id: string;
  tool_key: string;
  action_type: string;
  action_status: string;
  payload_json: Record<string, unknown>;
  result_json: Record<string, unknown>;
  provider_reference: string | null;
  requires_approval: boolean;
  created_at: string;
}

export interface AIEmailMessage {
  id: string;
  organization_id: string;
  run_id: string;
  action_id: string | null;
  opportunity_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  preview_text: string | null;
  body_text: string | null;
  body_html: string | null;
  cta_text: string | null;
  email_purpose: string | null;
  send_status: EmailSendStatus;
  delivery_status: DeliveryStatus;
  gmail_message_id: string | null;
  smtp_message_id: string | null;
  sent_at: string | null;
  was_human_edited: boolean;
  created_at: string;
}

export interface AIAgentApprovalItem {
  id: string;
  organization_id: string;
  run_id: string;
  action_id: string | null;
  agent_id: string;
  agent_version_id: string;
  entity_type: string;
  entity_id: string;
  approval_type: string;
  status: ApprovalQueueStatus;
  requested_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  approval_reason: string | null;
  rejection_reason: string | null;
  requested_at: string;
  decided_at: string | null;
  created_at: string;
}

export interface AIAgentImpactEvent {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_version_id: string;
  run_id: string;
  opportunity_id: string | null;
  impact_type: ImpactType;
  impact_value_json: Record<string, unknown>;
  observed_at: string;
  created_at: string;
}

export const EXECUTION_STATUS_LABELS: Record<ExecutionRunStatus, string> = {
  queued: 'Na fila',
  running: 'Executando',
  awaiting_approval: 'Aguardando aprovação',
  approved: 'Aprovado',
  executed: 'Executado',
  skipped: 'Ignorado',
  blocked: 'Bloqueado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

export const EXECUTION_STATUS_COLORS: Record<ExecutionRunStatus, string> = {
  queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  running: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  awaiting_approval: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  executed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  skipped: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-500',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  queued: 'Na fila',
  sent: 'Enviado',
  delivered: 'Entregue',
  opened: 'Aberto',
  replied: 'Respondido',
  bounced: 'Bounce',
  failed: 'Falhou',
};

// === Sprint 1.4 — Cadence, Cooldown, Metrics Types ===

export type CadenceProgressStatus = 'active' | 'paused' | 'completed' | 'stopped' | 'exhausted';
export type EmailPurpose = 'follow_up_proposal' | 'proposal_recall' | 'authority' | 'nurture' | 'objection_break' | 'urgency' | 'next_step_confirmation' | 'post_meeting_recap' | 'reactivation' | 'win_back' | 'risk_reduction' | 'roi_reinforcement' | 'social_proof' | 'final_attempt';
export type OutcomeType = 'email_generated' | 'email_sent' | 'email_opened' | 'email_replied' | 'email_bounced' | 'approval_required' | 'approval_rejected' | 'cooldown_blocked' | 'policy_blocked' | 'cadence_advanced' | 'cadence_stopped' | 'opportunity_advanced' | 'opportunity_reactivated' | 'deal_influenced';

export const EMAIL_PURPOSE_LABELS: Record<EmailPurpose, string> = {
  follow_up_proposal: 'Follow-up Proposta',
  proposal_recall: 'Retomada de Proposta',
  authority: 'Autoridade',
  nurture: 'Nutrição',
  objection_break: 'Quebra de Objeção',
  urgency: 'Urgência',
  next_step_confirmation: 'Confirmação Próximo Passo',
  post_meeting_recap: 'Recap Pós-Reunião',
  reactivation: 'Reativação',
  win_back: 'Win Back',
  risk_reduction: 'Redução de Risco',
  roi_reinforcement: 'Reforço de ROI',
  social_proof: 'Prova Social',
  final_attempt: 'Tentativa Final',
};

export const OUTCOME_TYPE_LABELS: Record<OutcomeType, string> = {
  email_generated: 'Email Gerado',
  email_sent: 'Email Enviado',
  email_opened: 'Email Aberto',
  email_replied: 'Email Respondido',
  email_bounced: 'Bounce',
  approval_required: 'Aprovação Necessária',
  approval_rejected: 'Aprovação Rejeitada',
  cooldown_blocked: 'Bloqueado (Cooldown)',
  policy_blocked: 'Bloqueado (Policy)',
  cadence_advanced: 'Cadência Avançada',
  cadence_stopped: 'Cadência Parada',
  opportunity_advanced: 'Oportunidade Avançou',
  opportunity_reactivated: 'Oportunidade Reativada',
  deal_influenced: 'Deal Influenciado',
};
