

## Sprint 3 — Revisão Operacional, Deduplicação e Aprovação

### Resumo

Adicionar camada de revisão antes da importação no CRM: deduplicação contra accounts existentes, aprovação/rejeição individual e em lote, filtros operacionais na tabela, e drawer de detalhe com score breakdown.

---

### 1. Migração SQL — Novas colunas em `prospects`

```sql
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS matched_account_id uuid,
  ADD COLUMN IF NOT EXISTS dedupe_status text DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
```

---

### 2. Edge Function — Dedupe no `lead-sourcing`

Após criar cada prospect no handler manual_import (e AI-powered), rodar dedupe contra a tabela `accounts` da mesma organização:

**Regras de match:**
1. **Domínio exato**: `prospects.normalized_domain` vs domínio extraído de `accounts.website`
2. **Nome normalizado**: `prospects.normalized_company_name` vs normalização de `accounts.razao_social` / `accounts.nome_fantasia`
3. **Nome + cidade**: match de nome parcial + `accounts.cidade`

**Decisão:**
- `strong_match` → `duplicate_candidate: true`, `dedupe_status: 'strong_match'`, `matched_account_id: <id>`
- `possible_match` → `duplicate_candidate: true`, `dedupe_status: 'possible_match'`, `review_needed: true`, `matched_account_id: <id>`
- `no_match` → `dedupe_status: 'no_match'`

Registrar em `dedupe_registry` cada verificação relevante.

---

### 3. Hook — Novos mutations e queries

**`useLeadSourcingV2.ts`** — adicionar:
- `useBulkUpdateProspects()` — mutation para aprovar/rejeitar em lote
- `useProspectDetail(id)` — query com scores + signals + matched account
- Atualizar `useUpdateProspectStatus` para incluir `approved_by`, `approved_at`, `rejected_by`, `rejected_at` usando o user atual

---

### 4. Frontend — Tabela com filtros e ações em lote

**`LeadResultsTable.tsx`** — evoluir:
- Adicionar **filtros** como tabs/chips: Todos, Pendentes, Aprovados, Rejeitados, Possível Duplicado, Score Alto, Sem Domínio
- Adicionar **checkbox** por linha + header checkbox para seleção
- Barra de ações em lote: "Aprovar Selecionados", "Rejeitar Selecionados", "Marcar para Revisão"
- Badge de dedupe na linha (ícone de alerta para strong/possible match)
- Coluna `Duplicidade` mostrando status de dedupe

---

### 5. Frontend — ProspectDetailDrawer (novo componente)

Usar `Sheet` (radix, já existe no projeto) abrindo pela direita ao clicar na linha.

**Seções do drawer:**
1. **Resumo** — nome, domínio, cidade, indústria, origem
2. **Dados Estruturados** — todos os campos do prospect
3. **Sinais** — lista de signals com weight e confidence
4. **Score Breakdown Visual** — barras horizontais para ICP Fit, Sinais, Qualidade, Fonte, Penalidade, Score Final
5. **Evidência da Origem** — source_label, source_url, raw_data
6. **Duplicidade** — se matched_account_id, mostrar nome da account existente e tipo de match
7. **Ação Recomendada** — recommended_next_action destacado

Botões no footer: Aprovar / Rejeitar / Criar Oportunidade

---

### 6. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint3_review_dedupe.sql` | Novas colunas em prospects |
| `supabase/functions/lead-sourcing/index.ts` | Adicionar dedupe após criação de prospects |
| `src/hooks/useLeadSourcingV2.ts` | Bulk mutations, prospect detail query, user tracking em approve/reject |
| `src/components/playbook/LeadResultsTable.tsx` | Filtros, checkboxes, ações em lote, badge dedupe |
| `src/components/playbook/ProspectDetailDrawer.tsx` | **Novo** — Sheet com todas as seções de detalhe |
| `src/components/playbook/LeadSourcingEngine.tsx` | Integrar drawer state |

---

### Critérios de aceite

- Prospect com domínio existente em accounts marcado como `strong_match`
- Prospect com nome similar entra em revisão (`possible_match`)
- Aprovação individual salva `approved_by` e `approved_at`
- Aprovação/rejeição em lote funciona
- Filtros operacionais filtram corretamente
- Drawer carrega todos os detalhes incluindo score breakdown e dedupe info

