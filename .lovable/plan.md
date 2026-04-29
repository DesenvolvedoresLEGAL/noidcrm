## Sprint E.1.2 — Apollo Realtime & Contact Governance

Objetivo: contatos enriquecidos chegando em tempo real, sem duplicação, com 1 único decisor principal confiável e protegido contra race conditions.

---

### 1. Migration de schema (`enriched_contact_profiles`)

- Adicionar `email_normalized text` (gerado via trigger: `lower(trim(email))`).
- Adicionar `is_merged boolean default false` (soft-merge, nunca delete físico).
- Adicionar `merged_into uuid` referenciando o contato vencedor (auditoria).
- Backfill: `update set email_normalized = lower(trim(email))` em todos existentes.
- Substituir índice atual `uniq_ectp_prospect_email` por:
  - `idx_unique_contact_email_org`: UNIQUE em `(workspace_id, email_normalized)` WHERE `email is not null AND is_merged = false`. Dedupe global por org.
  - `idx_one_primary_contact`: UNIQUE em `(prospect_id)` WHERE `is_primary = true AND is_merged = false`. Garante 1 primary por prospect.
- Trigger `trg_normalize_contact_email` BEFORE INSERT/UPDATE para preencher `email_normalized` automaticamente.

### 2. RPC `resolve_primary_contact(p_prospect_id uuid)` (SECURITY DEFINER, search_path=public)

Roda numa única transação para evitar race condition:
1. Seleciona melhor contato não-merged ordenado por: `confidence_score DESC, seniority_rank DESC, created_at ASC`.
2. `update ... set is_primary = false where prospect_id = p_prospect_id`.
3. `update ... set is_primary = true where id = vencedor`.
4. Retorna o ID do primary.

### 3. RPC `dedupe_prospect_contacts(p_prospect_id uuid)` (SECURITY DEFINER)

1. Agrupa por `email_normalized` (não nulo).
2. Para cada grupo com >1, mantém o de maior `confidence_score` e marca os outros com `is_merged = true, merged_into = vencedor.id`.
3. Retorna contagem deduped.
4. Insere `system_event` `lead.deduped` com `{ prospect_id, deduped_count }`.

### 4. Edge function `run-apollo-enrichment` — pós-processamento

Após inserir os contatos, no lugar do bloco atual de "set primary manual":
```ts
await sb.rpc("dedupe_prospect_contacts", { p_prospect_id: prospect_id });
await sb.rpc("resolve_primary_contact", { p_prospect_id: prospect_id });
```
Remover a lógica manual de `is_primary` que existe hoje (lines 289-294). Tratar conflito de UNIQUE no insert (`23505`) como contato já existente — não falhar o job, só pular.

Eventos adicionais via `trackEvent`:
- `lead.enriched` (já existe como `apollo_enrichment_completed`, manter).
- `decision_maker_found` (já existe, manter).
- `lead.deduped` se RPC retornar >0.

### 5. Hook `useRealtimeContacts` (global)

Novo hook em `src/hooks/useRealtimeContacts.ts` registrado no layout autenticado (uma única subscription por usuário, escopada por `organization_id` via filtro):
- Escuta `INSERT` em `enriched_contact_profiles` da org → toast `🎯 Novo decisor encontrado: <nome> · <cargo>`.
- Escuta `UPDATE` quando `is_primary` muda para `true` → toast `🔄 Decisor principal atualizado`.
- Escuta `UPDATE` quando `is_merged` vira `true` → silencioso (só invalida query).

`useEnrichedContacts(prospectId)` permanece com a subscription local (granular do drawer), mas filtra `is_merged = false` na listagem.

### 6. Frontend: `ProspectContactsTab`

- Listagem filtra `is_merged = false`.
- Card do primary recebe badge dourado `⭐ Decisor Principal`.
- Botão `Marcar como principal` chama nova função `setPrimaryContact` que faz `supabase.rpc('resolve_primary_contact_manual', { p_prospect_id, p_contact_id })` — RPC similar mas força um ID específico (override manual).
- Novo grupo "Duplicados resolvidos" expansível embaixo (collapse), mostrando contatos com `is_merged=true` somente para admins, com link "ver original".

### 7. Quality Panel (header da aba Contatos)

Cards compactos mostrando:
- Total de contatos ativos
- Decisores encontrados (c_level + vp + director)
- Emails válidos (`email_status = verified`)
- Score médio
- Duplicados resolvidos (count `is_merged=true`)

Dados derivados client-side a partir do array já carregado.

### 8. Tipos / serviços

- Atualizar `apolloService.setPrimaryContact` para usar RPC `resolve_primary_contact_manual` ao invés do double-update atual (que tem race condition).
- Adicionar `listEnrichedContacts` filtrando `is_merged = false`.

---

### Arquivos impactados

**Novos:**
- `supabase/migrations/<ts>_apollo_dedupe_governance.sql` (schema + RPCs + trigger)
- `src/hooks/useRealtimeContacts.ts` (listener global)
- `src/components/playbook/enrichment/ContactsQualityPanel.tsx`
- `src/components/playbook/enrichment/MergedContactsAccordion.tsx`

**Editados:**
- `supabase/functions/run-apollo-enrichment/index.ts` (chamar RPCs, remover lógica manual de primary)
- `src/services/enrichment/apolloService.ts` (RPC para setPrimary, filtro is_merged)
- `src/hooks/useEnrichedContacts.ts` (filtro is_merged na query)
- `src/components/playbook/ProspectContactsTab.tsx` (quality panel + accordion duplicados)
- `src/App.tsx` ou layout autenticado (montar `useRealtimeContacts()` uma vez)
- `src/integrations/supabase/types.ts` (regenerado automaticamente)

### Riscos e mitigações

- **Conflito no UNIQUE global por org**: contato com mesmo email em prospects diferentes hoje seria duplicado. Mitigação: o índice é `WHERE is_merged = false` — se houver colisão real no backfill, deduplicamos antes de criar o índice (CTE no migration mantendo o mais recente).
- **Race condition**: resolvido via RPC SECURITY DEFINER em transação única.
- **Realtime spam**: filtro por `organization_id` no channel + dedupe via toast id evita N toasts simultâneos.
- **Override manual sumindo**: campo opcional `is_primary_locked boolean` (futuro) — fora do escopo desta sprint, mas RPC já recebe `p_force` para não sobrescrever quando flag estiver presente.

### Critério de sucesso

- Nenhum contato duplicado visível na UI (filtro `is_merged=false`).
- Sempre exatamente 1 `is_primary=true` por prospect (garantido por índice UNIQUE).
- Toast aparece <2s após Apollo retornar.
- Re-rodar enrichment não cria duplicatas (UNIQUE + dedupe RPC).
- User pode trocar primary e mudança persiste.
