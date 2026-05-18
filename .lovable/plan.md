## Objetivo

Toda empresa capturada no Kairós passa por um classificador que decide se ela é `customer`, `opportunity_existing`, `account_existing` ou `new_prospect`. O resultado vira badge no card, coluna filtrável na lista e bloqueio/aviso no botão Importar — sem nunca duplicar conta.

## 1. Edge function: `kairos-match-company`

Nova função em `supabase/functions/kairos-match-company/index.ts`.

**Input** (validado com Zod):
```ts
{
  prospect_id?: string,           // se vier, lê company_name/cnpj/domain do banco
  company_name?: string,
  cnpj?: string,
  domain?: string                  // normalizado (sem www, lowercase)
}
```

**Pipeline de matching** (curto-circuita na primeira regra que casa):

1. **CNPJ exato** → busca em `accounts.cnpj` (limpo, só dígitos). Match exato → `confidence: 100`.
2. **Domínio igual** → normaliza e bate contra `accounts.website` / `accounts.normalized_domain` (se existir; caso contrário, derivado em SQL). Match → `confidence: 90`.
3. **Nome similar** via `find_similar_accounts` RPC (já existe, usa `pg_trgm`, threshold 0.7). Pega o top match; se `similarity >= 0.85` → `confidence: round(similarity * 100)`.
4. Sem candidato → `new_prospect`, `confidence: 100`.

**Classificação do candidato encontrado** (em ordem):
- Tem registro em `customers` ou `slg_active_organizations` referenciando essa `account_id`? → `customer`.
- Tem `opportunities` ativas (não soft-deleted) ligadas a essa account? → `opportunity_existing`.
- Caso contrário → `account_existing`.
- Regra de segurança: se houver match mas com dúvida (`70 ≤ similaridade < 85`), retornar `account_existing` com `confidence` baixa e `reason` indicando "match provável por nome".

**Tudo escopado por `organization_id`** via JWT (`get_user_organization_id`) — nunca cruzar tenants.

**Output** (estrito):
```json
{
  "relationship_status": "customer | opportunity_existing | account_existing | new_prospect",
  "matched_account_id": "uuid | null",
  "matched_opportunity_id": "uuid | null",
  "confidence": 0-100,
  "reason": "string curta"
}
```

Quando `prospect_id` for fornecido, a função também **persiste** o resultado em `prospects`:
- `matched_account_id` (já existe)
- novo campo `relationship_status` (text)
- atualiza `dedupe_status` para `matched | clean`

## 2. Migration

Adicionar coluna em `prospects`:
- `relationship_status text` (nullable, default null)
- índice `(organization_id, relationship_status)` para filtro rápido

Sem mexer em RLS existente (já é por organização).

## 3. Integração no fluxo de sourcing

Em `useLeadSourcingV2` / `LeadSourcingEngine`, após cada batch de prospects criado, chamar `kairos-match-company` em lote (uma chamada por prospect, paralelizada em grupos de 5 — mesmo padrão de `ingestLeadsBulk`). O resultado já chega no próximo refetch porque é gravado no banco.

Não alterar nada que já está funcionando no scrape — apenas adicionar uma etapa pós-criação.

## 4. UI

### a) Badge no card do prospect
Em `LeadResultsTable.tsx` (e onde renderiza card), novo componente `RelationshipBadge`:
- `customer` → verde "Cliente"
- `opportunity_existing` → âmbar "Em oportunidade"
- `account_existing` → azul "Já é conta"
- `new_prospect` → cinza "Novo"
- Tooltip mostra `reason` + `confidence`

### b) Coluna "Status na base" filtrável
Adicionar coluna em `LeadResultsTable` lendo `prospect.relationship_status`. Filtro multi-select no topo da tabela.

### c) Bloqueio/aviso no botão Importar
Em `useImportProspect`/`useBulkImportProspects`:
- Se `relationship_status === 'customer'` → botão desabilitado, tooltip "Já é cliente — abrir conta existente".
- Se `opportunity_existing` ou `account_existing` → confirm dialog "Já existe X. Importar mesmo assim ou abrir existente?". Abrir leva a `/crm/accounts/:matched_account_id`.
- Se `new_prospect` → fluxo atual normal.

## 5. Arquivos tocados

**Novos**
- `supabase/functions/kairos-match-company/index.ts`
- `src/components/playbook/RelationshipBadge.tsx`
- Migration: `add_relationship_status_to_prospects.sql`

**Editados (mínimo)**
- `src/hooks/useLeadSourcingV2.ts` — disparar matching após criar prospects
- `src/components/playbook/LeadResultsTable.tsx` — coluna + badge + filtro
- `src/hooks/useProspectImport.ts` — checar status antes de importar

**Não tocar**: providers de scraping (mundogeo, fispal, informa-markets, expofp etc.), `import_prospect_to_pipeline`, Apollo, lead-sourcing principal.

## Riscos

- Custo de chamadas: 1 RPC + 1-3 queries por prospect. Sem LLM, então rápido e barato.
- Falsos positivos em nomes genéricos ("Tecnologia LTDA"): mitigado pelo threshold 0.85 e fallback para `account_existing` na faixa 0.70-0.85.
- Concorrência: matching em lote roda em paralelo de 5 — não satura o banco.

## Próximos passos pós-aprovação

1. Migration `relationship_status`
2. Edge function + deploy + teste com prospects já existentes do DRONE SHOW
3. UI (badge, coluna, bloqueio)
4. Validar com um run real do Kairós