UPDATE public.ai_agent_execution_runs
SET execution_status = 'failed',
    final_output_json = jsonb_build_object('error', 'Stuck in running due to legacy AI wrapper sending Gemini model id to OpenAI endpoint; auto-resolved by hotfix on 2026-04-20'),
    completed_at = NOW()
WHERE execution_status = 'running'
  AND created_at < NOW() - INTERVAL '15 minutes';