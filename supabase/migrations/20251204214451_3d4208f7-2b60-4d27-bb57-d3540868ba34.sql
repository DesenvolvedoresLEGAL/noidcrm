
-- Update raw_user_meta_data with new email
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
      jsonb_set(raw_user_meta_data, '{email}', '"wagner@operadora.legal"'),
      '{email_verified}', 'true'
    ),
    email = DEFAULT,
    updated_at = NOW()
WHERE id = 'fd4bbf6a-cf4e-490e-94ca-d47166277590';
