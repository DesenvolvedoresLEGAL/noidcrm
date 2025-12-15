-- Add default_pipeline_id column to profiles table (TEXT type to match pipelines.id)
ALTER TABLE public.profiles
ADD COLUMN default_pipeline_id TEXT REFERENCES public.pipelines(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.default_pipeline_id IS 'Default pipeline for this user when creating opportunities';