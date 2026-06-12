## Sprint 5 — UI/UX: Bloco "Qualificação Comercial"

### Objetivo
Transformar o atual `QualificationScoreCard` (que só mostra score + barra + detalhamento collapsável) num bloco comercial completo chamado **Qualificação Comercial**, exibindo numa única visão: score, classificação, status de handoff, campos completos, campos pendentes e próxima ação recomendada.

### O que muda

1. **Renomear o bloco** de "Score de Qualificação" para **"Qualificação Comercial"** (subtítulo continua "Baseado no Checklist Obrigatório").

2. **Nova função pura** `src/lib/qualification/qualificationRecommendation.ts`:
   - `getQualificationRecommendation(result, ctx)` → retorna `{ title, description }` baseado em prioridade dos blockers e tier:
     - Sem permissão válida → "Validar decisor e combinar próximo passo antes de enviar para Vendas."
     - Sem `poder_decisao` → "Identificar o decisor real antes de avançar."
     - Sem `proximo_passo` → "Combinar próximo passo claro com o lead."
     - Sem urgência/data/local → "Mapear evento (data, local e urgência) para qualificar."
     - Sem demanda (conexões/finalidade) → "Detalhar a demanda técnica do evento."
     - Sem account/contact → "Cadastrar empresa e contato principal."
     - Score ≥ 75 e sem blockers → "Lead pronto para Vendas. Mover para o próximo funil."
     - Score 60-74 → "Reforçar pontos fracos do checklist para liberar handoff."
     - Score < 60 → "Lead ainda imaturo. Continuar descoberta antes de propor."
   - Testes unitários em `qualificationRecommendation.test.ts`.

3. **Refatorar `QualificationScoreCard.tsx`** (mantém o nome do arquivo e a API `score: UseQualificationScoreReturn`), com novo layout sempre visível (sem collapse no essencial):

   ```
   ┌─ Qualificação Comercial ─────────────────────┐
   │ 🎯 Score 67/100         [Badge: SQL fraco]   │
   │ ███████░░░░░ progress                        │
   │                                              │
   │ Status: ⛔ Não pode ir para Vendas           │
   │  (ou)   ✅ Pronto para Vendas                │
   │                                              │
   │ ✅ Completos (4)         ⚠️ Pendentes (3)    │
   │  • Evento identificado   • Permissão real    │
   │  • Data e local          • Poder de decisão  │
   │  • Demanda clara         • Próximo passo     │
   │  • Urgência                                  │
   │                                              │
   │ 💡 Ação recomendada                          │
   │ Validar decisor e combinar próximo passo… │
   │                                              │
   │ [▾ Ver pontuação detalhada]  (collapse)      │
   └──────────────────────────────────────────────┘
   ```

   - "Completos" = `breakdown` items com `got === max` (label do critério).
   - "Pendentes" = `score.blockers` (lista já calculada no Sprint 2).
   - "Status" deriva de `score.canMoveToSales`.
   - "Ação recomendada" vem do helper novo.
   - O detalhamento por critério (lista got/max) continua existindo, mas vira o único conteúdo do collapse.
   - Sem cores hardcoded — usar tokens semânticos (`text-emerald-600`/`text-amber-600` já em uso, manter padrão atual do arquivo).

4. **Sidebar (`OpportunitySidebar.tsx`)**: o badge compacto `Target {score}/100` permanece. Não duplicar o bloco grande aqui (já fica na aba Formulários). Sem mudanças além de garantir tooltip atualizado com a classificação.

5. **Aba Formulários (`OpportunityFormsTab.tsx`)**: nenhuma mudança estrutural — o card já é renderizado no topo via `<QualificationScoreCard score={qualScore} />`. Ele simplesmente passa a mostrar o conteúdo novo.

### Arquivos impactados
- `src/lib/qualification/qualificationRecommendation.ts` (novo)
- `src/lib/qualification/qualificationRecommendation.test.ts` (novo)
- `src/components/opportunity/qualification/QualificationScoreCard.tsx` (refatorado — mesma API)

### Riscos
- Baixo. Mudança puramente visual + helper puro. `useOpportunityQualificationScore` e a fórmula do Sprint 2 não mudam, então score, gate de handoff (Sprint 2/3) e auditoria (Sprint 4) seguem intactos.
- Sem migração, sem alteração de RLS, sem alteração de hooks/serviços.

### Validação manual
- Lead com score < 60 → bloco mostra "Frio/Em desenvolvimento", status bloqueado, ação de descoberta.
- Lead com score 67 e blockers de permissão/poder/próximo passo → reproduz exemplo do briefing.
- Lead com score ≥ 75 e sem blockers → status "Pronto para Vendas", ação recomendando handoff.
- Collapse "Ver pontuação detalhada" mostra breakdown got/max como antes.
