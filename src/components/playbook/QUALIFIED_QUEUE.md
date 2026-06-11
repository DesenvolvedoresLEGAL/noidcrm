# Qualified Queue (KAI.13)

Camada intermediária entre o sourcing do Kairós e o CRM. Nenhum prospect entra no CRM sem
passar pela fila de qualificação.

## Fluxo

```
Evento/Source → Matching → Enriquecimento → Qualified Queue → SDR → CRM
```

## Status (`qualification_status`)

- `captured` — entrou na fila
- `existing_customer`, `existing_account`, `duplicate` — bloqueia importação automática
- `enriched`, `decision_maker_found`, `contact_revealed`, `approach_ready`
- `ready_for_sdr` — habilita promoção para CRM
- `human_review` — exige revisão manual
- `imported` — promovido ao CRM
- `discarded` — descartado

## Score (0–100)

- +20 ICP compatível
- +15 domínio corporativo
- +15 decisor encontrado
- +15 e-mail corporativo encontrado
- +10 participa do evento
- +10 score IA (`confidence ≥ 70`) ou +5 (`≥ 40`)
- +10 fonte confiável (event/expofp/firecrawl_verified) ou +5 outras
- +5 sem duplicidade

Grade: A ≥ 80, B ≥ 60, C ≥ 40, D < 40.

## SDR Ready

- `enrichment_status` em (`enriched`, `complete`)
- decisor encontrado
- contato revelado
- score ≥ 60
- sem duplicidade
- sem relacionamento ativo (não cliente/conta/oportunidade)

Quando atinge, `qualification_status` é movido para `ready_for_sdr` automaticamente.

## Human Review

Itens devem ser enviados a revisão quando:

- cliente existente
- duplicidade parcial
- score baixo com sinais incompletos
- múltiplos domínios/CNPJs
- empresa sem site

## Importação controlada

Apenas itens `ready_for_sdr` podem ser promovidos via `kairos-promote-to-crm`. A promoção:

- reutiliza o RPC `import_prospect_to_pipeline`
- cria conta, contato principal e oportunidade
- gera task inicial para o SDR
- atualiza o item na fila para `imported`

## Edge functions

- `kairos-enqueue-prospect` — inserção inicial + matching
- `kairos-generate-approach-brief` — IA gera dores, hipóteses, ângulo, mensagem e CTA
- `kairos-promote-to-crm` — promoção controlada para o CRM
