-- Add automation fields to opportunities table (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='temperature') THEN
    ALTER TABLE opportunities ADD COLUMN temperature TEXT CHECK (temperature IN ('cold', 'warm', 'hot', 'burning')) DEFAULT 'warm';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='urgency_score') THEN
    ALTER TABLE opportunities ADD COLUMN urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='next_followup_date') THEN
    ALTER TABLE opportunities ADD COLUMN next_followup_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='last_contact_date') THEN
    ALTER TABLE opportunities ADD COLUMN last_contact_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='days_since_contact') THEN
    ALTER TABLE opportunities ADD COLUMN days_since_contact INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opportunities' AND column_name='automation_enabled') THEN
    ALTER TABLE opportunities ADD COLUMN automation_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add automation tracking fields to activities table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='is_automated') THEN
    ALTER TABLE activities ADD COLUMN is_automated BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='ai_generated') THEN
    ALTER TABLE activities ADD COLUMN ai_generated BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='sentiment') THEN
    ALTER TABLE activities ADD COLUMN sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative'));
  END IF;
END $$;

-- Create indexes for better performance (only if not exists)
CREATE INDEX IF NOT EXISTS idx_opportunities_temperature ON opportunities(temperature);
CREATE INDEX IF NOT EXISTS idx_opportunities_urgency_score ON opportunities(urgency_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_next_followup ON opportunities(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_automation_logs_opportunity ON automation_logs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);