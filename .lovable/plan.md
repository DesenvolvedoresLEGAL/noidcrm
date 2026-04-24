

## Plano: Reclassificar "Expositor"/"Organizador" e adicionar Tags em Contas

Você está 100% certo. "Expositor" não é segmento, é um **atributo comercial** (a empresa participa de feiras como expositor). O correto é:
- mover esse rótulo para uma **TAG** na conta
- reclassificar o `segmento` para o valor real (via CNAE ou heurística)

E você ganha o filtro cruzado: "Tecnologia + tag Expositor", "Varejo + tag Organizador", etc.

---

### 1. Criar infraestrutura de Tags em Contas (hoje só existe em Oportunidades)

**Migration nova:**
- Tabela `account_tags` (espelha `opportunity_tags`): `id`, `account_id`, `tag_id`, `organization_id`, `created_at`
- Unique `(account_id, tag_id)` para evitar duplicidade
- Índices em `account_id` e `tag_id`
- RLS org-scoped (mesmo padrão de `opportunity_tags`)

A tabela `tags` já existe e é compartilhada por organização — **vamos reusá-la**, sem duplicar.

---

### 2. Backfill: mover "Expositor" / "Organizador" de segmento → tag

Para cada conta com `segmento IN ('Expositor','Organizador')`:

1. Garantir que existem as tags `Expositor` e `Organizador` na `tags` da organização (criar se não existir, com cores distintas).
2. Inserir vínculo em `account_tags`.
3. Reclassificar o `segmento`:
   - se a conta tem `cnae` → usar `fn_cnae_to_segmento(cnae)`
   - senão se tem CNPJ → marcar para enriquecimento via edge function existente `backfill-accounts-segmento`
   - senão → aplicar `fn_infer_segmento_from_name(nome)`
   - se nada resolver → `NULL` (melhor que mentir com "Expositor")

**Volume:** 1.342 Expositor + 4 Organizador = 1.346 contas. Backfill direto em SQL.

Bônus: também normalizar os 2 órfãos (`Marketing e Publicidade` → `Marketing`, `SaaS / Software` → `Tecnologia`).

---

### 3. UI — Editor de Conta (`AccountModalTabs.tsx` aba Comercial)

Adicionar componente **TagsSelector** na aba Comercial, abaixo de "Origem Principal":
- Multi-select com autocomplete sobre `tags` da organização
- Botão "Criar nova tag" inline
- Mesmo visual já usado em oportunidades (reusar `TagBadge` se existir, senão criar componente unificado em `src/components/shared/`)

---

### 4. Visualização — Card e Detalhe da Conta

- `AccountCard.tsx`: exibir até 3 tags como badges coloridos abaixo do segmento
- `AccountOverviewTabEnhanced.tsx`: seção "Tags" no sidebar/header da conta

---

### 5. Filtros na listagem de Contas (`Accounts.tsx`)

Adicionar 5º filtro: **Tags** (multi-select). Combinável com os filtros já existentes (segmento, porte, origem, score). Isso entrega exatamente o cenário que você descreveu: "Tecnologia + tag Expositor".

---

### 6. Relatórios

Já que você mencionou puxar relatórios cruzando tag × segmento:
- Adicionar `tags` no payload de exportação CSV de contas
- Deixar a base pronta para um relatório futuro de "Distribuição de Contas por Tag × Segmento" (não implemento o relatório agora, só preparo os dados)

---

### Arquivos impactados

**Novos:**
- `supabase/migrations/...` (tabela `account_tags` + RLS + índices)
- `src/services/supabase/account-tags.ts` (CRUD)
- `src/hooks/useAccountTags.ts`
- `src/components/accounts/AccountTagsSelector.tsx`

**Editados:**
- `src/components/accounts/AccountModalTabs.tsx` (aba Comercial)
- `src/components/accounts/AccountCard.tsx` (badges de tags)
- `src/components/accounts/AccountOverviewTabEnhanced.tsx`
- `src/pages/Accounts.tsx` (filtro de tags)
- `src/hooks/useAccountDetails.ts` (carregar tags junto)
- `src/services/supabase/accounts.ts` (exportação CSV com tags)

**Backfill SQL:** rodado uma vez via migration de dados, atualizando 1.346 contas.

---

### Riscos

- **Baixo.** Nenhuma RLS existente é alterada; nenhum schema crítico tocado.
- Backfill é idempotente (UPSERT na `account_tags`, UPDATE só onde `segmento IN ('Expositor','Organizador')`).
- Multitenancy preservado: tags são por `organization_id`.

### Resultado esperado

- Zero contas com segmento "Expositor"/"Organizador"
- 1.346 contas marcadas com a tag correspondente
- Filtro combinável tag × segmento × porte × score na listagem
- Base pronta para relatórios cruzados pelo time comercial

