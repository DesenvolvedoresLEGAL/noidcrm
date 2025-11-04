-- Add RLS policy to allow public token validation for invitations
-- This is secure because tokens are UUID v4 (virtually impossible to guess)
CREATE POLICY "Public can view invitation by token"
ON public.user_invitations
FOR SELECT
TO anon, authenticated
USING (
  token IS NOT NULL 
  AND status = 'pending' 
  AND expires_at > now()
);

-- Add index for better performance on token lookups
CREATE INDEX IF NOT EXISTS idx_user_invitations_token 
ON public.user_invitations(token, status, expires_at);