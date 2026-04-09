

## Sprint 5 — Importação no CRM e Criação de Oportunidades

### Resumo

Transformar prospects aprovados em registros reais no CRM (accounts, contacts, opportunities) respeitando deduplicação e rastreabilidade completa.

---

### 1. Migração SQL — Rastreabilidade nas opportunities

Adicionar colunas de rastreabilidade na tabela `opportunities`:

```sql
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS playbook_run_id uuid,
  ADD COLUMN IF NOT EXISTS prospect_id uuid,
  ADD COLUMN IF NOT EXISTS priority_score numeric(6,2),
  ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;
```

Não criar FK constraints para evitar problemas de restauração — referências serão lógicas.

---

### 2. Serviço Backend — `importProspectToCRM`

Novo mutation no `useLeadSourcingV2.ts` que chama lógica client-side (via Supabase SDK direto, sem edge function):

**Fluxo por prospect:**
1. Buscar prospect completo com scores e signals
2. Verificar `dedupe_status`:
   - `strong_match` com `matched_account_id` → usar account existente
   - `no_match` ou sem match → criar nova account com dados do prospect (company_name → razao_social/nome_fantasia, website, city, industry, segmento, origem = 'lead_sourcing')
3. Se `email_public` ou `phone_public` preenchidos → criar contact vinculado à account
4. Criar opportunity:
   - `title`: company_name do prospect
   - `account_id`: account (existente ou nova)
   - `contact_id`: contact criado (se houver)
   - `pipeline_id` / `stage_id`: do playbook `execution_config` ou default do org
   - `playbook_run_id`: do prospect
   - `prospect_id`: id do prospect
   - `priority_score`: do prospect_scores
   - `source_metadata`: sinais, playbook_type, run_id, timestamp
   - `origem`: 'lead_sourcing'
   - `owner_user_id`: null (ou round robin se autoAssignOwner)
5. Atualizar prospect: `approval_status = 'imported'`, `approved_by`, `approved_at`
6. Invalidar queries de accounts, contacts, opportunities, prospects

**Bulk import:** Processar array de prospect IDs sequencialmente, com contagem de sucesso/falha.

---

### 3. Frontend — Ações de importação

**`LeadResultsTable.tsx`:**
- Botão "Importar" nos prospects aprovados (substituir/complementar "Oportunidade")
- Botão "Importar Selecionados" na barra de ações em lote
- Novo filtro: "Importados"
- Nova coluna de status: badge "Importado" com link para a opportunity/account criada
- Após importação, mostrar link para ver a conta/oportunidade

**`LeadSourcingEngine.tsx`:**
- Novo handler `handleImportProspect` e `handleBulkImport`
- Toast com resultado: "X prospects importados, Y contas criadas, Z oportunidades criadas"
- Passar `onImport` e `onBulkImport` para a tabela

**`ProspectDetailDrawer.tsx`:**
- Botão "Importar no CRM" no footer (para aprovados)
- Após importação, mostrar seção "Importado" com links para account e opportunity

---

### 4. Pipeline Cards — Badges de origem

**Nos cards do pipeline** (componente de kanban/oportunidade existente):
- Se `origem === 'lead_sourcing'`, mostrar badge "🐕 Caramelo"
- Mostrar `priority_score` se disponível
- Tooltip com playbook_type e sinais

---

### 5. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint5_opp_tracking.sql` | 4 colunas novas em opportunities |
| `src/hooks/useLeadSourcingV2.ts` | `useImportProspect()`, `useBulkImportProspects()` mutations |
| `src/components/playbook/LeadResultsTable.tsx` | Botões importar, filtro "Importados", links pós-import |
| `src/components/playbook/LeadSourcingEngine.tsx` | Handlers de importação, integração com tabela |
| `src/components/playbook/ProspectDetailDrawer.tsx` | Botão importar + seção pós-import |
| `src/hooks/useLeadSourcingV2.ts` | Atualizar Prospect interface com campos de import tracking |

---

### Critérios de aceite

- Prospect aprovado cria account nova quando não há conta compatível
- Prospect com `strong_match` cria opportunity na conta existente (sem duplicar account)
- Contact criado apenas quando há email ou telefone público
- Opportunity carrega `playbook_run_id`, `prospect_id`, `priority_score`, `source_metadata`
- Prospect atualizado para `imported` após importação
- Importação em lote funciona
- Links de navegação para account/opportunity criadas

