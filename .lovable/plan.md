# PATCH OTE 1.7.6 — Membros desligados não podem aparecer em períodos futuros sem produção

## Problema

Ana Paula (Hunter) foi removida da organização em **2026-05-26** (soft delete em `organization_members.deleted_at`, com `transferred_to` = Gustavo Lacerda). Mesmo assim, ela aparece no **Campeonato Comercial de Junho/2026** como 4º colocado, "Abaixo do mínimo", 0%.

Motivo: o `ote_seller_config` dela ficou com `end_date = 2026-06-06` e a edge `calculate-ote` só consulta `ote_seller_config`, sem cruzar com `organization_members.deleted_at`. Resultado: foi gerada uma linha em `ote_monthly_results` para 2026-06 com 0% (sem nenhuma venda ou lead qualificado).

Pela regra da memória ("usuários inativos com produção no período aparecem com badge Inativo"), ela não pode aparecer em Junho/2026 — foi desligada antes do início do período e não tem nenhuma produção/qualificação.

Maio/2026 (último mês ativo) é histórico imutável e **não deve ser alterado**.

## Princípios

- Histórico de períodos com produção real continua imutável (Maio e anteriores).
- Períodos posteriores ao desligamento, sem produção, não geram linha.
- A correção da fonte (config) precisa ser aplicada quando o membro é desligado, não só por patch único.
- Nenhuma alteração em `ote_levels`, `ote_multipliers` ou fórmulas.

## Mudanças

### 1. Edge `delete-user-with-transfer` (correção da fonte)

Quando soft-deletar o membro, encerrar também o `ote_seller_config`:

- Para cada config do `user_id` na org com `end_date IS NULL` OU `end_date > deleted_at::date`:
  - `UPDATE ote_seller_config SET end_date = LEAST(COALESCE(end_date, deleted_at::date), deleted_at::date), updated_at = now()`
- Log em `system_events` (`ote_seller_config_closed_on_member_delete`).

### 2. Edge `calculate-ote` (guardrail)

Após carregar `sellerConfigs`, cruzar com `organization_members` da mesma org:

- Se `organization_members.status = 'deleted'` e `deleted_at < startDate` (início do período) E o vendedor **não tem nenhuma produção ou lead qualificado no período**, pular o vendedor (não gera linha em `ote_monthly_results`, não conta como participante).
- "Tem produção" = `eligibleTotal > 0` OU `qualifiedLeads > 0` no período (mesma fonte já usada na função).
- Log `[OTE 1.7.6] Vendedor desligado sem produção ignorado` com `user_id` e `period`.
- Mantém a regra atual de **não filtrar** desligados que tenham produção — eles continuam aparecendo (badge "Inativo").

### 3. Backfill único

- `UPDATE ote_seller_config sc SET end_date = LEAST(COALESCE(sc.end_date, om.deleted_at::date), om.deleted_at::date) FROM organization_members om WHERE om.user_id = sc.user_id AND om.organization_id = sc.organization_id AND om.status = 'deleted' AND om.deleted_at IS NOT NULL AND (sc.end_date IS NULL OR sc.end_date > om.deleted_at::date);`
- `DELETE FROM ote_monthly_results r USING organization_members om WHERE r.user_id = om.user_id AND r.organization_id = om.organization_id AND om.status = 'deleted' AND r.period_month::date > om.deleted_at::date AND COALESCE(r.total_sales, 0) = 0 AND COALESCE(r.final_variable_amount, 0) = 0;`
  - Remove apenas linhas de períodos posteriores ao desligamento e sem produção. Mantém qualquer linha com produção (badge Inativo).

### 4. UI (`OTESellerDetailTab.tsx`)

- Nada além de não exibir as linhas que deixarão de existir após o backfill.
- O badge "Inativo" já existe e continua sendo aplicado para casos legítimos (desligado com produção).

## Validação

- Após backfill, recálculo de Junho/2026 não recria a linha de Ana Paula.
- Maio/2026 continua intacto (Ana Paula ausente — ela não tinha resultado em Maio também).
- Campeonato Comercial Junho/2026 passa a ter **3 participantes** (Bruno, Wagner, Gustavo).
- Pódio reaparece somente quando atingir 4+ participantes ativos (regra já existente em `OTESellerDetailTab`).
- Soft delete novo: ao desligar um membro hoje, futuros recálculos do mês seguinte não criam linha vazia.
- `npx tsc --noEmit` limpo.

## Não-objetivos

- Não alterar faixas de multiplicadores, valores de `ote_levels`, nem fórmulas.
- Não reescrever histórico de meses com produção real.
- Não mexer em `crm_active_users_view` nem nas regras de atribuição histórica de vendas/leads.
