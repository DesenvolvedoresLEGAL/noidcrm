

# Eliminar Duplicação Automática de Oportunidades no PRÉ VENDAS

## Causa Raiz

Existe um **trigger no banco de dados** chamado `trigger_auto_create_opportunity` que dispara toda vez que uma nova conta (account) é criada. Esse trigger chama a função `auto_create_opportunity_from_account()`, que automaticamente insere uma oportunidade "Lead: [Nome da Empresa]" no pipeline PRÉ VENDAS, no primeiro estágio (Lead Captado).

Quando o time comercial cria uma oportunidade em outro funil (OPERACIONAL, VENDAS, etc.) e precisa criar uma nova conta no processo, o trigger gera uma cópia indesejada no PRÉ VENDAS — causando a duplicação que atrapalha o operacional.

## Alterações

### 1. Remover o trigger de auto-criação (migração SQL)
- `DROP TRIGGER trigger_auto_create_opportunity ON public.accounts`
- `DROP FUNCTION auto_create_opportunity_from_account()`

Isso elimina permanentemente a duplicação. A função `ingest-lead` já cuida de criar oportunidades quando leads entram pelo canal de ingestão (API, formulário, import CSV), então o trigger é redundante.

### 2. Limpar as oportunidades "Lead:..." duplicadas do PRÉ VENDAS
Soft-delete (marcar `deleted_at`) todas as oportunidades que:
- Título começa com "Lead:"
- Estão no pipeline PRÉ VENDAS
- Possuem `status = 'open'`
- A conta já tem outra oportunidade ativa em outro pipeline

Para oportunidades "Lead:" que **não** têm correspondência em outro pipeline (leads genuínos), elas serão mantidas.

### Resultado
- Criar oportunidades em qualquer pipeline **nunca mais** gera cópia no PRÉ VENDAS
- O pipeline PRÉ VENDAS fica limpo — apenas leads genuínos permanecem
- O `ingest-lead` continua funcionando normalmente para leads que entram via API/formulário

