
# Sprint 6.7: Finalização e Homologação do Dashboard Comercial

Sprint de **polimento, auditoria e homologação**. Zero migrations, zero novas RPCs (a auditoria/reconciliação são derivadas no frontend a partir dos dados que o `crm_get_closer_dashboard_data` já retorna). Mantém todas as keys técnicas (`closer`, `dashboard_type='closer'`, `business_function_key='closer'`).

## Estratégia

A maior parte das informações pedidas (auditoria, reconciliação, checklist) é **derivada do payload já existente** + observabilidade já existente. Não precisamos criar novas fontes — apenas apresentar o que já temos com mais clareza.

## Mudanças

### 1. Polimento da UI do Dashboard Comercial (`src/components/dashboard/closer/`)

**`CloserDashboard.tsx`** — reorganizar e adicionar botão "Atualizar":
- Cabeçalho ganha botão **"Atualizar dashboard"** (chama `query.refetch()` + `paceQuery.refetch()`).
- Reorganiza para ordem definitiva: Central do Dia → Pace Diário → Top 10 ações → Propostas que exigem ação (agrupadas em Tabs) → Follow ups e atividades (agrupadas) → Deals em risco → KPIs comerciais → Feedback.
- Melhora copy do alerta de widgets indisponíveis.

**`CentralDoDiaSection.tsx`** — copy clara e estado vazio agregado:
- Tooltip por card com a descrição dos textos do enunciado (Atividades de hoje, Follow ups vencidos etc.).
- Quando `Σ counts === 0`: mensagem **"Nada crítico para agora. Revise o pipeline e busque novas oportunidades de avanço."**

**`CloserPaceSection.tsx`** — proteções e tooltip de regra:
- Substituir `pace_gap_value ?? 0` por proteções explícitas (meta nula/zero, dia útil zero, realizado > meta).
- Tooltip junto ao título do Pace: **"Cálculo baseado em dias úteis de segunda a sexta, sem feriados nesta versão."** (usa `pace.business_days_rule` se vier do backend).
- Subtítulo já está correto.

**`CloserTopActions.tsx`**:
- Título "Top 10 ações do dia" mantido; subtítulo passa para **"As 10 prioridades comerciais de hoje, em ordem de impacto."**.
- Garante CTA seguro (já há fallback disabled+tooltip via `buildCloserCtaHref`).
- Quando `actions.length === 0`: **"Sem ações prioritárias agora. Bom momento para prospectar."**

**Nova `CloserProposalsActionGroup.tsx`** — agrupa em Tabs (`@/components/ui/tabs`) as 4 listas de propostas:
- Vencendo hoje, Vencendo em 48h, Vencidas, Visualizadas sem follow up.
- Empty geral: **"Nenhuma proposta exigindo ação agora."**

**Nova `CloserActivitiesGroup.tsx`** — agrupa Agenda de hoje + Follow ups vencidos lado a lado.
- Empty: **"Nenhuma atividade agendada para hoje."**

**`CloserRiskDealsList.tsx`** — manter, com tooltip explicando o cálculo de risco:
**"Risco calculado por sinais comerciais como silêncio, proposta sem resposta, follow up vencido ou tempo parado na etapa."**

**`CloserPeriodFilter.tsx`** — adiciona tooltip com regra de período:
**"Central do Dia usa o dia atual. Pace Diário usa a meta mensal. Os demais indicadores respeitam o período selecionado quando aplicável."**

**Empty/Error states** — atualizar copy de:
- `CloserDashboardEmptyState.tsx`
- `CloserDashboardErrorState.tsx` (mensagem segura, sem stack trace)

### 2. Feedback Card aprimorado (`CloserDashboardFeedbackCard.tsx`)

- Renomeia label do `missing_info` para **"O que faltou para esse dashboard virar sua tela principal?"**.
- Adiciona chips opcionais (que pré-preenchem o textarea ou são salvos em `metadata.missing_categories[]`):
  Mais clareza nas propostas / Mais clareza nas atividades / Melhor cálculo do pace / Mais velocidade / CTAs melhores / Outra informação.

### 3. Auditoria de dados (Admin Center)

Sprint não cria RPC. Em vez disso, criamos um **service derivado client-side** que chama o mesmo `getCloserDashboardData` para o usuário piloto selecionado e classifica cada métrica em: `validated` (tem dados ou contagem ≥ 0), `empty` (zero — pode ser legítimo), `unavailable` (vem de `availability` como `unavailable`).

**Novo:** `src/services/crm/closerDashboardAudit.ts`
- Função `auditCommercialDashboard(tenantId, userId)` → roda `getCloserDashboardData` + `getCloserPaceData` e retorna lista de métricas com fonte, status, observação e ação recomendada.

**Novo:** `src/components/settings/adminCenter/closerDashboard/CloserDashboardAuditTable.tsx` — tabela das 18 métricas pedidas + select de "usuário piloto a auditar" + botão "Revalidar".

### 4. Reconciliação debug (Owner/Admin)

**Novo:** `src/components/settings/adminCenter/closerDashboard/CloserDashboardReconciliation.tsx`
- Bloco visível apenas no Admin Center (já restrito por `isOrgAdmin`).
- Mostra os 10 totais pedidos (open opportunities, open proposals, activities today/overdue, won/lost month, goal/realized, pace), reaproveitando o mesmo payload da auditoria.
- Sem RPC nova.

### 5. Checklist de Homologação

**Novo:** `src/components/settings/adminCenter/closerDashboard/CloserHomologationChecklist.tsx`
- 13 itens conforme enunciado (Usuário piloto validado, Contexto CRM completo, Função técnica closer, Dashboard dinâmico ativo, Flag global ativa, Pipeline Padrão configurado, Meta encontrada, Central do Dia carregando, Pace carregando, CTAs validados, Sem erro runtime recente, Feedback coletado, Rollback disponível).
- Cada item: badge `OK` / `Atenção` / `Pendente`, derivado de:
  - obs (active pilots, errors recentes nos runtime logs)
  - audit (Pace `available`, Central do Dia retornou)
  - feedback summary (`total > 0`)
- Botão **"Revalidar checklist"** que chama `obs.refetch()` + reroda audit.

### 6. Runbook operacional

**Novo:** `src/components/settings/adminCenter/closerDashboard/CloserRunbookCard.tsx`
- Card com os 6 passos do enunciado em texto direto (Para habilitar / testar / voltar / desligar usuário / desligar tudo / analisar).
- Conteúdo estático.

### 7. Integração no `CloserDashboardHealthPanel.tsx`

Reordena para incluir as novas seções:
1. Aviso técnico (já existe)
2. Saúde
3. Ativação controlada (rollout)
4. Usuários comerciais piloto
5. Performance
6. Feedback
7. **Auditoria de Dados** (novo)
8. **Reconciliação** (novo)
9. **Checklist de Homologação** (novo)
10. **Runbook** (novo)
11. Decisão de expansão
12. Rollback

### 8. Pipeline Padrão

Sprint 6.4.1 já corrigiu via `upsert({user_id,...},{onConflict:'user_id'}) + invalidateQueries(['current-user'])`. **Sem mudança nesta sprint** — apenas validação manual documentada no resumo.

### 9. NÃO muda

- Schema, RPCs, RLS, permissões, sidebar, login, dashboard legado, automações, notificações, propostas, oportunidades, atividades, metas: intactos.
- `dashboard_type='closer'` e `business_function_key='closer'` permanecem.
- Limite backend de 3 pilotos permanece.
- Runtime gate inalterado.

## Detalhes técnicos

```text
Novos arquivos:
  src/services/crm/closerDashboardAudit.ts
  src/components/dashboard/closer/CloserProposalsActionGroup.tsx
  src/components/dashboard/closer/CloserActivitiesGroup.tsx
  src/components/settings/adminCenter/closerDashboard/CloserDashboardAuditTable.tsx
  src/components/settings/adminCenter/closerDashboard/CloserDashboardReconciliation.tsx
  src/components/settings/adminCenter/closerDashboard/CloserHomologationChecklist.tsx
  src/components/settings/adminCenter/closerDashboard/CloserRunbookCard.tsx

Editados:
  src/components/dashboard/closer/CloserDashboard.tsx       (reorganização + Atualizar)
  src/components/dashboard/closer/CentralDoDiaSection.tsx   (copy + empty agregado)
  src/components/dashboard/closer/CloserPaceSection.tsx     (proteções + tooltip)
  src/components/dashboard/closer/CloserTopActions.tsx      (copy)
  src/components/dashboard/closer/CloserPeriodFilter.tsx    (tooltip)
  src/components/dashboard/closer/CloserRiskDealsList.tsx   (tooltip de risco)
  src/components/dashboard/closer/CloserDashboardEmptyState.tsx
  src/components/dashboard/closer/CloserDashboardErrorState.tsx
  src/components/dashboard/closer/CloserDashboardFeedbackCard.tsx (chips + label)
  src/components/settings/adminCenter/closerDashboard/CloserDashboardHealthPanel.tsx (integração)

Inalterados (mantidos como estão):
  CloserKpiGrid (já bom)
  CloserPaceCard / CloserPaceProgress / CloserPaceStatusBadge
  CloserSectionList / CloserListItemRow
  closerCta.ts (já garante CTAs seguros)
  Migrations / RPCs / config.toml
```

## Critérios de pronto

- Dashboard Comercial reordenado, com todos os tooltips/empty/error claros, botão Atualizar e Tabs de propostas.
- Admin Center contém: Auditoria, Reconciliação, Checklist de Homologação, Runbook.
- Feedback inclui chips opcionais.
- Pipeline Padrão validado manualmente (sem mudança de código).
- Build passa, TS sem erro, sem console errors.
- Zero mudança em schema/RPC/permissões.

## Riscos

- Baixo. Toda lógica nova é derivada de dados já existentes. Único ponto de atenção: garantir que a Auditoria/Reconciliação tolere `data` parcialmente nulo (já há padrão `?? null` em todo o fluxo atual).
