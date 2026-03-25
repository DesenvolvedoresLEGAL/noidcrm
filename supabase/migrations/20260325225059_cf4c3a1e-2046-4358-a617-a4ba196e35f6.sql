
-- Add is_primary column
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Unique partial index: only one primary per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_one_primary_per_org 
ON public.pipelines (organization_id) 
WHERE is_primary = true;

-- Trigger to unset other primaries when setting one
CREATE OR REPLACE FUNCTION public.ensure_single_primary_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.pipelines 
    SET is_primary = false 
    WHERE organization_id = NEW.organization_id 
      AND id != NEW.id 
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_single_primary_pipeline ON public.pipelines;
CREATE TRIGGER trg_ensure_single_primary_pipeline
BEFORE INSERT OR UPDATE OF is_primary ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_primary_pipeline();
