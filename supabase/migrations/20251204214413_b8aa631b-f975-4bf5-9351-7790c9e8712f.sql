
-- Force refresh the generated email column by setting to DEFAULT
UPDATE auth.users 
SET email = DEFAULT,
    updated_at = NOW()
WHERE id = 'fd4bbf6a-cf4e-490e-94ca-d47166277590';
