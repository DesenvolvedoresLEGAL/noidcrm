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
  created_at?: string;
  updated_at?: string;
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
  created_at?: string;
  updated_at?: string;
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
