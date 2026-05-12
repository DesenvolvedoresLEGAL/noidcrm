## Diagnóstico

O erro `column "estado" of relation "accounts" does not exist` (HTTP 400 em `rpc/import_prospect_to_pipeline`) acontece porque a função `public.import_prospect_to_pipeline` insere na tabela `accounts` usando a coluna `estado`, mas a coluna real chama-se `uf`.

Confirmado no schema:
- `accounts` tem: `cidade`, `uf`, `inscricao_estadual` (não existe `estado`).
- A função (migration `20260430154305`) faz:
  ```sql
  INSERT INTO accounts (... cidade, estado, segmento, ...)
  VALUES (... v_prospect.city, v_prospect.state, v_prospect.industry, ...)
  ```

Resultado: o Kairós dispara o import, a RPC explode no INSERT, nenhuma conta/oportunidade é criada no funil pré-vendas.

## Fix

Migration única recriando `public.import_prospect_to_pipeline` com a única alteração necessária: trocar `estado` por `uf` no INSERT em `accounts`. Restante da função é mantido idêntico (mesma assinatura, mesmas variáveis, mesma lógica de matching de conta, sync de contatos, criação de oportunidade, nota e e-mail).

## Validação

1. Reproduzir o import a partir do Kairós (botão "Importar pro CRM" na empresa enriquecida) e confirmar que retorna `200` com payload contendo `account_id` e `opportunity_id`.
2. Conferir que a oportunidade aparece na 1ª etapa do pipeline `pre_sales` / pré-vendas.
3. Conferir que a conta foi criada com `uf` preenchido a partir de `prospects.state`.

## Riscos

- Baixíssimos. É só renomear a coluna no INSERT da função; nenhuma outra parte do sistema lê `accounts.estado` (não existe).
- `SECURITY DEFINER` e `SET search_path = public` mantidos — sem mudança de superfície de segurança.
- Nenhum efeito em prospects já importados.

## Arquivos

- Nova migration: `CREATE OR REPLACE FUNCTION public.import_prospect_to_pipeline(...)` com a correção.
