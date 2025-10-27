-- Corrigir dados do profile do usuário
UPDATE public.profiles 
SET 
  email = 'wagsansevero@gmail.com',
  full_name = 'Wagner Ansevero'
WHERE user_id = 'fd4bbf6a-cf4e-490e-94ca-d47166277590';