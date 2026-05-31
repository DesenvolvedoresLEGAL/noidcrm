## Release v1.34.0 — Inteligência de Perdas, OTE Auditável & Receita Líquida

**Data:** 31/05/2026 · **Tipo:** Major (`is_major = true`) · **Tabela:** `release_notes`

Próxima versão após a 1.33.0 (15/05/2026). Cobre os avanços das últimas duas semanas.

### Título e descrição

- **version:** `1.34.0`
- **title:** `Inteligência de Perdas, OTE Auditável & Receita Líquida`
- **description:** `Win/Loss Hub ganha motor semântico invisível com IA, relatório OTE com Excel auditável fim-a-fim, Forecast e Dashboard passam a refletir cancelamentos, governança unificada com MCP Catalog e aprovações via Slack.`

### Changes (jsonb)

**🧠 Win/Loss — Inteligência Semântica (feature)**

- Diagnóstico Executivo da IA agora compara o motivo declarado pelo vendedor com a causa real detectada nos textos livres, sinalizando quando há divergência.
- Novo CRM Trust Score (0–100) que mede a qualidade dos diagnósticos de perda e a cobertura textual da operação.
- Bloco "Motivos Ocultos" mostra ranking declarado × inferido pela IA, expondo causas que viraram caixa-preta.
- Bloco "Gap Vendedor × Cliente" identifica os pares mais frequentes onde o time interno diverge do feedback do cliente.
- Novo Radar Competitivo consolida concorrentes citados por humanos e detectados pela IA, com valor perdido, motivo dominante e nível de confiança.
- Novo bloco "Drivers de Vitória" agrega motivos, diferenciais decisivos e voz do cliente nas oportunidades ganhas.
- Alertas Inteligentes ganharam regras semânticas: trust score baixo, diagnóstico fraco em ≥30% das perdas, gap dominante, receita recuperável e motivo oculto.
- Tendência de Motivos de Perda agora tem toggle Declarado/IA.
- Detalhe da oportunidade perdida tem novo card "Análise Semântica da IA" com texto completo, categoria detectada, concorrente, ação recomendada e botão Reprocessar.
- A IA nunca sobrescreve o motivo humano nem o registro de Win/Loss — apenas enriquece o diagnóstico.

**📊 Resultados / OTE (feature + improvement)**

- Sprint OTE 1.4: o botão Excel do relatório OTE agora exporta um workbook auditável fim-a-fim, com Visão Geral, Closers, Pré-Vendas, Por Vendedor, Detalhamento de Vendas, Itens Elegíveis e Não Elegíveis, e Oportunidades Qualificadas por Pré-Vendas — refletindo exatamente o que aparece na tela.
- Valores monetários, datas e horas exportados em formato numérico/data nativo, prontos para análise em planilhas.
- Cálculos canônicos preservados: regra item a item, `historicalQualifications` e atribuição histórica continuam intactos.

**💰 Receita Líquida em Forecast e Dashboard (fix + improvement)**

- Forecast "Fechado" e Dashboard CEO (Receita Avulsa, MRR, Run Rate e contagem de vendas) agora descontam vendas canceladas, lendo `valid_revenue_amount` em vez do valor bruto.
- Alinha o Forecast e o Dashboard ao Relatório de Vendas Realizadas como fonte única — sem o gestor ver valor maior do que o efetivamente realizado.
- `commercial_won_revenue_view` reforçada como fonte oficial de receita realizada (Forecast, Dashboard, BI, Relatórios, Ranking, Comissão).
- Guardrail `REVENUE_SOURCE_MISMATCH` em `/admin/revenue-integrity` para detectar divergências > R$ 0,01 automaticamente.

**🔌 Governança & MCP (feature)**

- Action Registry: catálogo único `action_registry` + log `action_executions` centralizando toda ação sensível da plataforma (hook `useAction`).
- Auditoria e Aprovações Unificadas: nova view `unified_audit_view` consolida 5 fontes de auditoria; tabela `approval_requests` genérica unifica filas de aprovação.
- MCP Catalog: `mcp_action_catalog_view` expõe o Action Registry como tools MCP, abrindo o caminho para automações externas governadas.
- Aprovações via Slack: novo edge `notify-approval-request` envia cards Block Kit ao canal de aprovações em tempo real.
- Dispatcher genérico `execute-action` resolve qualquer ação do registry e despacha para RPC ou edge function, com `useAction.runServer()` no front.

**⚡ Performance & Confiabilidade (improvement)**

- Filtros e selects de usuários agora leem de `crm_active_users_view`, eliminando inativos das listas operacionais e reduzindo o payload das telas.
- Sugestões de IA por oportunidade têm cache determinístico via `context_signature` — só rodam OpenAI em clique manual com `force_refresh`, cortando latência e custo.
- Realtime do Win/Loss Hub e do detalhe da oportunidade revisado para evitar re-renderizações desnecessárias.

**🔒 Segurança (security)**

- Validação server-side em `updateOpportunity` bloqueia atribuição a usuários inativos ou fora da organização.
- Função `delete-user-with-transfer` reforçada: não transfere oportunidades fechadas nem `created_by` histórico, preservando atribuição imutável de comissão e OTE.
- LGPD no Win/Loss: dashboards lêem apenas excerpts ≤160 caracteres; texto completo só no escopo autenticado da oportunidade.
- Edge functions de IA padronizadas em `_shared/ai-client.ts` com `search_path` fixado e guard anti-time-travel para qualquer prompt que sugira datas.

### Execução

1. **(migração obrigatória)** `INSERT` na tabela `release_notes` com `version='1.34.0'`, `release_date='2026-05-31'`, `is_major=true`, `changes` como JSONB array de `{type, description}` usando os tipos `feature | improvement | fix | security`.
2. Validar exibição em `/release-notes` (a página já ordena por versão semântica e auto-scroll para a última).
3. Sem mudanças de código no front — a página `ReleaseNotes.tsx` já consome a tabela.

### Fora de escopo

- Não altera `commercial_won_revenue_view`, regras de OTE, `historicalQualifications` nem `win_loss_records`.
- Não cria aba nova de "Inteligência Semântica" — o motor permanece invisível dentro da Visão Geral.
- Não mexe em motivos humanos selecionados (`loss_reason_id`, `client_loss_reason_id`).
