// CRM Types - Mirror MySQL schema

export interface Account {
  id: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  segmento?: string;
  cnae?: string;
  tamanho?: string;
  faturamento?: number;
  origem_principal?: string;
  consent_lgpd?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  account_id?: string;
  nome: string;
  cargo?: string;
  emails?: string[];
  telefones?: string[];
  whatsapp_optin?: boolean;
  linkedin_url?: string;
  owner_user_id?: string;
  consent_lgpd?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  account_id?: string;
  contact_id?: string;
  origem?: string;
  fonte?: string;
  status: string;
  intent_score?: number;
  fit_score?: number;
  enrichment_payload?: Record<string, any>;
  dedupe_key?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  bu: ('ALUGUE' | 'HUMANOID')[];
  stages: Stage[];
  created_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  description?: string;
  position: number;
  color?: string;
  probability?: number;
  stagnation_alert_days?: number;
  allow_create_opportunity?: boolean;
  allow_win_opportunity?: boolean;
  allow_lose_opportunity?: boolean;
  created_at: string;
}

export interface Opportunity {
  id: string;
  account_id: string;
  pipeline_id: string;
  stage_id: string;
  produto: 'ALUGUE' | 'HUMANOID';
  valor_previsto?: number;
  prob?: number;
  close_date_prevista?: string;
  meta?: Record<string, any>;
  
  // Automation fields
  temperature?: 'cold' | 'warm' | 'hot' | 'burning';
  urgency_score?: number;
  next_followup_date?: string;
  last_contact_date?: string;
  days_since_contact?: number;
  automation_enabled?: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  type: 'call' | 'meeting' | 'email' | 'whatsapp' | 'task' | 'note';
  status: 'pending' | 'completed' | 'no_show' | 'cancelled';
  
  // Datas e horários
  scheduled_date?: string;
  scheduled_time?: string;
  duration_minutes?: number;
  completed_at?: string;
  
  // Relações
  opportunity_id?: string;
  account_id?: string;
  contact_id?: string;
  assigned_to?: string;
  participants?: string[];
  
  // Automation fields
  is_automated?: boolean;
  ai_generated?: boolean;
  sentiment?: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  
  // Contexto legacy
  channel?: string;
  direction?: string;
  duration_seconds?: number;
  transcript_url?: string;
  resumo?: string;
  next_step?: string;
  
  // Lembretes
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  
  created_at: string;
  updated_at?: string;
}

export interface ActivityListParams {
  filter?: 'overdue' | 'today' | 'this_week' | 'this_month' | 'scheduled';
  status?: 'pending' | 'completed' | 'no_show' | 'cancelled';
  type?: string;
  assigned_to?: string;
  opportunity_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface Proposal {
  id: string;
  opportunity_id?: string;
  status: 'draft' | 'sent' | 'signed';
  pdf_url?: string;
  checksum?: string;
  termos?: Record<string, any>;
  created_at: string;
}

export interface Contract {
  id: string;
  opportunityId: string;
  proposal_id?: string;
  clientName: string;
  clientEmail: string;
  clientDocument: string;
  value: number;
  monthlyValue?: number;
  startDate: string;
  endDate: string;
  signedDate?: string;
  status: 'draft' | 'pending' | 'active' | 'expiring' | 'expired' | 'cancelled' | 'renewed';
  type: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  renewalDate?: string;
  autoRenewal: boolean;
  paymentMethod: 'credit_card' | 'bank_slip' | 'bank_transfer' | 'pix';
  terms?: string;
  notes?: string;
  attachments?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  signed_at?: string;
  created_at: string;
  payload?: Record<string, any>;
}

export interface Sequence {
  id: string;
  name: string;
  audience?: string;
  objective?: string;
  steps?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface Settings {
  id: string;
  section: string;
  payload: Record<string, any>;
  updated_by?: string;
  updated_at: string;
}

// Query params
export interface LeadListParams {
  status?: string;
  source?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface OpportunityListParams {
  pipeline_id?: string;
  stage_id?: string;
  produto?: 'ALUGUE' | 'HUMANOID';
  q?: string;
  page?: number;
  page_size?: number;
}

// Forecast types
export interface ForecastScenario {
  name: 'pessimista' | 'realista' | 'otimista' | 'best_case';
  label: string;
  value: number;
  probability: number;
  meetsGoal: boolean;
  gap: number;
  percentage: number;
}

export interface RevenueProjection {
  date: string;
  closed: number;
  projected: number;
  weightedProjected: number;
  goal: number;
}

export interface ForecastData {
  pipelineTotal: number;
  weightedPipeline: number;
  pipelineCoverage: number;
  expectedCloseThisMonth: number;
  scenarios: ForecastScenario[];
  projections: RevenueProjection[];
  daysLeft: number;
  velocityPerDay: number;
  goal: number;
}
