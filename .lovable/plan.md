

# Copiar Propostas e Dados Completos na Duplicação de Oportunidade

## Problema
Quando a oportunidade é duplicada via workflow (ex: aceite de proposta → duplicação para OPERACIONAL), apenas o histórico (audit_log) e campos customizados são copiados. **Propostas, itens de proposta e arquivos não são transferidos** para a nova oportunidade.

## Solução
Adicionar ao bloco `duplicate` do `execute-workflow/index.ts` a cópia de:

1. **Propostas** — clonar registros da tabela `proposals` vinculados à oportunidade original, apontando `opportunity_id` para a nova oportunidade
2. **Itens de proposta** — clonar `proposal_items` de cada proposta copiada
3. **Arquivos** — clonar registros de `opportunity_files` vinculados à oportunidade original

## Alteração Técnica

**`supabase/functions/execute-workflow/index.ts`** — dentro do bloco `case 'duplicate'`, após a cópia de `custom_field_values` (~linha 499), adicionar:

### Cópia de Propostas + Itens
```
- Buscar todas as proposals onde opportunity_id = source opportunity
- Para cada proposta:
  - Inserir cópia com novo ID, opportunity_id = nova oportunidade, status = 'draft'
  - Buscar proposal_items da proposta original
  - Inserir cópia dos itens apontando para o novo proposal_id
```

### Cópia de Arquivos
```
- Buscar opportunity_files onde opportunity_id = source
- Inserir cópias com entity_id = nova oportunidade
```

### Deploy
- Redeploy da edge function `execute-workflow`

