# Inventory Provider Settings — Foundation v1

Sprint: `NOID-VERTICAL-1.0-VERT-01.2B`
Data: 2026-07-22
Escopo: seleção canônica tenant-aware, ponte legada Eventrix, resolver definitivo, sem alteração de Proposal Demand, sem publish.

## 1. Contexto

VERT-01.2A entregou o adapter genérico mas o resolver ainda decidia a partir da tabela específica de provider (`eventrix_inventory_integration_settings`). Para suportar múltiplos providers, precisamos de uma fonte canônica neutra por tenant.

## 2. Decisão

Criar `public.inventory_provider_settings` como fonte única para responder "qual provider este tenant usa hoje?" — sem duplicar credenciais, cache, URLs ou secrets do provider específico.

## 3. Schema

```sql
CREATE TABLE public.inventory_provider_settings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_type text NOT NULL,     -- 'native' | 'eventrix'
  is_enabled boolean NOT NULL DEFAULT true,
  selection_source text NOT NULL DEFAULT 'manual',
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

CHECKs:
- `provider_type IN ('native','eventrix')`
- `selection_source IN ('manual','legacy_backfill','legacy_eventrix_settings')`

## 4. Unicidade

`UNIQUE (organization_id)` — no máximo uma seleção canônica por tenant.

## 5. RLS

- `SELECT` — `user_is_org_member(organization_id)` (resolver roda para qualquer usuário do tenant).
- `INSERT` / `UPDATE` — `user_is_org_admin(organization_id)` (owner/admin apenas).
- Sem `DELETE` policy — desativação é `is_enabled=false` ou troca para `native`.
- Nenhuma nova função `SECURITY DEFINER` criada.
- As dez policies `nsec12_*` permanecem intactas.

## 6. Backfill

Idempotente, restrito a orgs com Eventrix ativo:

```sql
INSERT INTO public.inventory_provider_settings
  (organization_id, provider_type, is_enabled, selection_source)
SELECT organization_id, 'eventrix', true, 'legacy_backfill'
FROM public.eventrix_inventory_integration_settings
WHERE is_enabled = true
ON CONFLICT (organization_id) DO NOTHING;
```

Baseline: 10 orgs, 0 Eventrix ativos → 0 rows criadas (nada a migrar; comportamento futuro coberto pelo dual-write).

## 7. Resolver (nova precedência)

Arquivo: `src/inventory/providers/resolveInventoryProvider.ts`.

1. `inventory_provider_settings` → `canonical_provider_settings`.
   - `is_enabled=false` → `native`.
   - `provider_type` desconhecido → `native` com status `error` (nunca cai silenciosamente para Eventrix).
2. Sem row canônica → consulta `eventrix_inventory_integration_settings`.
   - Ativo → `legacy_eventrix_settings`.
3. Caso contrário → `native_default`.
4. Falha canônica + legado ativo → fallback controlado via legado (janela de transição).

## 8. Hook genérico

`src/inventory/hooks/useInventoryProviderSettings.ts`:

- `useInventoryProviderSettings()` — leitura + upsert administrativo.
- `upsertInventoryProviderSettings({ organizationId, userId, input })` — função reutilizável para dual-write.
- Não conhece Eventrix; não manipula secrets, cache ou categorias.

## 9. Dual-write (ponte legada)

`useUpsertEventrixInventorySettings` agora, após persistir na tabela Eventrix, chama `upsertInventoryProviderSettings`:

- Ativação Eventrix → canonical `{provider_type: 'eventrix', is_enabled: true, source: 'legacy_eventrix_settings'}`.
- Desativação Eventrix → canonical `{provider_type: 'native', is_enabled: true, source: 'legacy_eventrix_settings'}`.
- Falha canônica → erro explícito propagado ao caller (nunca sucesso silencioso).
- Invalida `eventrix-inv-settings`, `inventory-provider-settings` e `inventory-provider`.

## 10. Comportamento da LEGAL

- Continua com integração Eventrix ativa via tela existente.
- Provider resolvido: `eventrix` (via canonical após próximo save, ou via fallback legado enquanto row canônica não existir).
- Categorias/famílias e requisitos de produtos intocados.
- Nenhuma identificação por UUID/slug/nome/domínio.

## 11. Tenant sem Eventrix

- Sem row canônica + sem Eventrix ativo → `native`.
- Sem erro de configuração no ProductInventoryRequirementsEditor.
- Cadastro de produto continua funcionando normalmente.

## 12. Testes

`src/inventory/providers/__tests__/resolver-canonical.test.ts` (8 casos):

1. Canonical eventrix vence legado.
2. Canonical native vence legado eventrix ativo.
3. Canonical desabilitado → native.
4. Sem canonical + legado ativo → eventrix.
5. Sem canonical + legado inativo → native.
6. Falha canonical + legado ativo → fallback controlado.
7. `provider_type` inválido não vira Eventrix.
8. Source retornado válido.

Regressão VERT-01.2A (registry, providers, resolver original) permanece verde. Total: 25/25.

## 13. Baseline

| Métrica | Pré | Pós |
|---|---|---|
| Organizações | 10 | 10 |
| Eventrix settings | 0 | 0 |
| Eventrix ativos | 0 | 0 |
| Rows canônicas | 0 | 0 |
| Policies `nsec12_*` | 10 | 10 |
| Linter warnings | 254 | 254 |
| Novas Edge Functions | — | 0 |
| Novas SECURITY DEFINER | — | 0 |

## 14. Compatibilidade / Escopo intocado

- `eventrix_inventory_integration_settings` (estrutura, dados, policies).
- `eventrix_inventory_sync_cache`.
- Rota `/app/settings/eventrix-inventory`.
- Colunas `eventrix_*` em `product_inventory_requirements`.
- Proposal Inventory Demand.
- Product BOM.
- Forecast, Revenue Command, OTE, Revenue SSoT.
- Storage, Auth, invitations, Edge Functions, secrets.

## 15. Riscos

- Enquanto a UI legada for a única entrada, tenants que nunca reabriram o form permanecem resolvidos pelo fallback (não pelo canonical). Sem impacto funcional.
- Divergência entre canonical e legado só pode surgir se um admin editar canonical diretamente por RPC/SQL — o dual-write sobrescreve na próxima ação Eventrix.

## 16. Rollback

Código:
- Reverter `resolveInventoryProvider.ts`, `useInventoryProviderSettings.ts`, dual-write em `useEventrixInventory.ts`, testes novos.

Banco (somente se nenhuma dependência posterior existir):
```sql
DROP TRIGGER IF EXISTS trg_inventory_provider_settings_updated_at ON public.inventory_provider_settings;
DROP TABLE IF EXISTS public.inventory_provider_settings;
```
Backfill some junto com o DROP. Tabela Eventrix não é tocada pelo rollback.

## 17. Consumers ainda legados

- `useEventrixInventory` (tela + operações específicas).
- `EventrixInventorySettings.tsx` (rota canônica).
- `ProposalInventoryDemand*` / `inventoryDemand*` / `services/operations/inventory*`.

## 18. Próxima sprint (VERT-01.2C)

1. Migrar Proposal Inventory Demand para o adapter.
2. Alias de rota `/app/settings/inventory-provider` + tela genérica opcional.
3. Deprecação formal de `useEventrixInventoryCache`.
4. Iniciar Pack Conectividade (equipment profile).

---

## Chronological notes

- **VERT-01.2E-0 — canonical sync consistency fix.** UPDATE branch of `useUpsertEventrixInventorySettings` no longer returns early; INSERT and UPDATE share a single canonical sync step into `inventory_provider_settings`. Enable → `eventrix`, disable → `native`. See `docs/vertical/inventory-provider-canonical-sync-consistency-v1.md`.
