## Diagnóstico

Hoje, na aba **Rede** da oportunidade (`OpportunityGraphSignals.tsx`), só existe UI para marcar **Champion** (botão estrela). Não há botão para marcar **Decisor**, mesmo já existindo as funções `setOpportunityDecisionMaker` / `removeOpportunityDecisionMaker` importadas mas **não conectadas a nenhum botão**.

### Conceitos (precisam ficar claros na UI)

- **Champion** = **defensor interno** do deal. É quem te ajuda por dentro, abre portas, dá informação privilegiada, "torce" pelo fechamento. Pode ou não ter poder de decisão. Hoje a UI só diz "Champion" sem explicar.
- **Decisor (Decision Maker)** = quem **assina / aprova** a compra. Pode ser o mesmo que o champion, mas geralmente é outra pessoa (Diretor, CEO, Sócio, Head…).
- **Influenciador** ≠ champion. Influenciador opina mas não decide nem defende. Hoje não temos esse papel explícito — o NRHS não cobra ele.

### Como o NRHS decide se tem Decisor (`decision-maker-checker.ts`)

Em ordem de prioridade:
1. `graph_edges` do tipo `decision_maker` (atribuição explícita — é o que o botão novo vai gravar)
2. `deal_participants.role = 'decision_maker'`
3. Cargo do contato bate com lista (`diretor`, `gerente`, `ceo`, `owner`, `sócio`, `presidente`, `head`, `c-level`, `vp`, `vice-presidente`, `superintendente`)

Ou seja: hoje, se o contato **não** tem um desses cargos e não foi marcado manualmente em lugar nenhum, o NRHS cobra "Decisor não identificado" e não há UI para resolver. É exatamente o que está acontecendo no print da MATTOS FILHO (Karoline, cargo "Marketing").

---

## Plano

### 1. Adicionar botão "Marcar como Decisor" na aba Rede

Em `src/components/graph/OpportunityGraphSignals.tsx`, dentro da lista **Stakeholders Mapeados**, ao lado do botão estrela (Champion), adicionar um segundo botão com ícone `Target` (alvo) para marcar/desmarcar **Decisor**. Mesmo padrão de toggle do Champion:

- Se ainda não é decisor → `setOpportunityDecisionMaker(opportunityId, contact.entity_id)`
- Se já é decisor → `removeOpportunityDecisionMaker(opportunityId)`
- Toast + refetch do grafo + invalidação de `opportunity-network-summary`, `nrhs` e `nrhs-analytics` para o card Revenue Hygiene recalcular na hora.

### 2. Tornar Champion vs Decisor visualmente óbvio

- Tooltips explicativos nos dois botões:
  - **Estrela amarela** → "Champion: defensor interno do negócio"
  - **Alvo azul** → "Decisor: quem aprova a compra"
- Manter os badges atuais (Champion / Decision Maker) já existentes na linha de cada contato.
- Permitir que o mesmo contato seja **Champion e Decisor** ao mesmo tempo (ambos os botões podem ficar ativos).

### 3. Atualizar o card "Decisor não identificado" (bloco superior da Rede)

O bloco "Decisor não identificado" / "Decision Maker" já existe mais acima na mesma tela. Adicionar ali um CTA secundário **"Selecionar decisor"** que rola a página para a lista de Stakeholders Mapeados (ou abre um popover de seleção rápida entre os contatos existentes), pra fechar o loop visual com o que o NRHS está cobrando.

### 4. Recalcular NRHS após marcação

Depois de `setOpportunityDecisionMaker`, disparar `calculate-nrhs` (mesmo padrão usado em `useNRHS.recalculate`) para que o pilar **Mapeamento de Stakeholders** suba de 10 → para a pontuação correta sem o usuário precisar clicar em "Atualizar".

### 5. Documentar no tooltip do pilar NRHS

No `NRHSBreakdown.tsx`, no item `decisor`, adicionar texto curto:
> "Marque o decisor no menu **Rede** da oportunidade, no botão alvo (🎯) ao lado de cada contato."

---

## Fora de escopo (não mexer agora)

- Não alterar a lógica de fallback por cargo no `decision-maker-checker.ts` — continua valendo como detecção automática.
- Não criar campo novo em `contacts` (ex.: `is_decision_maker` global) — decisor é **por oportunidade**, via `graph_edges`, e isso já está certo arquiteturalmente.
- Não tocar em `deal_participants`.
- Sem migração de banco.

---

## Arquivos impactados

- `src/components/graph/OpportunityGraphSignals.tsx` (adicionar botão Decisor + tooltips + recalc NRHS)
- `src/components/nrhs/NRHSBreakdown.tsx` (tooltip orientando o usuário) — opcional, pequeno

## Riscos

- **Baixo.** As funções `setOpportunityDecisionMaker` / `removeOpportunityDecisionMaker` já existem, testadas, e gravam em `graph_edges` (multi-tenant safe via RLS já existente). O `decision-maker-checker` já lê dessa fonte como prioridade 1.
