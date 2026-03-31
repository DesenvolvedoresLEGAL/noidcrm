

# Reestruturar Modal de Perda: Macro → Motivo Específico + Campos Inteligentes

## Contexto
O modal atual tem problemas: fatores redundantes (duplicam o motivo), comentário opcional (perde contexto), e motivo solto sem hierarquia. A tabela `loss_reasons` já tem uma coluna `category` com valores `price`, `competition`, `timing`, `product`, `relationship`, `internal`, `other` — vamos usá-la como **Macro Motivo**.

## Alterações

### 1. Migration SQL — Novos campos
- `opportunities.loss_accountability TEXT` — Responsável pela perda (`client`, `competition`, `us`)
- `opportunities.is_recoverable TEXT` — Recuperável? (`yes`, `no`, `maybe`)
- `win_loss_records.loss_accountability TEXT`
- `win_loss_records.is_recoverable TEXT`
- Garantir que todas as `loss_reasons` tenham `category` preenchido (seed dos macros padronizados se necessário)

### 2. `src/components/opportunity/LossReasonModal.tsx` — Nova estrutura
Reformular completamente o modal:

**Ordem dos campos:**
1. **Macro Motivo** (obrigatório) — Select com as categorias: Preço/Valor, Concorrência, Timing/Prioridade, Operacional Cliente, Erro Interno, Sem Fit, Processo Comercial
2. **Motivo Específico** (obrigatório) — Select que filtra `loss_reasons` pela `category` selecionada no macro
3. **Concorrente** — Input que só aparece se macro = `competition`
4. **Responsável pela perda** (obrigatório) — Radio/Select: Cliente | Concorrência | Nós
5. **Recuperável?** (obrigatório) — Radio/Select: Sim | Não | Talvez
6. **Diagnóstico da perda** (obrigatório, mín. 100 caracteres) — Textarea com contador de caracteres

**Remover:** checkboxes de Preço/Timing/Features/Relacionamento (fatores)

Atualizar `LossDetails` interface para incluir `macroCategory`, `lossAccountability`, `isRecoverable` e remover os factor booleans.

### 3. `src/services/supabase/opportunities.ts` — Persistir novos campos
- `markOpportunityAsLost`: salvar `loss_accountability` e `is_recoverable` na oportunidade
- `win_loss_records` insert: salvar `loss_accountability` e `is_recoverable`, derivar os factor booleans da `category` para manter compatibilidade com análises existentes (ex: category=price → `price_factor=true`)
- Tornar `comment` obrigatório no tipo

### 4. `src/pages/OpportunityDetail.tsx` — Ajustar chamada
Passar os novos campos do modal para a mutation.

### 5. `src/pages/settings/WinLossReasons.tsx` — Exibir categoria
Adicionar coluna "Categoria" na tabela de motivos para o admin ver o agrupamento macro de cada motivo.

### 6. `src/components/settings/LossReasonModal.tsx` (Settings)
Adicionar campo "Categoria/Macro" no cadastro do motivo, para o admin definir a qual macro cada motivo pertence.

## Compatibilidade
- Os factor booleans (`price_factor`, `timing_factor`, etc.) continuam sendo gravados no `win_loss_records` de forma derivada da category, para não quebrar o Win/Loss Hub, edge functions de análise, e SmartAlerts que leem esses campos.
- Motivos existentes já possuem `category` preenchido pela migration anterior.

## Arquivos (6)
1. Migration SQL
2. `src/components/opportunity/LossReasonModal.tsx` — rewrite completo
3. `src/services/supabase/opportunities.ts` — novos campos
4. `src/pages/OpportunityDetail.tsx` — ajustar mutation
5. `src/pages/settings/WinLossReasons.tsx` — coluna categoria
6. `src/components/settings/LossReasonModal.tsx` — campo categoria no cadastro

