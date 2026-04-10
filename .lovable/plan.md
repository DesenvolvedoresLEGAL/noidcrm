

# Diagnóstico: Workflow não dispara no pipeline VENDAS

## Causa raiz

As 7 regras de automação "PV: Avançar + Orquestrar" estão configuradas para o pipeline **PRÉ-VENDAS** (`d1b68a0f-...-sales-1`), **não para o pipeline VENDAS** (`59a4780d-...`).

Quando a atividade foi concluída na oportunidade NITROCUT NA FEIMEC 2026:
- A oportunidade está no pipeline **VENDAS** (`59a4780d-...`), etapa **Negociação FUP-1** (`6bd429b6-...`)
- O trigger corrigido procurou regras com `pipeline_id = 59a4780d-...` e `stage_id = 6bd429b6-...`
- Encontrou **zero regras** porque todas têm `pipeline_id = d1b68a0f-...-sales-1` (PRÉ-VENDAS)
- Resultado: nenhuma execução criada (comportamento correto do trigger, faltam as regras)

O trigger está funcionando corretamente. O que falta são **regras de automação para o pipeline VENDAS**.

## Plano: Criar regras de automação para VENDAS

Criar 8 regras `activity_completed` para o pipeline VENDAS, replicando o padrão do PRÉ-VENDAS:

```text
Regra 1: VENDAS: FUP-1 → FUP-2 (stage 6bd429b6 → cb5a151b)
  - move_stage para FUP-2
  - criar WhatsApp, Email, Ligação

Regra 2: VENDAS: FUP-2 → FUP-3 (stage cb5a151b → 7ae71536)
Regra 3: VENDAS: FUP-3 → FUP-4 (stage 7ae71536 → 5baf2f3a)
Regra 4: VENDAS: FUP-4 → FUP-5 (stage 5baf2f3a → 1f21821d)
Regra 5: VENDAS: FUP-5 → FUP-6 (stage 1f21821d → 29a73410)
Regra 6: VENDAS: FUP-6 → FUP-7 (stage 29a73410 → c107ec6e)
Regra 7: VENDAS: FUP-7 → Pré-Aprovação (stage c107ec6e → fee549f1)
Regra 8: VENDAS: Proposta na Mesa → FUP-1 (stage 29ac03c4 → 6bd429b6)
```

Cada regra terá 4 ações idênticas ao padrão PV:
1. `move_stage` para a próxima etapa
2. `create_activity` WhatsApp (dia 0)
3. `create_activity` Email (dia 1)
4. `create_activity` Ligação (dia 1)

### Implementacao

Uma migration SQL que insere 8 registros em `workflow_rules` com:
- `organization_id`: `d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d`
- `trigger_type`: `activity_completed`
- `trigger_config`: `{pipeline_id, stage_id}` do pipeline VENDAS
- `actions`: array com move_stage + 3x create_activity
- `is_active`: true

Nenhuma alteração de código necessaria -- o trigger e o execute-workflow ja suportam tudo, faltavam apenas as regras para o pipeline VENDAS.

