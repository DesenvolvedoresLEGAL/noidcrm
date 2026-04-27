ALTER TABLE public.decision_logs DROP CONSTRAINT IF EXISTS decision_logs_decision_taken_check;
ALTER TABLE public.decision_logs ADD CONSTRAINT decision_logs_decision_taken_check
  CHECK (decision_taken IN ('executed','skipped_duplicate','skipped_low_quality','skipped_no_rule','no_active_matching_rule','failed','dry_run'));