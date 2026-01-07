-- =============================================
-- NOID DATABASE SCHEMA - COMPLETE DUMP
-- Generated: 2026-01-07
-- =============================================

-- =============================================
-- 1. ENUM TYPES
-- =============================================

CREATE TYPE public.accelerator_tier_type AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'sales', 'cs');
CREATE TYPE public.archetype_level_type AS ENUM ('Entrada', 'Intermediário', 'Avançado', 'Enterprise');
CREATE TYPE public.client_type AS ENUM ('Organizador', 'Expositor', 'Agência', 'Empresa Contratante');
CREATE TYPE public.decision_role_type AS ENUM ('Decisor', 'Influenciador', 'Usuário-Chave');
CREATE TYPE public.graph_edge_type AS ENUM ('works_at', 'owns', 'relates_to', 'influences', 'communicates_with', 'champions', 'blocks', 'participates_in', 'converts_to', 'decision_maker');
CREATE TYPE public.graph_insight_type AS ENUM ('missing_champion', 'missing_decision_maker', 'silent_stakeholder', 'isolated_deal', 'weak_relationship', 'network_gap', 'high_centrality', 'engagement_decay');
CREATE TYPE public.graph_node_type AS ENUM ('account', 'contact', 'opportunity', 'interaction', 'proposal', 'contract', 'user');
CREATE TYPE public.interaction_channel AS ENUM ('email', 'phone', 'whatsapp', 'linkedin', 'meeting', 'form', 'chat', 'website', 'proposal', 'contract', 'other');
CREATE TYPE public.interaction_type_enum AS ENUM ('call_made', 'call_received', 'call_missed', 'email_sent', 'email_received', 'email_opened', 'email_clicked', 'meeting_scheduled', 'meeting_held', 'meeting_canceled', 'meeting_no_show', 'message_sent', 'message_received', 'form_submitted', 'chat_started', 'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected', 'contract_sent', 'contract_signed', 'linkedin_connection', 'linkedin_message', 'website_visit', 'demo_requested', 'note_added', 'task_completed', 'other');
CREATE TYPE public.memory_type AS ENUM ('objection', 'win_pattern', 'loss_pattern', 'churn_signal', 'converting_language', 'countermeasure');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'manager', 'sales', 'viewer', 'cs', 'finance', 'operations');
CREATE TYPE public.platform_admin_role AS ENUM ('super_admin', 'admin', 'support');
CREATE TYPE public.roleplay_sender_type AS ENUM ('seller', 'ai_client');
CREATE TYPE public.seller_role_type AS ENUM ('Closer', 'SDR', 'Farmer', 'CS', 'BDR', 'AE', 'AM', 'Hunter');
CREATE TYPE public.tipo_pessoa_type AS ENUM ('PJ', 'PF');
CREATE TYPE public.tone_style_type AS ENUM ('técnico', 'apressado', 'cético', 'indeciso', 'agressivo', 'metódico');
CREATE TYPE public.video_level_type AS ENUM ('Básico', 'Intermediário', 'Avançado');
CREATE TYPE public.video_source_type AS ENUM ('Interno', 'YouTube', 'Vimeo', 'Loom');
CREATE TYPE public.workflow_action_type AS ENUM ('move_stage', 'move_pipeline', 'duplicate', 'close_won', 'close_lost', 'create_activity', 'update_fields', 'notify_user', 'send_email');
CREATE TYPE public.workflow_trigger_type AS ENUM ('stage_enter', 'stage_exit', 'opportunity_won', 'opportunity_lost', 'activity_completed', 'opportunity_created', 'field_changed', 'proposal_viewed');

-- =============================================
-- 2. TABLES
-- =============================================

-- organizations (core table - must be created first)
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status text DEFAULT 'trial',
  slug text,
  logo_url text,
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  current_plan_id text,
  max_users integer DEFAULT 5,
  active_seats integer DEFAULT 0,
  proposal_sequence integer DEFAULT 0,
  proposal_prefix text DEFAULT 'PROP',
  calculated_mrr numeric(12,2) DEFAULT 0,
  calculated_arr numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email text,
  full_name text,
  avatar_url text,
  organization_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- organization_members
CREATE TABLE public.organization_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  org_role org_role DEFAULT 'sales',
  role text DEFAULT 'sales',
  status text DEFAULT 'active',
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- teams
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  manager_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- team_members
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

-- accounts
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  tipo_pessoa tipo_pessoa_type DEFAULT 'PJ',
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  cpf text,
  rg text,
  inscricao_estadual text,
  inscricao_municipal text,
  emails text[],
  telefones jsonb,
  website text,
  linkedin text,
  instagram text,
  facebook text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  latitude numeric,
  longitude numeric,
  cnae text,
  cnaes_secundarios text[],
  natureza_juridica text,
  capital_social numeric,
  porte text,
  matriz_filial text,
  situacao_cadastral text,
  data_situacao_cadastral text,
  data_fundacao text,
  data_nascimento text,
  tipo_empresa text,
  opcao_simples boolean,
  opcao_mei boolean,
  observacoes text,
  logo_url text,
  segmento text,
  tamanho text,
  lifecycle_stage text DEFAULT 'lead',
  origem_principal text,
  owner_user_id uuid,
  cs_user_id uuid,
  parent_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  created_by uuid,
  codigo_externo text,
  email_nota_fiscal text,
  lead_score integer,
  lead_grade text,
  fit_score integer,
  intent_score integer,
  scoring_factors jsonb,
  score_updated_at timestamptz,
  qualified_at timestamptz,
  data_tornou_cliente timestamptz,
  pontuacao_nps integer,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- contacts
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cargo text,
  departamento text,
  emails text[],
  telefones jsonb,
  linkedin text,
  twitter text,
  data_nascimento date,
  genero text,
  idioma_preferido text,
  notas text,
  is_decision_maker boolean DEFAULT false,
  decision_role decision_role_type,
  lead_score integer,
  avatar_url text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- pipelines
CREATE TABLE public.pipelines (
  id text NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  pipeline_type text DEFAULT 'sales',
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  goal_value numeric,
  goal_deals integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- stages
CREATE TABLE public.stages (
  id text NOT NULL PRIMARY KEY,
  pipeline_id text NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  order_index integer DEFAULT 0,
  probability integer DEFAULT 0,
  color text,
  sla_days integer,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  auto_tasks jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- opportunities
CREATE TABLE public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  pipeline_id text NOT NULL REFERENCES pipelines(id),
  stage_id text NOT NULL REFERENCES stages(id),
  owner_user_id uuid,
  title text NOT NULL,
  status text DEFAULT 'open',
  temperature text DEFAULT 'warm',
  valor_previsto numeric,
  valor_ganho numeric,
  moeda text DEFAULT 'BRL',
  expected_close_date date,
  closed_at timestamptz,
  loss_reason_id uuid,
  loss_notes text,
  origin_id uuid,
  business_unit_id uuid,
  opportunity_score integer,
  win_probability_ai numeric,
  nrhs_tier text,
  nrhs_issues_count integer DEFAULT 0,
  last_contact_at timestamptz,
  last_activity_at timestamptz,
  stage_entered_at timestamptz DEFAULT now(),
  days_in_stage integer DEFAULT 0,
  total_cycle_days integer DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- activities
CREATE TABLE public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  scheduled_date timestamptz,
  completed_at timestamptz,
  duration_minutes integer,
  sentiment text,
  is_automated boolean DEFAULT false,
  ai_generated boolean DEFAULT false,
  external_id text,
  external_link text,
  sync_source text,
  sync_provider text,
  sync_metadata jsonb,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- proposals
CREATE TABLE public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  layout_id uuid,
  title text,
  proposal_number text,
  proposal_version integer DEFAULT 1,
  parent_proposal_id uuid REFERENCES proposals(id),
  client_name text,
  client_email text,
  introduction text,
  terms text,
  notes text,
  value numeric,
  total_amount numeric,
  currency text DEFAULT 'BRL',
  status text DEFAULT 'draft',
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  acceptor_name text,
  acceptor_ip text,
  public_token text UNIQUE,
  views_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- contracts
CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  opportunity_id uuid REFERENCES opportunities(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  contact_id uuid REFERENCES contacts(id),
  owner_user_id uuid NOT NULL,
  title text NOT NULL,
  contract_value numeric,
  status text DEFAULT 'draft',
  start_date date,
  end_date date,
  payment_terms text,
  terms_and_conditions text,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- products
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  category_id uuid,
  name text NOT NULL,
  code text,
  description text,
  unit_price numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  billing_type text DEFAULT 'one_time',
  billing_period text,
  currency text DEFAULT 'BRL',
  active boolean DEFAULT true,
  tracks_commission boolean DEFAULT false,
  commission_percent numeric,
  commission_value numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- product_categories
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- proposal_items
CREATE TABLE public.proposal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  product_id uuid REFERENCES products(id),
  name text NOT NULL,
  description text,
  quantity numeric DEFAULT 1,
  unit_cost numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  total numeric DEFAULT 0,
  order_index integer DEFAULT 0,
  billing_type text,
  billing_period text,
  tracks_commission boolean DEFAULT false,
  commission_percent numeric,
  commission_value numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- sellers
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  role seller_role_type DEFAULT 'Closer',
  name text,
  xp_total integer DEFAULT 0,
  current_level integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- roleplay_sessions
CREATE TABLE public.roleplay_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  seller_id uuid NOT NULL REFERENCES sellers(id),
  icp_id uuid,
  archetype_id uuid,
  rubric_id uuid,
  simulated_client_id uuid,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  exchanges_count integer DEFAULT 0,
  score_overall numeric,
  score_dimensions jsonb,
  feedback text,
  passed boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- roleplay_messages
CREATE TABLE public.roleplay_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  sender_type roleplay_sender_type NOT NULL,
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- icp_profiles
CREATE TABLE public.icp_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  segment text NOT NULL,
  company_size text,
  revenue_band text,
  tech_maturity integer,
  pain_points text[] DEFAULT '{}',
  buying_triggers text[],
  success_criteria text[],
  competing_alternatives text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- client_archetypes
CREATE TABLE public.client_archetypes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  level archetype_level_type DEFAULT 'Intermediário',
  tone tone_style_type DEFAULT 'técnico',
  persona_description text,
  common_objections text[],
  success_behaviors text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- evaluation_rubrics
CREATE TABLE public.evaluation_rubrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  passing_score numeric DEFAULT 7.0,
  dimensions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- simulated_clients
CREATE TABLE public.simulated_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  icp_id uuid REFERENCES icp_profiles(id),
  archetype_id uuid REFERENCES client_archetypes(id),
  fake_name text NOT NULL,
  fake_company text NOT NULL,
  fake_role text,
  scenario_context text,
  system_prompt text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- audit_log
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- security_audit_log
CREATE TABLE public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  organization_id uuid REFERENCES organizations(id),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  severity text DEFAULT 'info',
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- entity_snapshots (for soft delete/backup)
CREATE TABLE public.entity_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  snapshot_data jsonb NOT NULL,
  snapshot_reason text,
  created_by uuid,
  expires_at timestamptz DEFAULT (now() + interval '90 days'),
  restored_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- interactions
CREATE TABLE public.interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id),
  contact_id uuid REFERENCES contacts(id),
  opportunity_id uuid REFERENCES opportunities(id),
  activity_id uuid REFERENCES activities(id),
  actor_user_id uuid,
  actor_type text DEFAULT 'user',
  channel interaction_channel NOT NULL,
  direction text DEFAULT 'outbound',
  interaction_type interaction_type_enum NOT NULL,
  subject text,
  content text,
  summary text,
  duration_seconds integer,
  sentiment text,
  sentiment_score numeric,
  occurred_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- workflow_rules
CREATE TABLE public.workflow_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  description text,
  trigger_type workflow_trigger_type NOT NULL,
  trigger_config jsonb DEFAULT '{}',
  conditions jsonb DEFAULT '[]',
  actions jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  execution_count integer DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- workflow_executions
CREATE TABLE public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  workflow_rule_id uuid NOT NULL REFERENCES workflow_rules(id),
  opportunity_id uuid REFERENCES opportunities(id),
  trace_id uuid DEFAULT gen_random_uuid(),
  trigger_type text,
  trigger_data jsonb,
  actions_executed jsonb DEFAULT '[]',
  status text DEFAULT 'pending',
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- settings
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  section text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, section, key)
);

-- origins
CREATE TABLE public.origins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  group_id uuid,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- origin_groups
CREATE TABLE public.origin_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loss_reasons
CREATE TABLE public.loss_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  pipeline_ids text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- business_units
CREATE TABLE public.business_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- custom_fields
CREATE TABLE public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  group_id uuid,
  entity_type text NOT NULL,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL,
  options jsonb,
  is_required boolean DEFAULT false,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- custom_field_values
CREATE TABLE public.custom_field_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- timeline_events
CREATE TABLE public.timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id),
  contact_id uuid REFERENCES contacts(id),
  opportunity_id uuid REFERENCES opportunities(id),
  type text NOT NULL,
  activity_type text,
  title text NOT NULL,
  actor_user_id uuid,
  metadata jsonb DEFAULT '{}',
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- revenue_events
CREATE TABLE public.revenue_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid REFERENCES accounts(id),
  contact_id uuid REFERENCES contacts(id),
  opportunity_id uuid REFERENCES opportunities(id),
  user_id uuid,
  channel text,
  event_type text NOT NULL,
  event_subtype text,
  payload jsonb DEFAULT '{}',
  revenue_impact numeric,
  engagement_value integer DEFAULT 0,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

-- memories (AI memory)
CREATE TABLE public.memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  memory_type memory_type NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  keywords text[] DEFAULT '{}',
  source_type text,
  source_metadata jsonb,
  industry text,
  stage text,
  pipeline_id text,
  confidence_score numeric DEFAULT 0.5,
  success_rate numeric,
  usage_count integer DEFAULT 0,
  status text DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ai_scores
CREATE TABLE public.ai_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  score_type text NOT NULL,
  score numeric NOT NULL,
  grade text,
  confidence numeric,
  status text,
  explanation text,
  factors jsonb,
  reasons jsonb,
  recommendations jsonb,
  next_actions jsonb,
  model_version text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ai_suggestions
CREATE TABLE public.ai_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  suggestion_type text NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  metadata jsonb DEFAULT '{}',
  accepted_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- platform_admins
CREATE TABLE public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  role platform_admin_role DEFAULT 'admin',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- plans
CREATE TABLE public.plans (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_month_cents integer DEFAULT 0,
  price_year_cents integer DEFAULT 0,
  max_users integer,
  max_opportunities integer,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- backup_history
CREATE TABLE public.backup_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  backup_type text DEFAULT 'manual',
  status text DEFAULT 'pending',
  entities_count jsonb,
  file_url text,
  file_size bigint,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- attendance
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES sellers(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  date date NOT NULL,
  present boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, date)
);

-- badges
CREATE TABLE public.badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'award',
  tier text DEFAULT 'bronze',
  category text,
  xp_reward integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- seller_badges
CREATE TABLE public.seller_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  session_id uuid REFERENCES roleplay_sessions(id),
  earned_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, badge_id, session_id)
);

-- achievements
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  icon text DEFAULT 'trophy',
  target_value integer NOT NULL,
  xp_reward integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- seller_achievements
CREATE TABLE public.seller_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  current_value integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, achievement_id)
);

-- missions
CREATE TABLE public.missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  description text,
  mission_type text DEFAULT 'daily',
  target_activity text,
  target_value integer DEFAULT 1,
  xp_reward integer DEFAULT 10,
  is_active boolean DEFAULT true,
  valid_from date,
  valid_until date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- seller_missions
CREATE TABLE public.seller_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  current_value integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- video_library
CREATE TABLE public.video_library (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  title text NOT NULL,
  url text NOT NULL,
  duration_sec integer DEFAULT 0,
  level video_level_type DEFAULT 'Básico',
  source video_source_type DEFAULT 'YouTube',
  tags text[],
  language text DEFAULT 'pt-BR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- video_recommendations
CREATE TABLE public.video_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES video_library(id) ON DELETE CASCADE,
  relevance_score numeric DEFAULT 0.5,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- performance_insights
CREATE TABLE public.performance_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES roleplay_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  dimension text NOT NULL,
  score numeric NOT NULL,
  feedback text,
  suggestions text[],
  created_at timestamptz DEFAULT now()
);

-- graph_nodes (knowledge graph)
CREATE TABLE public.graph_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  node_type graph_node_type NOT NULL,
  entity_id uuid NOT NULL,
  label text NOT NULL,
  properties jsonb DEFAULT '{}',
  connectivity_score integer DEFAULT 0,
  activity_score numeric DEFAULT 0,
  last_build_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, node_type, entity_id)
);

-- graph_edges
CREATE TABLE public.graph_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  source_node_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_type graph_edge_type NOT NULL,
  weight numeric DEFAULT 1.0,
  strength text DEFAULT 'medium',
  is_bidirectional boolean DEFAULT false,
  interaction_count integer DEFAULT 0,
  last_interaction_at timestamptz,
  sentiment_score numeric,
  recency_score numeric,
  frequency_score numeric,
  properties jsonb DEFAULT '{}',
  last_build_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, source_node_id, target_node_id, edge_type)
);

-- graph_insights
CREATE TABLE public.graph_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  insight_type graph_insight_type NOT NULL,
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'info',
  confidence numeric DEFAULT 0.5,
  metadata jsonb DEFAULT '{}',
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- graph_builds
CREATE TABLE public.graph_builds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  build_type text DEFAULT 'full',
  status text DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  nodes_created integer DEFAULT 0,
  nodes_updated integer DEFAULT 0,
  edges_created integer DEFAULT 0,
  edges_updated integer DEFAULT 0,
  duration_ms integer,
  error_message text,
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 3. INDEXES (most important ones)
-- =============================================

CREATE INDEX idx_accounts_org ON accounts(organization_id);
CREATE INDEX idx_accounts_owner ON accounts(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_accounts_lead_score ON accounts(organization_id, lead_score DESC);
CREATE INDEX idx_accounts_lifecycle ON accounts(organization_id, lifecycle_stage);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_account ON contacts(account_id);

CREATE INDEX idx_opportunities_org ON opportunities(organization_id);
CREATE INDEX idx_opportunities_pipeline ON opportunities(pipeline_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_account ON opportunities(account_id);

CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_opportunity ON activities(opportunity_id);
CREATE INDEX idx_activities_owner ON activities(owner_user_id);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_scheduled ON activities(scheduled_date, status) WHERE status = 'pending';

CREATE INDEX idx_proposals_org ON proposals(organization_id);
CREATE INDEX idx_proposals_opportunity ON proposals(opportunity_id);
CREATE INDEX idx_proposals_status ON proposals(status);

CREATE INDEX idx_roleplay_sessions_seller ON roleplay_sessions(seller_id);
CREATE INDEX idx_roleplay_sessions_org ON roleplay_sessions(organization_id);
CREATE INDEX idx_roleplay_messages_session ON roleplay_messages(session_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE INDEX idx_interactions_org ON interactions(organization_id);
CREATE INDEX idx_interactions_account ON interactions(account_id);
CREATE INDEX idx_interactions_opportunity ON interactions(opportunity_id);

CREATE INDEX idx_timeline_events_org ON timeline_events(organization_id);
CREATE INDEX idx_timeline_events_opportunity ON timeline_events(opportunity_id);
CREATE INDEX idx_timeline_events_account ON timeline_events(account_id);

CREATE INDEX idx_entity_snapshots_org ON entity_snapshots(organization_id);
CREATE INDEX idx_entity_snapshots_entity ON entity_snapshots(entity_type, entity_id);

-- =============================================
-- 4. FOREIGN KEYS (additional references)
-- =============================================

ALTER TABLE origins ADD CONSTRAINT origins_group_id_fkey 
  FOREIGN KEY (group_id) REFERENCES origin_groups(id) ON DELETE SET NULL;

ALTER TABLE opportunities ADD CONSTRAINT opportunities_loss_reason_id_fkey 
  FOREIGN KEY (loss_reason_id) REFERENCES loss_reasons(id) ON DELETE SET NULL;

ALTER TABLE opportunities ADD CONSTRAINT opportunities_origin_id_fkey 
  FOREIGN KEY (origin_id) REFERENCES origins(id) ON DELETE SET NULL;

ALTER TABLE opportunities ADD CONSTRAINT opportunities_business_unit_id_fkey 
  FOREIGN KEY (business_unit_id) REFERENCES business_units(id) ON DELETE SET NULL;

ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;

ALTER TABLE proposals ADD CONSTRAINT proposals_layout_id_fkey 
  FOREIGN KEY (layout_id) REFERENCES proposal_layouts(id) ON DELETE SET NULL;

ALTER TABLE simulated_clients ADD CONSTRAINT simulated_clients_icp_id_fkey 
  FOREIGN KEY (icp_id) REFERENCES icp_profiles(id) ON DELETE SET NULL;

ALTER TABLE simulated_clients ADD CONSTRAINT simulated_clients_archetype_id_fkey 
  FOREIGN KEY (archetype_id) REFERENCES client_archetypes(id) ON DELETE SET NULL;

ALTER TABLE roleplay_sessions ADD CONSTRAINT roleplay_sessions_icp_id_fkey 
  FOREIGN KEY (icp_id) REFERENCES icp_profiles(id) ON DELETE SET NULL;

ALTER TABLE roleplay_sessions ADD CONSTRAINT roleplay_sessions_archetype_id_fkey 
  FOREIGN KEY (archetype_id) REFERENCES client_archetypes(id) ON DELETE SET NULL;

ALTER TABLE roleplay_sessions ADD CONSTRAINT roleplay_sessions_rubric_id_fkey 
  FOREIGN KEY (rubric_id) REFERENCES evaluation_rubrics(id) ON DELETE SET NULL;

ALTER TABLE roleplay_sessions ADD CONSTRAINT roleplay_sessions_simulated_client_id_fkey 
  FOREIGN KEY (simulated_client_id) REFERENCES simulated_clients(id) ON DELETE SET NULL;

-- =============================================
-- 5. ROW LEVEL SECURITY (Enable RLS on all tables)
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roleplay_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE icp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_archetypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulated_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE origin_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_builds ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. HELPER FUNCTIONS (essential ones)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
    AND status = 'active' 
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'finance', 'operations', 'cs')
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- =============================================
-- 7. BASIC RLS POLICIES (template - customize as needed)
-- =============================================

-- Example policies for accounts table
CREATE POLICY "Users view org accounts" ON accounts
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users insert accounts in own org" ON accounts
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Users update accounts in own org" ON accounts
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins delete accounts in own org" ON accounts
  FOR DELETE USING (organization_id = get_user_organization_id() AND can_view_all(auth.uid()));

-- Repeat similar patterns for other tables...

-- =============================================
-- END OF SCHEMA
-- =============================================
