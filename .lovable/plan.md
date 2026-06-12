## Verificação final — Sprints 1 a 5 vs. critério de aceite

Não há código novo a escrever: a mensagem é a régua final do épico. Abaixo, status de cada critério mapeado para o que já existe no projeto após Sprints 1-5.

### Critérios de aceite

| # | Critério | Status | Onde mora |
|---|----------|--------|-----------|
| 1 | Formulário aparece como **Checklist Obrigatório de Qualificação** | ✅ | Custom form criado no Sprint 1; resolvido em `useOpportunityQualificationScore` por nome (`checklist obrigatório de qualificação`). |
| 2 | Campos obrigatórios disponíveis e salvando | ✅ | `custom_fields` (entity_type=opportunity) + `custom_form_values` via fluxo padrão do CRM. |
| 3 | Score calculado automaticamente | ✅ | `src/lib/qualification/qualificationScore.ts` + hook `useOpportunityQualificationScore`. |
| 4 | Classificação aparece na oportunidade | ✅ | `QualificationScoreCard` (aba Formulários) + badge na `OpportunitySidebar`. |
| 5 | Lead com score < 75 não pode ir para Vendas | ✅ | Gate em `EditOpportunityModal.tsx` + `QualificationGateModal`. |
| 6 | Botão **Perdeu** abre modal de desqualificação no Pré-vendas | ✅ | Roteamento por `pipeline_type === 'qualification'` em `OpportunityDetail.tsx` → `DisqualifyLeadModal`. |
| 7 | Oportunidade perdida movida para **Desqualificado** | ✅ | `disqualifyPreSalesOpportunity` em `src/services/crm/disqualify.ts`. |
| 8 | Oportunidade duplicada no funil **Remarketing** | ✅ | Mesmo serviço, com flag `createRemarketing`, preservando account/contact/`custom_form_values`. |
| 9 | Sem duplicação repetida no Remarketing | ✅ | `findActiveRemarketingDuplicate` antes de criar; UI desabilita o toggle e mostra link quando já existe. |
| 10 | Tudo registrado no histórico | ✅ | `timeline-logger.ts`: `qualification_score_updated`, `lead_disqualified`, `sales_handoff_blocked`. |

### Regras de não-regressão (preservadas)

- **Propostas / Vendas / Forecast / OTE / Revenue / Win-Loss**: nenhuma das mudanças tocou `proposals`, `commercial_won_revenue_view`, `forecast_*`, `ote_*`, `win_loss_records`, `commission_*`. As receitas continuam saindo da SSoT (`commercial_won_revenue_view` / `valid_revenue_amount`).
- **Win/Loss em Vendas**: o roteamento por `pipeline_type` mantém o fluxo legado (`LossReasonModal`) intacto para `sales`; só `qualification` cai no novo modal.
- **`closed_at` imutável**: o serviço de desqualificação respeita o trigger existente — não sobrescreve `closed_at`.
- **Título uppercase** (`trg_opportunity_title_upper`): a duplicação para Remarketing herda o título e o trigger normaliza sem ação extra.
- **Campos personalizados**: nenhum `custom_field` foi removido ou renomeado; a leitura mapeia UUID → `field_key` via `custom_fields` (entity_type=opportunity).
- **RLS / multi-tenant**: serviço e hook usam `supabase` autenticado; nenhuma policy foi alterada; novas colunas em `opportunities` (Sprint 3) são lidas/escritas apenas por usuários da org via as policies existentes.

### Itens recomendados como follow-up (fora do escopo desta sprint, opcional)

1. **Smoke test manual de regressão** com checklist abaixo no ambiente de preview:
   - Editar checklist → ver bloco "Qualificação Comercial" atualizar score em tempo real.
   - Tentar mover < 75 para Vendas → bloqueado + evento `sales_handoff_blocked` no histórico.
   - Atingir ≥ 75 com checklist completo → mover liberado.
   - Clicar **Perdeu** em Pré-vendas → `DisqualifyLeadModal`; em Vendas → `LossReasonModal` (não regrediu).
   - Desqualificar com Remarketing ON → cria deal espelho; repetir → segundo deal não criado, link aparece.
   - Conferir 3 tipos de eventos na aba Histórico.
2. **Backfill opcional** (não obrigatório): rodar uma query de leitura em `opportunities` do pipeline de qualificação para recalcular score on-demand quando a oportunidade for aberta — já é o comportamento atual via hook, então nenhum job é necessário.

### Conclusão

Sprints 1-5 atendem 10/10 critérios de aceite sem violar nenhuma regra de Propostas, Vendas Realizadas, Forecast, OTE, Win/Loss ou Revenue Command. Nenhuma alteração adicional de código é necessária — recomendo apenas validar via o smoke test acima antes de fechar o épico.
