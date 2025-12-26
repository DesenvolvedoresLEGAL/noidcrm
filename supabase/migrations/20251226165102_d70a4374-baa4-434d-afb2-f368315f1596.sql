-- Phase 6: Mandatory Explainability

-- Add enhanced breakdown columns to seller_performance_scores
ALTER TABLE public.seller_performance_scores
ADD COLUMN IF NOT EXISTS cs_explainability JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bs_explainability JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ds_explainability JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ras_explainability JSONB DEFAULT '{}';

-- Add comment explaining the structure
COMMENT ON COLUMN public.seller_performance_scores.cs_explainability IS 'JSON structure: { breakdown: {...}, increased_by: [...], decreased_by: [...], how_to_improve: [...] }';
COMMENT ON COLUMN public.seller_performance_scores.bs_explainability IS 'JSON structure: { breakdown: {...}, increased_by: [...], decreased_by: [...], how_to_improve: [...] }';
COMMENT ON COLUMN public.seller_performance_scores.ds_explainability IS 'JSON structure: { breakdown: {...}, increased_by: [...], decreased_by: [...], how_to_improve: [...] }';
COMMENT ON COLUMN public.seller_performance_scores.ras_explainability IS 'JSON structure: { breakdown: {...}, increased_by: [...], decreased_by: [...], how_to_improve: [...] }';