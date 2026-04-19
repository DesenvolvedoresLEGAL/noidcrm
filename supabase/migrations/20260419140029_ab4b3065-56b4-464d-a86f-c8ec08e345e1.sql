
ALTER TYPE digest_run_status ADD VALUE IF NOT EXISTS 'running';
ALTER TYPE digest_run_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE digest_run_status ADD VALUE IF NOT EXISTS 'skipped';
