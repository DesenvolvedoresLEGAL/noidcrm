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
  published_by: string | null;
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
