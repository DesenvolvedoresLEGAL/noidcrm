## Análise forense — o que quebrou

Rodei um probe HTTP em todas as 271 edge functions do projeto (POST em cada endpoint com `apikey` anônima). O resultado é o que está causando a cascata de erros:

- **253 funções retornam `404 NOT_FOUND_FUNCTION_BLOB`** — ou seja, o código está no repositório mas **não existe blob deployado** no runtime. Entre elas: `calculate-ote` (a do print), `orchestrate-proposal-financials`, todas as `report_*_v2`, todo o pacote Kairós, todas as `ai-*`, `send-*`, `track-*`, `report_forecast_v2`, `calculate-opportunity-scores`, `process-*-queue`, `notify-*`, `generate-*`, etc.
- **18 funções respondem** (401 quando exigem JWT, ou 200/400 quando públicas). Entre elas as duas que redeployei manualmente na conversa anterior (`execute-workflow`, `process-pending-workflows`) e algumas antigas (`calculate-nrhs`, `get-current-user`, `track-proposal-view`, `analyze-proposal-behavior`, `send-smtp-email`…).

### Por que o print mostra "CORS blocked" em vez de "404"
O browser dispara um preflight `OPTIONS` para `calculate-ote`. Como a função não existe no runtime, o gateway devolve **404 sem headers CORS**. O Chrome não vê `Access-Control-Allow-Origin` na resposta do preflight e reporta o erro como "CORS policy: Response to preflight request doesn't pass access control check". A mensagem é enganosa — **a causa real é 404, não CORS**. O mesmo padrão se aplica a todas as outras telas (OTE, Forecast, Relatórios V2, Kairós, IA, notificações, PDF, etc.).

### Causa raiz
O auto-deploy do Lovable Cloud dispara função-a-função a cada edit. Quando várias funções são editadas em rajada (foi o caso nas últimas sessões: `analyze-proposal-behavior`, `calculate-nrhs`, `track-proposal-view`, `execute-workflow`, `process-pending-workflows`, e muitas outras), alguns deploys entram em fila e falham silenciosamente — o blob antigo é invalidado antes do novo subir. Como só os 2 que redeployei manualmente na sessão anterior voltaram, e os que **não foram tocados há tempos** também estão em 404, a conclusão é que houve uma **invalidação em massa dos blobs** (provavelmente após um evento de manutenção/rotação do runtime). Não é bug do código — é estado de deploy.

## Plano de reparo

### 1. Redeploy em lote das 253 funções faltantes
Usar `supabase--deploy_edge_functions` em batches de ~20 nomes (limite prático do tool). Ordem por criticidade para o CRM voltar a operar rápido:

1. **Bloco A — OTE / Comissão / Forecast** (desbloqueia o print): `calculate-ote`, `orchestrate-proposal-financials`, `calculate-opportunity-scores`, `calculate-opportunity-indicators`, `calculate-account-scores`, `calculate-health-drivers`, `calculate-explainable-probability`, `calculate-plg-score`, `calculate-revenue-impact`, `create-forecast-daily-snapshots`, `generate-forecast-prediction`, `record-forecast-outcome`, `ml-win-probability`, `process-nrhs-queue`, `process-opportunity-indicators-queue`, `process-opportunity-score-queue`, `process-lead-score-queue`.
2. **Bloco B — Relatórios V2**: todas as `report_*_v2` (16 funções) + `report-qualification-quality-v2`.
3. **Bloco C — Propostas / Pricing / PDF / Aceite**: `generate-pdf-export`, `generate-proposal-pdf`, `regenerate-proposal-pdfs`, `send-proposal-email`, `check-proposal-expiration`, `check-proposal-pricing-tier-transition`, `auto-refresh-dynamic-pricing-proposals`, `handle-proposal-decline`, `post-acceptance-effects`, `generate-acceptance-proof`, `ai-analyze-proposal`, `ai-proposal-suggestions`, `ai-generate-proposal-intro`, `og-proposal-meta`.
4. **Bloco D — IA / Coaching / Sugestões**: todas as `ai-*` restantes (~30), `accept-ai-suggestion`, `auto-apply-ai-suggestions`, `execute-ai-action`, `apply-recommendation`, `generate-recommendations`, `sales-coach-notifications`, `ai-loss-semantic-analyzer`.
5. **Bloco E — Notificações / Email / Push**: `notify-approval-request`, `notify-client-reply`, `notify-deal-won`, `process-notification-fallback`, `track-notification-click`, `send-daily-digest-email`, `send-browser-push`, `send-user-invitation`, `send-kairos-initial-email`, `send-smtp-email-internal`, `test-smtp-connection`, `test-slack`, `ingest-email-delivery-event`, `sync-emails`, `sync-email-replies`, `cron-index-emails`, `index-email-knowledge`, `search-email-knowledge`, `process-email-queue`, `compute-email-cadence-eligibility`, `advance-email-cadence-progress`, `run-email-agent-cadence-scheduler`, `execute-email-agent-run`, `approve-email-agent-action`, `reject-email-agent-action`, `enqueue-email-agent-triggers`, `aggregate-email-agent-metrics`, `track-email-open`, `track-email-click`.
6. **Bloco F — Kairós / Sourcing / Enriquecimento**: todas as `kairos-*` (~17), `lead-sourcing`, `run-enrichment`, `enrich-prospect-identity`, `rescore-prospects`, `preview-apollo-enrichment`, `apollo-phone-webhook`, `backfill-decision-makers`, `refresh-segment-benchmarks`.
7. **Bloco G — Admin / Auth / API pública / Onboarding / Trial / ERP**: `admin-cleanup-data`, `admin-reset-password`, `bulk-create-users`, `delete-user-with-transfer`, `accept-invitation`, `check-org-slug`, `onboarding-complete`, `check-trial-eligibility`, `expire-trials`, `send-trial-alerts`, `trial-expired-automation`, `trial-lifecycle-events`, `provision-client-organization`, `link-slg-organization`, `api-accounts`, `api-deals`, `api-products`, `api-keys-manage`, `get-public-form`, `submit-public-form`, `ingest-lead`, `ingest-landing-lead`, `get-public-loss-reasons`, `get-public-win-reasons`, `erp-create-charge`, `erp-payment-webhook`, `erp-sync-charge-status`, `sync-account-from-erp`, `import-products`, `export-products`, `execute-import`, `validate-import-data`, `backfill-accounts-segmento`, `abacatepay-checkout`, `abacatepay-webhook`.
8. **Bloco H — Restante** (release notes, gamification, agentes, experimentos, misc): todas as ~40 funções remanescentes da lista de 253.

### 2. Validação pós-deploy
Depois de cada bloco, rodar novamente o probe HTTP nas funções do bloco. Só passar ao próximo bloco quando **0 respostas 404** no bloco anterior. Log final: quantas voltaram, quais (se alguma) falharam no deploy e o motivo do log.

### 3. Testes funcionais dirigidos
- `calculate-ote` invocado com `periodMonth=2026-07` (usuário do print) → confirmar que a tela "Relatório OTE" calcula sem "Erro ao calcular OTE".
- `report_forecast_v2` / `report_summary_v2` → validar Dashboard e Forecast.
- `orchestrate-proposal-financials` → abrir uma proposta e confirmar recomputação de totais.
- `notify-approval-request` → aprovar uma ação sensível e verificar Slack + inbox.

### 4. Prevenção
- Documentar no `mem://` que **auto-deploy em rajada pode falhar silenciosamente** e que qualquer edição em lote de edge functions deve terminar com um probe HTTP + `deploy_edge_functions` nas que retornam 404.
- Nada de mudança de código de aplicação neste ciclo — o problema é exclusivamente estado de deploy do runtime.

## Detalhes técnicos (para referência)

- Probe usado: `curl -X POST https://<ref>.supabase.co/functions/v1/<name>` com `apikey` anônima. Códigos esperados quando saudável: `401` (verify_jwt=true), `400` (valida body), `200`. Código sintoma: `404 NOT_FOUND_FUNCTION_BLOB`.
- O erro "CORS preflight" no browser é **efeito colateral do 404**, não bug de headers. Todas as funções afetadas já têm CORS correto no código; elas só não estão rodando.
- `supabase/config.toml` está íntegro (nenhum `verify_jwt` inconsistente entre funções); não precisa ser editado.
- Nenhuma migração de banco ou mudança em código frontend faz parte deste reparo.

## Risco / rollback
- Redeploy é idempotente. Se um bloco falhar, o estado anterior (404) permanece — nenhum dado é tocado. Nenhum risco em RLS, tenant isolation ou dados.
- Duração estimada: 8 blocos × ~30s cada = ~4-5 min de deploy total.
