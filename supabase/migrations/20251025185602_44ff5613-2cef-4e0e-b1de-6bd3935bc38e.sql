-- Add automation fields to opportunities table (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'temperatura') THEN
    ALTER TABLE opportunities ADD COLUMN temperatura TEXT CHECK (temperatura IN ('cold', 'warm', 'hot', 'burning')) DEFAULT 'warm';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'urgency_score') THEN
    ALTER TABLE opportunities ADD COLUMN urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'next_followup_date') THEN
    ALTER TABLE opportunities ADD COLUMN next_followup_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'last_contact_date') THEN
    ALTER TABLE opportunities ADD COLUMN last_contact_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'days_since_contact') THEN
    ALTER TABLE opportunities ADD COLUMN days_since_contact INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'automation_enabled') THEN
    ALTER TABLE opportunities ADD COLUMN automation_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add automation fields to activities table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'is_automated') THEN
    ALTER TABLE activities ADD COLUMN is_automated BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'ai_generated') THEN
    ALTER TABLE activities ADD COLUMN ai_generated BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'sentiment') THEN
    ALTER TABLE activities ADD COLUMN sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));
  END IF;
END $$;

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
  pipeline_id TEXT,
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

-- Enable RLS on new tables
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_logs (only create if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_logs' AND policyname = 'Users can view automation logs') THEN
    CREATE POLICY "Users can view automation logs" ON automation_logs FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_logs' AND policyname = 'System can insert automation logs') THEN
    CREATE POLICY "System can insert automation logs" ON automation_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- RLS Policies for automation_config
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_config' AND policyname = 'Users can view automation config') THEN
    CREATE POLICY "Users can view automation config" ON automation_config FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'automation_config' AND policyname = 'Users can manage automation config') THEN
    CREATE POLICY "Users can manage automation config" ON automation_config FOR ALL USING (true);
  END IF;
END $$;

-- Create indexes (only if not exists)
CREATE INDEX IF NOT EXISTS idx_opportunities_temperatura ON opportunities(temperatura);
CREATE INDEX IF NOT EXISTS idx_opportunities_urgency_score ON opportunities(urgency_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_followup ON opportunities(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_automation_logs_opportunity ON automation_logs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);

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
DROP TRIGGER IF EXISTS trigger_update_days_since_contact ON opportunities;
CREATE TRIGGER trigger_update_days_since_contact
  BEFORE INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_days_since_contact();