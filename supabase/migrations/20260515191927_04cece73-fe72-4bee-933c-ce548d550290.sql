-- Reset roleplay sessions that received only contingency-fallback evaluations.
-- These have generic placeholder feedback and should be re-evaluated by the real AI.
UPDATE public.roleplay_sessions
SET
  score_overall = NULL,
  passed = NULL,
  current_phase = 'evaluation_error'
WHERE scores_json->>'_contingencyFallback' = 'true'
  AND current_phase = 'completed';