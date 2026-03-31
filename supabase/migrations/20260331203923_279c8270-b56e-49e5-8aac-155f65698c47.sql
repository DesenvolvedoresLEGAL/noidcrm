ALTER TABLE public.ote_levels ADD COLUMN goal_type text NOT NULL DEFAULT 'revenue';

UPDATE public.ote_levels SET goal_type = 'leads' WHERE level_code IN ('BDR1', 'BDR2', 'BDR3');