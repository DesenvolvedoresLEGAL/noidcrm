

# Correção: Automações em cascata ao concluir atividade

## Problema identificado

Quando uma atividade é concluída, o sistema cria execuções para **TODAS** as 7 regras de workflow "PV: Avançar + Orquestrar" (1a→2a, 2a→3a, ..., 6a→7a), em vez de executar apenas a regra correspondente à etapa atual da oportunidade.

**Causa raiz:** O trigger de banco `check_workflow_on_activity_change` não verifica o `stage_id` da oportunidade ao criar as execuções. Ele apenas filtra por `activity_type`, ignorando completamente o `trigger_config.stage_id` e `trigger_config.pipeline_id` das regras.

```text
Trigger atual (quebrado):
  Atividade concluída → busca TODAS as regras activity_completed → cria execução para CADA uma
  
Trigger correto:
  Atividade concluída → busca regras activity_completed → 
    filtra por stage_id da oportunidade → cria execução apenas para a regra da etapa atual
```

## Plano de correção

### 1. Corrigir o trigger `check_workflow_on_activity_change` (migration SQL)

Adicionar JOIN com a tabela `opportunities` para comparar o `stage_id` atual da oportunidade com o `trigger_config->>'stage_id'` da regra. Também verificar `pipeline_id`. Adicionar anti-duplicação igual ao trigger de oportunidade.

### 2. Adicionar validação de segurança no `execute-workflow` (edge function)

No `execute-workflow/index.ts`, antes de executar as ações de um workflow `activity_completed`, verificar se a oportunidade ainda está na etapa configurada na regra. Se não estiver, marcar como `skipped` em vez de executar. Isso funciona como segunda barreira caso o trigger falhe.

### 3. Limpar execuções pendentes inválidas

Na mesma migration, marcar como `failed` todas as execuções pendentes de `activity_completed` que foram criadas incorretamente (onde o `stage_id` da oportunidade não corresponde ao `trigger_config` da regra).

### Arquivos alterados

- **Nova migration SQL** -- corrige o trigger e limpa dados
- **`supabase/functions/execute-workflow/index.ts`** -- validação de stage antes de executar

### Detalhes técnicos

```sql
-- Trigger corrigido (pseudo-SQL)
INSERT INTO workflow_executions (...)
SELECT wr.id, ...
FROM workflow_rules wr
WHERE wr.trigger_type = 'activity_completed'
  AND wr.is_active = true
  AND wr.organization_id = NEW.organization_id
  -- FILTRO CRÍTICO QUE FALTAVA:
  AND (wr.trigger_config->>'stage_id' IS NULL 
       OR wr.trigger_config->>'stage_id' = (
         SELECT o.stage_id FROM opportunities o WHERE o.id = NEW.opportunity_id
       ))
  AND (wr.trigger_config->>'pipeline_id' IS NULL
       OR wr.trigger_config->>'pipeline_id' = (
         SELECT o.pipeline_id FROM opportunities o WHERE o.id = NEW.opportunity_id
       ))
  -- Anti-duplicação
  AND NOT EXISTS (
    SELECT 1 FROM workflow_executions we
    WHERE we.workflow_rule_id = wr.id
      AND we.opportunity_id = NEW.opportunity_id
      AND we.status IN ('pending', 'running')
      AND we.trigger_type = 'activity_completed'
  );
```

