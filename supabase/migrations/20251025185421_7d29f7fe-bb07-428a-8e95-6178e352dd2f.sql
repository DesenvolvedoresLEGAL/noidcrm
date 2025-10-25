-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT UNIQUE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  segmento TEXT,
  cnae TEXT,
  tamanho TEXT,
  origem_principal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  emails TEXT[],
  telefones TEXT[],
  cargo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create stages table
CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL,
  pipeline_id TEXT REFERENCES pipelines(id),
  stage_id TEXT REFERENCES stages(id),
  title TEXT NOT NULL,
  valor_previsto DECIMAL(15,2),
  prob INTEGER DEFAULT 50 CHECK (prob >= 0 AND prob <= 100),
  close_date_prevista TIMESTAMP WITH TIME ZONE,
  produto TEXT,
  origem TEXT,
  fonte TEXT,
  status TEXT DEFAULT 'new',
  temperatura TEXT CHECK (temperatura IN ('cold', 'warm', 'hot', 'burning')) DEFAULT 'warm',
  urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  next_followup_date TIMESTAMP WITH TIME ZONE,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  days_since_contact INTEGER DEFAULT 0,
  automation_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  owner_user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'whatsapp', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  is_automated BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT false,
  sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('email_sent', 'whatsapp_sent', 'task_created', 'score_updated', 'sequence_enrolled')),
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'system')),
  message_content TEXT,
  ai_context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create automation_config table
CREATE TABLE IF NOT EXISTS automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT REFERENCES pipelines(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  followup_frequency_cold INTEGER DEFAULT 5,
  followup_frequency_warm INTEGER DEFAULT 3,
  followup_frequency_hot INTEGER DEFAULT 2,
  followup_frequency_burning INTEGER DEFAULT 1,
  work_hours_start TIME DEFAULT '08:00:00',
  work_hours_end TIME DEFAULT '18:00:00',
  max_messages_per_week INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for MVP - should be tightened based on roles)
CREATE POLICY "Users can view all accounts" ON accounts FOR SELECT USING (true);
CREATE POLICY "Users can insert accounts" ON accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update accounts" ON accounts FOR UPDATE USING (true);

CREATE POLICY "Users can view all contacts" ON contacts FOR SELECT USING (true);
CREATE POLICY "Users can insert contacts" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update contacts" ON contacts FOR UPDATE USING (true);

CREATE POLICY "Users can view all pipelines" ON pipelines FOR SELECT USING (true);
CREATE POLICY "Users can view all stages" ON stages FOR SELECT USING (true);

CREATE POLICY "Users can view opportunities" ON opportunities FOR SELECT USING (true);
CREATE POLICY "Users can insert opportunities" ON opportunities FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update opportunities" ON opportunities FOR UPDATE USING (true);
CREATE POLICY "Users can delete opportunities" ON opportunities FOR DELETE USING (true);

CREATE POLICY "Users can view activities" ON activities FOR SELECT USING (true);
CREATE POLICY "Users can insert activities" ON activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update activities" ON activities FOR UPDATE USING (true);

CREATE POLICY "Users can view automation logs" ON automation_logs FOR SELECT USING (true);
CREATE POLICY "System can insert automation logs" ON automation_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view automation config" ON automation_config FOR SELECT USING (true);
CREATE POLICY "Users can manage automation config" ON automation_config FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX idx_opportunities_pipeline ON opportunities(pipeline_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX idx_opportunities_temperatura ON opportunities(temperatura);
CREATE INDEX idx_opportunities_urgency_score ON opportunities(urgency_score);
CREATE INDEX idx_opportunities_next_followup ON opportunities(next_followup_date);
CREATE INDEX idx_activities_opportunity ON activities(opportunity_id);
CREATE INDEX idx_automation_logs_opportunity ON automation_logs(opportunity_id);

-- Insert default pipelines
INSERT INTO pipelines (id, name, type, color) VALUES
  ('pipe-pre-vendas', 'PRÉ-VENDAS', 'pre_sales', '#3b82f6'),
  ('pipe-vendas', 'VENDAS', 'sales', '#10b981'),
  ('pipe-pos-vendas', 'PÓS-VENDAS', 'post_sales', '#f59e0b')
ON CONFLICT (id) DO NOTHING;

-- Insert default stages
INSERT INTO stages (id, pipeline_id, name, order_index, color) VALUES
  ('stage-lead', 'pipe-pre-vendas', 'Lead Captado', 1, '#3b82f6'),
  ('stage-qualificacao', 'pipe-pre-vendas', 'Qualificação', 2, '#6366f1'),
  ('stage-proposta', 'pipe-vendas', 'Proposta Enviada', 1, '#10b981'),
  ('stage-negociacao', 'pipe-vendas', 'Negociação', 2, '#059669'),
  ('stage-fechamento', 'pipe-vendas', 'Fechamento', 3, '#047857'),
  ('stage-onboarding', 'pipe-pos-vendas', 'Onboarding', 1, '#f59e0b'),
  ('stage-ativo', 'pipe-pos-vendas', 'Cliente Ativo', 2, '#ea580c')
ON CONFLICT (id) DO NOTHING;

-- Create function to update days_since_contact
CREATE OR REPLACE FUNCTION update_days_since_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_contact_date IS NOT NULL THEN
    NEW.days_since_contact := EXTRACT(DAY FROM (now() - NEW.last_contact_date));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_days_since_contact
  BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_days_since_contact();