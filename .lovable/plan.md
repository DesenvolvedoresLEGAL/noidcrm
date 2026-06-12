# Sprint 2 — Score de Qualificação

Score de qualificação 0–100, calculado em tempo real a partir dos valores do **Checklist Obrigatório de Qualificação** (formulário criado no Sprint 1). Apenas frontend — nenhuma alteração no banco, RLS ou serviços de revenue.

## 1. Lib pura de cálculo

**Novo:** `src/lib/qualification/qualificationScore.ts`

Função `computeQualificationScore(values: Record<string, any>, ctx: { hasAccount: boolean; hasContact: boolean })` que recebe valores **indexados por `field_key` semântico** (nome_evento, data_evento, local_evento, conexoes_simultaneas, equipamentos, finalidade_uso, urgencia_real, poder_decisao, proximo_passo, permissao_proposta) e retorna:

```ts
{
  total: number,           // 0-100
  breakdown: { key: string; label: string; got: number; max: number }[],
  classification: { tier: 'cold'|'developing'|'sql_weak'|'sql_valid'|'sql_priority'; label: string; colorClass: string },
  blockers: string[],      // campos faltantes p/ ir a Vendas
  canMoveToSales: boolean, // score≥75 && checklist completo && permissao_proposta válida
}
```

Regras exatas conforme briefing (Evento 7+7+6, Demanda 8+6+6, Data&Local 8+7, Urgência/Poder/Próximo passo/Permissão por enum). `permissao_proposta` válida = `cliente_pediu_proposta | cliente_validou_escopo | cliente_confirmou_interesse`.

Classificação:
- 0–39 Frio (cinza)
- 40–59 Em desenvolvimento (amarelo)
- 60–74 SQL fraco (laranja)
- 75–89 SQL válido (azul)
- 90–100 SQL prioritário (roxo)

Testes unitários `qualificationScore.test.ts` para cada faixa e parciais.

## 2. Hook de score

**Novo:** `src/hooks/useOpportunityQualificationScore.ts`

- Recebe `opportunityId`, `account`, `contact`.
- Carrega o formulário do funil **PRÉ VENDAS** via `useCustomFormsByPipeline` (já existente) e seleciona aquele cujo nome começa com "Checklist Obrigatório de Qualificação" (fallback: primeiro form `entity_type=opportunity` desse pipeline).
- Carrega `custom_form_values` via `useCustomFormValues`.
- Carrega metadata dos `custom_fields` (id → field_key) para traduzir field IDs salvos → chaves semânticas.
- Compõe `valuesByKey` e chama `computeQualificationScore`. Inclui `nome_empresa` (= `account.nome_fantasia/razao_social`) e `nome_contato` (= `contact.nome`) para o checklist obrigatório de bloqueio.
- Retorna `{ score, classification, breakdown, blockers, canMoveToSales, isLoading }`.

> Reativo: como o save do checklist invalida `custom-form-values`, o score recalcula sozinho.

## 3. UI — Bloco "Score de Qualificação"

**Novo:** `src/components/opportunity/qualification/QualificationScoreCard.tsx`

- Header com título "Score de Qualificação", número grande `XX/100`, barra de progresso (`Progress` shadcn), badge de classificação colorida.
- Lista colapsável (default fechada) com breakdown por critério (`got/max`).
- Quando `canMoveToSales=false` em pipeline sales, mostra mini-aviso "Faltam X itens para liberar Vendas".

**Pontos de exibição:**
1. **Topo da aba Formulários** — `OpportunityFormsTab.tsx` renderiza o card antes da lista de forms (apenas quando o pipeline atual é `qualification`).
2. **Sidebar da oportunidade** — `OpportunitySidebar.tsx`: versão compacta (apenas número + badge) com link para a aba Formulários.

Sem nova rota; sem nova seção/tab dedicada (mantém escopo mínimo).

## 4. Bloqueio de passagem para Vendas

**Novo:** `src/components/opportunity/qualification/QualificationGateModal.tsx`

Modal de aviso "Lead ainda não pode ir para Vendas" com:
- Texto fixo do briefing.
- Lista de pendências (`blockers` do hook), incluindo "Score < 75 (atual: NN)" se aplicável.
- Botão único "Voltar para qualificação" que fecha o modal.

**Editar `src/components/opportunity/EditOpportunityModal.tsx`:**
- No `onSubmit`, antes de chamar `onSave`, comparar `opportunity.pipeline?.pipeline_type` original vs `selectedPipeline.pipeline_type`. Se origem `qualification` e destino `sales`, invocar o gate (cálculo síncrono via lib + valores já fetchados pelo hook injetado por context/prop).
- Se `!canMoveToSales`, abrir `QualificationGateModal` e abortar o submit.

**Edge cases fora de escopo (sprint futuro):**
- Drag-and-drop direto no Kanban entre funis.
- Handoff via `duplicateOpportunity`.
> Sinalizo no PR; o caminho oficial pelo modal de edição já cobre o fluxo prescrito pelo briefing.

## 5. Arquivos

**Novos**
- `src/lib/qualification/qualificationScore.ts`
- `src/lib/qualification/qualificationScore.test.ts`
- `src/hooks/useOpportunityQualificationScore.ts`
- `src/components/opportunity/qualification/QualificationScoreCard.tsx`
- `src/components/opportunity/qualification/QualificationGateModal.tsx`

**Editados**
- `src/components/opportunity/OpportunityFormsTab.tsx` — render do card no topo.
- `src/components/opportunity/OpportunitySidebar.tsx` — badge compacto.
- `src/components/opportunity/EditOpportunityModal.tsx` — gate antes do save.

## 6. Riscos

- **Mapeamento de field_key.** Depende dos `field_key` semânticos cravados no Sprint 1. Se o organizador renomeá-los, o score zera silenciosamente — adicionar log dev e seção "Sem dados de checklist" quando nada bater.
- **Outros funis de qualificação.** A regra aplica genericamente a `pipeline_type='qualification'`; só dispara o card se existir form com os keys esperados.
- **Sem mudanças em revenue/forecast/closed_at.** Apenas presentation + validation client-side.

## 7. Validação

- Abrir oportunidade do funil PRÉ VENDAS → card aparece, score reage a cada save do checklist.
- Tentar mover para VENDAS com score <75 → modal bloqueia.
- Cumprir checklist + score ≥75 → modal não aparece, save procede.
- Pipeline não-qualification → card não aparece, gate não dispara.
