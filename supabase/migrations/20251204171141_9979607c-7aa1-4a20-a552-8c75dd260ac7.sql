-- Enable realtime for proposal_views and proposal_alerts tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_alerts;

-- Ensure proposal_views has REPLICA IDENTITY FULL for complete row data
ALTER TABLE public.proposal_views REPLICA IDENTITY FULL;
ALTER TABLE public.proposal_alerts REPLICA IDENTITY FULL;