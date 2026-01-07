-- ============================================================
-- NOID REVENUE OS - DATABASE DUMP
-- File: 04_tables_crm.sql
-- Generated: 2026-01-07
-- Description: CRM tables - Accounts, Contacts, Pipelines, Opportunities
-- ============================================================

-- ==========================================
-- ACCOUNTS (Empresas/Clientes)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  
  -- Identificação
  tipo_pessoa tipo_pessoa_type NOT NULL DEFAULT 'PJ',
  cnpj text,
  cpf text,
  rg text,
  razao_social text NOT NULL,
  nome_fantasia text,
  
  -- Dados Empresariais
  segmento text,
  cnae text,
  cnaes_secundarios text[],
  tamanho text,
  porte text,
  natureza_juridica text,
  tipo_empresa text,
  capital_social numeric(15,2),
  data_fundacao date,
  data_nascimento date,
  matriz_filial text,
  situacao_cadastral text,
  data_situacao_cadastral date,
  inscricao_estadual text,
  inscricao_municipal text,
  opcao_simples boolean DEFAULT false,
  opcao_mei boolean DEFAULT false,
  
  -- Endereço
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  
  -- Contato
  telefones jsonb DEFAULT '[]'::jsonb,
  emails text[],
  email_nota_fiscal text,
  website text,
  linkedin text,
  instagram text,
  facebook text,
  
  -- Ownership
  owner_user_id uuid,
  cs_user_id uuid,
  parent_account_id uuid REFERENCES public.accounts(id),
  created_by uuid,
  
  -- Scoring
  fit_score integer DEFAULT 0,
  intent_score integer DEFAULT 0,
  lead_score integer DEFAULT 0,
  lead_grade text DEFAULT 'D',
  score_updated_at timestamp with time zone,
  scoring_factors jsonb DEFAULT '{}'::jsonb,
  
  -- Lifecycle
  origem_principal text,
  lifecycle_stage text DEFAULT 'Lead',
  qualified_at timestamp with time zone,
  data_tornou_cliente date,
  pontuacao_nps integer,
  
  -- Misc
  logo_url text,
  codigo_externo text,
  observacoes text,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACCOUNT_PARTNERS (Sócios)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.account_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  nome_socio text NOT NULL,
  cpf_cnpj_socio text,
  qualificacao text,
  data_entrada date,
  faixa_etaria text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.account_partners ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CONTACTS (Contatos)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id uuid REFERENCES public.accounts(id),
  
  -- Info básica
  nome text NOT NULL,
  cargo text,
  departamento text,
  
  -- Contato
  emails text[],
  telefones text[],
  whatsapp text,
  whatsapp_optin boolean DEFAULT false,
  linkedin_url text,
  
  -- Perfil
  decision_role decision_role_type,
  is_champion boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  
  -- Ownership
  owner_user_id uuid,
  
  -- LGPD
  consent_lgpd jsonb,
  
  -- Misc
  notes text,
  avatar_url text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PIPELINES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  pipeline_type text DEFAULT 'sales', -- sales, qualification, onboarding, renewal
  business_unit_ids uuid[],
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  goal_monthly numeric(15,2),
  goal_quarterly numeric(15,2),
  goal_yearly numeric(15,2),
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  color text DEFAULT '#6366f1',
  probability integer DEFAULT 0,
  stagnation_alert_days integer,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  allow_create_opportunity boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.contacts(id),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id),
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  
  -- Info
  title text NOT NULL,
  description text,
  status text DEFAULT 'open', -- open, won, lost
  
  -- Valores
  valor_previsto numeric(15,2),
  valor_fechado numeric(15,2),
  currency text DEFAULT 'BRL',
  
  -- Probabilidade e Temperatura
  prob integer,
  temperature text DEFAULT 'warm', -- cold, warm, hot, burning
  urgency_score integer,
  
  -- Datas
  close_date_prevista date,
  closed_at timestamp with time zone,
  won_at timestamp with time zone,
  lost_at timestamp with time zone,
  last_contact_date timestamp with time zone,
  next_followup_date timestamp with time zone,
  days_since_contact integer,
  
  -- Motivos
  loss_reason_id uuid,
  loss_reason_notes text,
  win_reason_id uuid,
  win_reason_notes text,
  
  -- Ownership
  owner_user_id uuid,
  
  -- Automation
  automation_enabled boolean DEFAULT true,
  
  -- Metadata
  meta jsonb DEFAULT '{}'::jsonb,
  source text,
  campaign text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVITIES (Atividades CRM)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.contacts(id),
  owner_user_id uuid NOT NULL,
  
  -- Info
  title text NOT NULL,
  description text,
  type text NOT NULL, -- call, meeting, email, whatsapp, task, note
  status text DEFAULT 'pending', -- pending, completed, no_show, cancelled
  
  -- Scheduling
  scheduled_date date,
  duration_minutes integer,
  completed_at timestamp with time zone,
  
  -- AI/Automation
  is_automated boolean DEFAULT false,
  ai_generated boolean DEFAULT false,
  sentiment text,
  
  -- Sync
  sync_source text,
  sync_provider text,
  external_id text,
  external_link text,
  sync_metadata jsonb,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ACTIVITY_PARTICIPANTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activity_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  role text DEFAULT 'participant',
  is_confirmed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- INTERACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id uuid REFERENCES public.accounts(id),
  contact_id uuid REFERENCES public.contacts(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  user_id uuid,
  
  -- Type
  channel interaction_channel NOT NULL,
  interaction_type interaction_type_enum NOT NULL,
  direction text, -- inbound, outbound
  
  -- Content
  subject text,
  content text,
  summary text,
  
  -- Metadata
  external_id text,
  external_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Scoring
  engagement_score integer,
  sentiment text,
  
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSALS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  
  -- Info
  proposal_number text,
  title text,
  status text DEFAULT 'draft', -- draft, sent, viewed, accepted, rejected, expired
  version integer DEFAULT 1,
  
  -- Client
  client_name text,
  client_email text,
  client_document text,
  
  -- Content
  introduction text,
  terms text,
  notes text,
  content jsonb,
  
  -- Values
  subtotal numeric(15,2),
  discount_amount numeric(15,2),
  total_amount numeric(15,2),
  currency text DEFAULT 'BRL',
  
  -- Validity
  valid_until date,
  expires_at timestamp with time zone,
  
  -- Tracking
  public_token text UNIQUE,
  views_count integer DEFAULT 0,
  last_viewed_at timestamp with time zone,
  sent_at timestamp with time zone,
  viewed_at timestamp with time zone,
  accepted_at timestamp with time zone,
  declined_at timestamp with time zone,
  declined_reason text,
  
  -- Signature
  signature_status text,
  signed_at timestamp with time zone,
  
  -- PDF
  pdf_url text,
  
  -- Template
  template_id uuid,
  template_name text,
  parent_proposal_id uuid,
  
  -- Owner
  created_by uuid,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSAL_ITEMS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  product_id uuid,
  
  -- Item
  name text NOT NULL,
  description text,
  sku text,
  unit text DEFAULT 'un',
  
  -- Values
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  total numeric(15,2),
  
  -- Recurrence
  recurrence text, -- one_time, monthly, yearly
  
  -- Order
  order_index integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSAL_PAYMENT_TERMS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.proposal_payment_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  installments integer DEFAULT 1,
  interval_days integer DEFAULT 30,
  payment_method text,
  notes text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proposal_payment_terms ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- CONTRACTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  opportunity_id uuid REFERENCES public.opportunities(id),
  proposal_id uuid REFERENCES public.proposals(id),
  account_id uuid REFERENCES public.accounts(id),
  
  -- Info
  contract_number text,
  title text,
  status text DEFAULT 'draft', -- draft, pending, active, expiring, expired, cancelled, renewed
  type text DEFAULT 'monthly', -- monthly, quarterly, annual, one_time
  
  -- Client
  client_name text,
  client_email text,
  client_document text,
  
  -- Values
  value numeric(15,2),
  monthly_value numeric(15,2),
  currency text DEFAULT 'BRL',
  
  -- Dates
  start_date date,
  end_date date,
  signed_at timestamp with time zone,
  renewal_date date,
  auto_renewal boolean DEFAULT false,
  
  -- Payment
  payment_method text,
  
  -- Content
  terms text,
  notes text,
  attachments text[],
  payload jsonb,
  
  -- Owner
  created_by uuid,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TAGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  entity_type text, -- account, contact, opportunity
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, name, entity_type)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITY_TAGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.opportunity_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(opportunity_id, tag_id)
);

ALTER TABLE public.opportunity_tags ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITY_NOTES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.opportunity_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.opportunity_notes ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITY_FILES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.opportunity_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.opportunity_files ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- WIN_REASONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.win_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.win_reasons ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- LOSS_REASONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  category text, -- price, timing, competition, fit, other
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- DEAL_PARTICIPANTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.deal_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  role text DEFAULT 'collaborator', -- owner, collaborator, viewer
  share_percentage numeric(5,2),
  added_at timestamp with time zone DEFAULT now(),
  added_by uuid,
  UNIQUE(opportunity_id, user_id)
);

ALTER TABLE public.deal_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TIMELINE_EVENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entity_type text NOT NULL, -- account, contact, opportunity, proposal
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  occurred_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSAL_TEMPLATES
-- ==========================================
DROP TABLE IF EXISTS public.proposal_templates CASCADE;
CREATE TABLE public.proposal_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  introduction text,
  terms text,
  notes text,
  default_items jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_by uuid,
  layout_id uuid,
  currency varchar(3) DEFAULT 'BRL',
  validity_days integer DEFAULT 15,
  control_prefix varchar(10),
  observations text,
  payment_method_default varchar(50),
  installments_default integer DEFAULT 1,
  entry_percent_default numeric DEFAULT 0,
  discount_percent_default numeric DEFAULT 0,
  entry_days_default integer DEFAULT 0,
  installment_interval_days integer DEFAULT 30,
  due_day_default integer,
  payment_comment text,
  mrr_payment_method varchar(50),
  mrr_first_payment_days integer DEFAULT 30,
  mrr_due_day integer,
  mrr_comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSAL_LAYOUTS
-- ==========================================
DROP TABLE IF EXISTS public.proposal_layouts CASCADE;
CREATE TABLE public.proposal_layouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_default_per_org UNIQUE NULLS NOT DISTINCT (organization_id, is_default)
);

ALTER TABLE public.proposal_layouts ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROPOSAL_LAYOUT_PAGES
-- ==========================================
DROP TABLE IF EXISTS public.proposal_layout_pages CASCADE;
CREATE TABLE public.proposal_layout_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id uuid NOT NULL REFERENCES public.proposal_layouts(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  page_type text DEFAULT 'custom',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT proposal_layout_pages_page_type_check CHECK (page_type = ANY (ARRAY['cover'::text, 'content'::text, 'terms'::text, 'custom'::text])),
  CONSTRAINT unique_page_per_layout UNIQUE (layout_id, page_number)
);

ALTER TABLE public.proposal_layout_pages ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITY_PUBLIC_FORMS
-- ==========================================
DROP TABLE IF EXISTS public.opportunity_public_forms CASCADE;
CREATE TABLE public.opportunity_public_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  public_token text UNIQUE,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT opportunity_public_forms_opportunity_id_form_id_key UNIQUE (opportunity_id, form_id)
);

ALTER TABLE public.opportunity_public_forms ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- OPPORTUNITY_EMAILS
-- ==========================================
DROP TABLE IF EXISTS public.opportunity_emails CASCADE;
CREATE TABLE public.opportunity_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  from_email text NOT NULL,
  to_emails text[] NOT NULL DEFAULT '{}'::text[],
  cc_emails text[] DEFAULT '{}'::text[],
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  opened_at timestamp with time zone,
  opened_count integer DEFAULT 0,
  clicked_at timestamp with time zone,
  link_clicks jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.opportunity_emails ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PUBLIC_FORM_SUBMISSIONS
-- ==========================================
DROP TABLE IF EXISTS public.public_form_submissions CASCADE;
CREATE TABLE public.public_form_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  submitted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitter_ip text,
  submitter_user_agent text,
  public_token text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;
