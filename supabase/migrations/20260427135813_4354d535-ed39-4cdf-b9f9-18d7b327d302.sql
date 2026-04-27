CREATE UNIQUE INDEX IF NOT EXISTS owner_queue_org_user_unique 
ON public.owner_queue (organization_id, user_id);