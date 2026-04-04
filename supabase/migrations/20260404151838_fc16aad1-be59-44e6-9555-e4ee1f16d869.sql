-- Fix search_path on SECURITY DEFINER functions to prevent schema poisoning

ALTER FUNCTION public.enqueue_email SET search_path = public;
ALTER FUNCTION public.move_to_dlq SET search_path = public;
ALTER FUNCTION public.read_email_batch SET search_path = public;
ALTER FUNCTION public.delete_email SET search_path = public;
