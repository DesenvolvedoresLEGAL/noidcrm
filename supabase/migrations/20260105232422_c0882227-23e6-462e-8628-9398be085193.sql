-- Add opportunity_id column to public_form_submissions for tracking submissions from opportunity public forms
ALTER TABLE public.public_form_submissions 
ADD COLUMN IF NOT EXISTS opportunity_id uuid NULL;

-- Create index for faster queries by opportunity
CREATE INDEX IF NOT EXISTS idx_public_form_submissions_opportunity_id 
ON public.public_form_submissions(opportunity_id);

-- Add foreign key constraint (with ON DELETE SET NULL to preserve history if opportunity is deleted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'public_form_submissions_opportunity_id_fkey'
    AND table_name = 'public_form_submissions'
  ) THEN
    ALTER TABLE public.public_form_submissions
    ADD CONSTRAINT public_form_submissions_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.public_form_submissions.opportunity_id IS 'Reference to the opportunity when form was submitted via opportunity public form link';