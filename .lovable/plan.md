## KAI.15.1 — Apollo Reveal Governance

Separar enriquecimento Apollo em três camadas (perfil, telefone, e-mail) para parar de consumir crédito em dados que a operação não usa. Para LEGAL, foco em telefone/WhatsApp.

### 1. Migração de banco

**`enriched_contact_profiles`** — adicionar:
- `email_revealed bool default false`, `phone_revealed bool default false`
- `email_credits_used int default 0`, `phone_credits_used int default 0`, `profile_credits_used int default 0`
- `email_reveal_status text` (not_requested/requested/revealed/not_found/failed/skipped)
- `phone_reveal_status text` (idem)
- `email_revealed_at timestamptz`, `phone_revealed_at timestamptz`
- `preferred_channel text` (phone/whatsapp/email/linkedin/unknown)
- `reveal_source text` (manual/apollo_invisible/autopilot/sdr_agent)
- `last_reveal_job_id uuid`

**`enrichment_jobs`** — adicionar:
- `requested_data_type text` (profile_only/email/phone/both)
- `contact_id uuid`, `requested_channel text`
- `credits_estimated int`, `credits_used int`
- `skip_reason text`, `response_summary jsonb`

**`apollo_reveal_audit`** (nova) — id, organization_id, prospect_id, contact_id, job_id, requested_data_type, requested_channel, provider, status, credits_estimated, credits_used, email_before/after, phone_before/after, requested_by, source, reason, raw_response jsonb, created_at. RLS por organização + GRANT.

**`apollo_auto_enrichment_rules`** — adicionar:
- `auto_reveal_email bool default false`
- `auto_reveal_phone bool default true`
- `auto_reveal_both bool default false`
- `email_reveal_min_score int default 220`
- `phone_reveal_min_score int default 180`
- `max_email_reveals_per_company int default 0`
- `max_phone_reveals_per_company int default 2`
- `fallback_to_email_if_no_phone bool default true`

### 2. Edge functions

**Nova `kairos-apollo-reveal-contact`**: input `{contact_id, prospect_id, requested_data_type, source}`. Valida org/permissão, checa skip (já revelado), estima créditos, chama Apollo só para o dado pedido, atualiza `enriched_contact_profiles`, recalcula Contact Score, registra `apollo_reveal_audit`, atualiza `kairos_qualified_queue` (preferred_channel), grava `revenue_events`.

**Atualizar `kairos-apollo-invisible`**: deixar de revelar pacote completo. Fluxo novo:
1. Buscar decisores (profile only) → status `profile_identified`
2. Selecionar primary
3. Se regra `auto_reveal_phone` e score ≥ `phone_reveal_min_score` e abaixo do cap → revelar telefone
4. Se regra `auto_reveal_email` e score ≥ `email_reveal_min_score` e abaixo do cap → revelar e-mail
5. Fallback para e-mail se telefone não encontrado e regra ativa
6. Atualiza queue + audit

**Atualizar `kairos-apollo-estimate`**: separar `profile_search_credits_estimated`, `phone_reveal_credits_estimated`, `email_reveal_credits_estimated`, `total_credits_estimated`.

### 3. Contact Score recalibrado

Atualizar shared `apollo-contact-score.ts`:
- +20 senioridade compatível, +15 dept compatível, +15 LinkedIn
- +20 telefone revelado, +15 telefone válido
- +15 e-mail revelado, +10 e-mail válido
- +10 cargo match — cap 100

### 4. SDR Ready ajustado

`kairos-qualified-queue` trigger: SDR ready = decisor + ao menos um canal acionável (phone_revealed OR email_revealed OR linkedin_url). Prioridade maior se phone_revealed.

### 5. Frontend

**Service `apolloInvisible.ts`** — adicionar `revealContact()` wrapper.

**Novo hook `useRevealContact`** (substitui/estende `useRevealApolloContact`).

**`ContactsTab` (oportunidade)** — para cada contato:
- Mostrar nome, cargo, senioridade, dept, LinkedIn, score
- Badges separados para status de telefone e e-mail
- Botões: "Revelar telefone", "Revelar e-mail", "Revelar ambos"
- Modal de confirmação antes de revelar: contato, empresa, dado, créditos estimados, status atual, aviso de custo
- Botão bloqueado durante chamada

**Settings — Apollo Invisible (Autopilot tab)** — nova seção "Governança de Revelação" com os 7 campos novos da regra.

**`Apollo ROI`** — KPIs novos: créditos perfil/telefone/e-mail, custo por telefone/e-mail revelado, telefones úteis, e-mails úteis, canal mais usado.

### 6. Revenue events

Registrar: `apollo_profile_identified`, `apollo_phone_reveal_requested/revealed/not_found`, `apollo_email_reveal_requested/revealed/not_found`, `apollo_reveal_failed`.

### Garantias mantidas
- Apollo nunca cria opp/conta/contato CRM.
- Backend é fonte da verdade (UI só dispara).
- Forecast/OTE/Win-Loss/Receita não tocados.

### Arquivos impactados (estimativa)
- 1 migração SQL
- `supabase/functions/kairos-apollo-reveal-contact/index.ts` (novo)
- `supabase/functions/kairos-apollo-invisible/index.ts` (refactor)
- `supabase/functions/kairos-apollo-estimate/index.ts` (split de créditos)
- `supabase/functions/_shared/apollo-contact-score.ts` (recalibrar)
- `src/services/intelligence/apolloInvisible.ts` (+ revealContact, tipos novos)
- `src/hooks/intelligence/useRevealContact.ts` (novo)
- `src/components/opportunity/contacts/*` (botões + badges + modal)
- `src/pages/settings/.../ApolloInvisibleSettings` (governança)
- `src/pages/intelligence/ApolloRoi.tsx` (novos KPIs)

### Risco
- Trigger de qualified queue mexe em sdr_ready: precisa testar com regra phone-only LEGAL.
- Backward compat: registros antigos com `decision_maker_status='revealed'` recebem `phone_revealed=true` no backfill se já tinham phone, idem email.