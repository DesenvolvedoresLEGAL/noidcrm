-- Hotfix Sprint Scoring 1.3: normalize legacy NRHS tier values that the
-- frontend NRHSBadge does not recognize (was crashing the Pipeline page).
UPDATE public.opportunities
SET nrhs_tier = 'risk'
WHERE nrhs_tier = 'attention';