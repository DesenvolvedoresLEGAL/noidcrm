-- Add goal system mode to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS goal_system_mode TEXT NOT NULL DEFAULT 'ote' 
CHECK (goal_system_mode IN ('ote', 'simple'));

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.goal_system_mode IS 'ote = Sistema OTE completo com comissões, simple = Metas simples sem comissões';