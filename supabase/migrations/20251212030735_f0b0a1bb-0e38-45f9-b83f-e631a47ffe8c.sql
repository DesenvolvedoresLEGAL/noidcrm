-- Add target_roles column to missions table (if not exists check failed earlier due to later errors)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'target_roles') THEN
    ALTER TABLE public.missions ADD COLUMN target_roles TEXT[] DEFAULT ARRAY['sales', 'sdr', 'bdr', 'ae', 'closer', 'farmer'];
  END IF;
END $$;

-- Add target_roles column to badges table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'target_roles') THEN
    ALTER TABLE public.badges ADD COLUMN target_roles TEXT[] DEFAULT ARRAY['sales', 'sdr', 'bdr', 'ae', 'closer', 'farmer', 'cs', 'manager'];
  END IF;
END $$;