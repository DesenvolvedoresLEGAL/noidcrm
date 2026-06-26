-- Backfill: webhook do Apollo entregou telefone mas só atualizou campos legados.
-- Marca phone_revealed=true para contatos com phone presente que ficaram em 'requested'.
UPDATE public.enriched_contact_profiles
SET phone_revealed = true,
    phone_reveal_status = 'revealed',
    phone_revealed_at = COALESCE(phone_revealed_at, revealed_at, now()),
    preferred_channel = CASE WHEN preferred_channel IN ('unknown', 'linkedin', 'email', NULL) THEN 'whatsapp' ELSE preferred_channel END
WHERE phone IS NOT NULL
  AND length(phone) >= 6
  AND phone_revealed = false;

-- Fecha auditorias pendentes cujo telefone já chegou
UPDATE public.apollo_reveal_audit a
SET status = 'revealed',
    phone_after = COALESCE(a.phone_after, c.phone),
    credits_used = GREATEST(a.credits_used, 1)
FROM public.enriched_contact_profiles c
WHERE a.contact_id = c.id
  AND a.status = 'pending'
  AND a.requested_data_type IN ('phone','both')
  AND c.phone_revealed = true;
