UPDATE public.ai_email_messages
SET recipient_email = (recipient_email::jsonb)->>'value'
WHERE recipient_email LIKE '{%"value"%}'
  AND (recipient_email::jsonb)->>'value' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

UPDATE public.ai_agent_approval_queue q
SET status = 'pending',
    decided_at = NULL,
    rejection_reason = NULL
FROM public.ai_email_messages m
WHERE m.run_id = q.run_id
  AND q.status = 'send_failed'
  AND q.rejection_reason ILIKE '%No valid emails provided%';

UPDATE public.ai_email_messages
SET send_status = 'pending_approval',
    send_failure_reason = NULL,
    send_failed_at = NULL
WHERE send_failure_reason ILIKE '%No valid emails provided%';
