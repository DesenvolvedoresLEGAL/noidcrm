
-- Create user_smtp_configs table
CREATE TABLE public.user_smtp_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  smtp_host TEXT NOT NULL DEFAULT '',
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL DEFAULT '',
  smtp_password_encrypted TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  signature_html TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_smtp_configs ENABLE ROW LEVEL SECURITY;

-- Users can view their own SMTP config
CREATE POLICY "Users can view own smtp config"
  ON public.user_smtp_configs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own SMTP config
CREATE POLICY "Users can insert own smtp config"
  ON public.user_smtp_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own SMTP config
CREATE POLICY "Users can update own smtp config"
  ON public.user_smtp_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own SMTP config
CREATE POLICY "Users can delete own smtp config"
  ON public.user_smtp_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_smtp_configs_updated_at
  BEFORE UPDATE ON public.user_smtp_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add email fields to activities table for email automation
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_body TEXT,
  ADD COLUMN IF NOT EXISTS email_to TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_cc TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_template_id UUID REFERENCES public.email_templates(id);
