## Objetivo

Permitir o enriquecimento Apollo em **qualquer prospect** (independente de `quality_label` e `priority_score`) durante a fase de testes do Kairós, **sem quebrar** nenhum dos fixes já feitos (reveal email/telefone, webhook de telefone, importação no CRM, anti-spam 24h, rate-limit, anti-duplicação).

## O que será alterado

Hoje existem **dois bloqueios duros** que impedem o botão "Confirmar enriquecimento":

1. `quality_label` precisa ser `high_confidence` ou `usable` (bloqueia `low_confidence`, `sem run` etc.)
2. `priority_score` precisa ser ≥ 180

Ambos vivem em **dois lugares espelhados** (preview + run). Vou flexibilizar nos dois.

### 1. `supabase/functions/preview-apollo-enrichment/index.ts`
- Remover os bloqueios de `quality_label` e `priority_score` da decisão de `eligible`.
- Manter como **warning informativo** (não bloqueante), para o usuário ver no modal: "Lead com qualidade `low_confidence` / score 80 — enriquecimento liberado em modo teste."
- Manter intactos os outros bloqueios reais:
  - `!domain` → ainda bloqueia (Apollo não funciona sem domínio)
  - `recentRunningJob` → ainda bloqueia (evita duplicar job em execução)
  - `recentSuccessfulJob` (anti-spam 24h) → ainda bloqueia
- `auto_send_allowed` continua `true` só para `high_confidence`; demais qualidades viram `review_required = true` (sem efeito no teste manual, mas protege automações futuras).

### 2. `supabase/functions/run-apollo-enrichment/index.ts`
- Remover os dois `skip()` de `low_quality` e `low_score` quando `trigger_source !== "automation"` (ou seja, em disparo manual pelo usuário).
- Para `trigger_source === "automation"` continuam valendo as guardas (não queremos que automações disparem em massa em leads ruins).
- Manter intactos:
  - Anti-spam 24h
  - Rate-limit 20/min por org
  - Guarda de `no_domain`
  - Bloqueio de `dm_already_found` em automação

### 3. `src/components/playbook/ProspectContactsTab.tsx` (linha 200)
- Atualizar o texto "Requer: quality_label = high_confidence, priority_score ≥ 180" para algo como "Modo teste Kairós: enriquecimento liberado para qualquer qualidade." (apenas cosmético).

## O que **não** será tocado

- `reveal-apollo-contact` e `apollo-phone-webhook` (reveal de email/telefone)
- `import_prospect_to_pipeline` (importação no CRM)
- Anti-duplicação, rate-limit, anti-spam 24h
- RLS, multitenancy, `workspace_id`
- Lógica de `auto_send_allowed` para automações

## Riscos

- **Baixo**. As guardas de custo/abuso (anti-spam 24h + rate-limit 20/min + domínio obrigatório) continuam ativas, então o consumo de créditos Apollo segue protegido.
- Automações continuam respeitando os filtros de qualidade — só o disparo **manual** fica livre.

## Próximos passos após aprovação

1. Editar as duas edge functions e o texto do componente.
2. Deploy automático.
3. Você testa com o lead "Italac" (que estava `low_confidence` / score 333) e qualquer outro.
