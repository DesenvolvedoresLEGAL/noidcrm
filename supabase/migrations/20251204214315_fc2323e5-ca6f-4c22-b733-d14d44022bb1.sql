
-- Update email in auth.identities (source of truth for email)
UPDATE auth.identities
SET identity_data = jsonb_set(
      jsonb_set(identity_data, '{email}', '"wagner@operadora.legal"'),
      '{email_verified}', 'true'
    ),
    updated_at = NOW()
WHERE user_id = 'fd4bbf6a-cf4e-490e-94ca-d47166277590';
