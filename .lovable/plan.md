# Sprint 1 — Checklist Obrigatório de Qualificação

Adaptar o formulário existente **"Checklist de Locação"** (form id `55fa0451-...`, org `d1b68a0f-...`) para se tornar o **Checklist Obrigatório de Qualificação**, com os 12 campos obrigatórios da pré-venda, vinculado exclusivamente ao funil **PRÉ VENDAS** (`d1b68a0f-...-sales-1`).

Apenas configuração de dados (migração) + um pequeno ajuste de UI para a regra condicional do campo 12. Sem mudanças em lógica de negócio.

## 1. Migração SQL (única transação)

### 1.1 Renomear o formulário e vincular ao funil
- `UPDATE custom_forms SET name = 'Checklist Obrigatório de Qualificação', pipeline_ids = ARRAY['d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d-sales-1'] WHERE id = '55fa0451-eadf-43f5-abe5-ae02a85af95c';`

### 1.2 Criar/atualizar custom fields (entity_type='opportunity')
Reaproveitar quando o `field_key` já existe; criar quando faltar. Todos com `is_required = true`.

| # | field_key | label | field_type | options |
|---|-----------|-------|------------|---------|
| 3 | `nome_evento` | Nome do evento | text | — |
| 4 | `data_evento` | Data do evento | date | — |
| 5 | `local_evento` | Local do evento | text | — |
| 6 | `conexoes_simultaneas` | Quantidade de conexões simultâneas | number | — |
| 7 | `equipamentos` | Equipamentos que deseja conectar | multi_select | notebook, celular, tablet, totem, máquina de cartão, sistema de credenciamento, TV, câmera, PDV, outro |
| 8 | `finalidade_uso` | Finalidade de uso | multi_select | vendas no stand, geração de leads, credenciamento, transmissão ao vivo, demonstração de produto, operação interna, pagamento/POS, sistema próprio, backup de internet, outro |
| 9 | `urgencia_real` | Urgência real | select | Evento em até 3 dias / 4 a 9 dias / 10 a 20 dias / 21 a 30 dias / acima de 30 dias / Sem data definida |
| 10 | `poder_decisao` | Poder ou influência na decisão | select | Decisor final / Influenciador direto / Comprador/financeiro / Usuário técnico / Apenas pesquisando / Não identificado |
| 11 | `proximo_passo` | Próximo passo combinado | select | Enviar proposta / Agendar reunião / Validar escopo / Validar orçamento / Aguardar retorno do cliente / Sem próximo passo |
| 11b | `proximo_passo_obs` | Observação do próximo passo | textarea | — (não obrigatório) |
| 12 | `permissao_proposta` | Permissão real para proposta | select | Cliente pediu proposta / Cliente validou escopo e pediu preço / Cliente confirmou interesse real / SDR está sugerindo proposta sem pedido claro / Não houve permissão para proposta |

Estratégia: `INSERT ... ON CONFLICT (organization_id, entity_type, field_key) DO UPDATE` para idempotência. Onde já existir (`nome_evento`, `data_evento`→atualmente `dataevent`, `conexoes_simultaneas`, `equipamentos`, `finalidade_uso`), apenas garantir `is_required=true` e atualizar `options` para os enums acima. Os campos antigos não relacionados ao checklist (`briefing`, `frete_pedido`, `tamanho_espaco`, `dataentrega`, `dataretira`, `data_pagamento`, `ambiente`) permanecem em `custom_fields` (não removidos), mas saem do JSON `fields` do formulário.

Nota: o campo atual `dataevent` será mantido como legado; o checklist usará o novo `data_evento`. (Alternativa: renomear `field_key`. Como há valores históricos em `custom_field_values`, prefiro criar o novo `data_evento` para não quebrar dados antigos.)

### 1.3 Reconstruir `custom_forms.fields` (JSONB) na ordem do checklist
Array em ordem 0…12 com:
- itens 1 e 2 reaproveitando os nativos já usados: `native-account-nome_fantasia` (Nome da empresa) e `native-contact-nome` (Nome do contato), ambos `is_required: true`.
- itens 3…12 referenciando os `custom_fields` (source `custom`, `entity_source: opportunity`), todos `is_required: true`.

## 2. Front-end (mínimo)

### 2.1 Regra condicional do campo 12
Em `src/components/opportunities/CustomFormRenderer.tsx` (ou equivalente que renderiza `custom_forms`), adicionar lógica: quando `proximo_passo === 'Enviar proposta'`, marcar `permissao_proposta` como obrigatório no validador (independente do `is_required` salvo). Já é obrigatório por padrão, mas a regra cobre futuras alterações.

Adicionar também validação no submit: se `permissao_proposta` ∈ {"SDR está sugerindo proposta sem pedido claro", "Não houve permissão para proposta"} e o usuário tentar mover a oportunidade para o funil VENDAS, bloquear com toast informativo. (Apenas regra de UI no handoff — sem alterar fluxo oficial de movimentação.)

> Se preferir manter o sprint estritamente configuracional, removo o bloqueio de handoff e deixo apenas para um sprint futuro.

### 2.2 Nenhuma outra mudança
- Sem mudar serviços de revenue, sem tocar RLS, sem novas tabelas.
- Form continua sendo lido pelos hooks existentes `useCustomForms` / `useCustomFormValues`.

## 3. Riscos & validação
- **Risco:** dados históricos preenchidos como `dataevent`/`evento` (label "Endereço Entrega/Retirada" no field_key `evento` 😬) — não serão tocados; novo `data_evento`/`local_evento` começam vazios.
- **Validação:** após a migração, abrir uma oportunidade do funil PRÉ VENDAS e confirmar que o formulário aparece com os 12 itens na ordem, todos marcados como obrigatórios; e que o formulário **não** aparece em oportunidades de outros funis.

## 4. Entregáveis
- 1 migração SQL idempotente.
- 1 pequeno patch em `CustomFormRenderer` para a regra condicional do item 11→12 (opcional o bloqueio de handoff).
- Nenhum outro arquivo alterado.
