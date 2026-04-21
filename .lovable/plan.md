

# Plano: expandir o Opportunity Brief para cobertura 360º real

## O que já está no brief hoje

- Dados da oportunidade: título, stage, pipeline, valor previsto, datas, scores (`opportunity_score`, `engagement`, `velocity`, `risk`, `win_probability_ai`, `urgency`, `temperatura`, `nrhs_score`/`tier`/`blockers`, `vibe_state`, `energy`, `timing`).
- Conta básica: razão social, fantasia, CNPJ, segmento, porte, cidade/UF, site, lifecycle, lead_score, fit_score, intent_score, score_financeiro, risco, observações.
- Contato principal + até 5 outros (via `deal_participants`).
- Custom fields da oportunidade.
- Propostas (até 5) com items (até 8 por proposta), valor líquido, sent/viewed/accepted/declined/expires.
- Atividades recentes (10) com descrição completa.
- E-mails manuais do vendedor (5) com excerpt do corpo.
- Allowlist de tokens para o validador anti-alucinação.

## O que ainda falta (e o usuário está pedindo)

### 1) Analytics de engajamento da proposta
- Eventos de `proposal_views` / `proposal_view_events`: quantas aberturas, último timestamp, tempo de leitura estimado, dispositivos, cidade/IP aproximado, seções mais vistas.
- Cliques rastreados (proxy SMTP) por proposta/e-mail.
- Aberturas de e-mails manuais (pixel) — totais e último open.

### 2) Página da Conta (todas as abas/submenus)
- **Outras oportunidades** da mesma conta (abertas/ganhas/perdidas, valor, stage) — dá memória de relacionamento.
- **Contratos** ativos / históricos da conta (status, MRR, vendas avulsas, datas).
- **Atividades da conta** que não estão amarradas a uma oportunidade específica.
- **Anotações da conta** (notes).
- **Decision makers** / contatos da conta além dos `deal_participants`.
- **Tags / segmentação** customizada da conta.
- **Custom fields da conta** (não só da opp).

### 3) Inteligência avançada
- **NRHS por pilar** (não só score/tier/blockers): pillars individuais e averages para o agente entender o porquê do tier.
- **Vibe**: `lead_emotional_memory` (last_emotional_state, narrative, risk_of_vibe_break, last_vibe_alerts), `vibe_advisor` últimas recomendações.
- **Scoring factors detalhados** (`scoring_factors_json` da opp) — já existe campo, mas nem sempre preenchido; expor em formato legível.
- **Coach insights / Roleplay highlights** se existirem na oportunidade.

### 4) Timeline unificada (cross-entity)
- Últimos 10–15 eventos relevantes da view `unified_timeline` para essa oportunidade (proposta enviada/visualizada/recusada, mudança de stage, ganho/perda, e-mail agent enviado, gmail reply, slack, etc.).

### 5) Histórico financeiro (se for cliente recorrente)
- Resumo de receita histórica da conta (MRR atual, sales avulsas, último contrato).

## Como vou implementar

### Backend
- Estender `_shared/opportunity-context.ts` adicionando, em paralelo, blocos:
  - `proposal_analytics`: query em `proposal_view_events` (ou view equivalente) agregando por `proposal_id` (count, last_at, total_seconds, dispositivo dominante).
  - `email_engagement`: query em `email_send_log` / eventos de open/click filtrando pelos e-mails da oportunidade.
  - `account_context`:
    - outras oportunidades: `opportunities` filtradas por `account_id` ≠ esta opp, soft-delete excluído.
    - contratos: `contracts` da conta (ativos primeiro).
    - notas: `notes`/`account_notes` da conta.
    - atividades da conta sem opportunity_id.
    - custom fields da conta.
  - `nrhs_detail`: leitura dos pillars (consultar tabela/colunas reais — `nrhs_pillars` ou colunas no opp).
  - `vibe`: `lead_emotional_memory`, últimos `vibe_alerts` e narrativa.
  - `timeline_highlights`: top 15 eventos da `unified_timeline` para esta oportunidade.
  - `revenue_history`: agregados de receita histórica da conta.
- Tudo paralelizado com `Promise.all` para não inflar latência.
- Estender o `allowlist_tokens` com nomes de produtos contratados, títulos de outras oportunidades da mesma conta, nomes de outros contatos da conta — **sem** vazar nomes de outras contas.

### Prompt
- Adicionar seções no `<opportunity_brief>` renderizado:
  - `### Engajamento com a proposta`
  - `### Histórico da conta (outras oportunidades, contratos, notas)`
  - `### Saúde do deal (NRHS por pilar)`
  - `### Estado emocional / vibe`
  - `### Linha do tempo recente`
- Reforçar regra: "Use estes dados para personalização real (ex.: 'vi que você abriu a proposta 3x ontem e voltou na seção de investimento')".

### Validação
- Manter o detector anti-alucinação. Itens novos entram na allowlist, então menções legítimas (ex.: nome de produto contratado, nome de outra oportunidade) deixam de ser flagadas.
- Adicionar regra extra: se o agente citar números (visualizações, tempo de leitura, MRR, datas), o número precisa ter origem identificável no brief — caso contrário marca `validation_flag = 'unverifiable_metric'`.

### UI de auditoria
- No card de aprovação pendente, mostrar uma seção colapsável "Brief usado pelo agente" com os blocos acima resumidos, para o vendedor checar a fundo antes de aprovar.

## Arquivos que serão tocados

### Backend
- `supabase/functions/_shared/opportunity-context.ts` (expansão dos blocos + allowlist + assinatura).
- `supabase/functions/execute-email-agent-run/index.ts` (renderizar novas seções no `<opportunity_brief>` + mencioná-las nas instruções).
- Possível nova migration apenas se eu precisar de uma view auxiliar (ex.: `vw_opportunity_brief_context`) — só se a leitura ad-hoc ficar pesada.

### Frontend
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx`: seção "Brief usado" colapsável.
- `src/hooks/useOpportunityApprovals.ts`: já expõe warnings; expor também `brief_signature` e contagem de blocos.

## Validação

1. Disparar o agente em uma opp com proposta visualizada várias vezes → o e-mail deve referenciar engajamento real ("você revisitou a proposta na sexta").
2. Disparar em conta que já é cliente → o e-mail deve reconhecer relacionamento existente (sem inventar contratos).
3. Disparar em opp com NRHS baixo e blockers → o e-mail deve abordar o blocker dominante.
4. Disparar em opp com `vibe_state = frio` ou alerta de risco → tom do e-mail deve refletir.
5. Forçar o modelo a inventar métricas → `validation_flag = 'unverifiable_metric'` deve disparar e segurar para aprovação.
6. Comparar duas opps da mesma conta para garantir que **não** há vazamento de nomes de outras contas no brief expandido.

## Resultado esperado

- O E-mail Agent passa a "ler" a oportunidade inteira do jeito que o vendedor lê: opp + conta + propostas + analytics + contratos + notas + scores + vibe + timeline.
- Texto deixa de soar genérico porque cita engajamento real, histórico de relacionamento e estado de saúde do deal.
- Mantém-se a defesa anti-alucinação, agora estendida também para métricas numéricas.

