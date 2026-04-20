

# Plano: Migrar IA do Lovable AI → OpenAI + Corrigir Bug de Sugestões

## Diagnóstico do bug "data no passado"

A sugestão "antecipar para 14/08/2025" (passado!) **não é culpa do modelo** — é bug de prompt em `ai-field-suggestions/index.ts`. O prompt envia `close_date_prevista`, mas **nunca informa qual é a data de hoje**. O modelo não tem relógio interno confiável e chuta.

**Trocar pra OpenAI sem corrigir isso = mesmo problema, conta diferente.** Vou corrigir os dois lados.

## Escopo da migração

Mapeei **53 edge functions** que hoje chamam `https://ai.gateway.lovable.dev/v1/chat/completions` usando `LOVABLE_API_KEY`. Todas precisam migrar pra `https://api.openai.com/v1/chat/completions` usando `OPENAI_API_KEY` (já cadastrada no projeto pra Fase 1 do RAG).

### Estratégia: Wrapper centralizado (não tocar em 53 arquivos um por um)

Criar **1 helper compartilhado** em `supabase/functions/_shared/ai-client.ts` com `callAI({ model, messages, ... })` que:
1. Lê `OPENAI_API_KEY` (default) ou `LOVABLE_API_KEY` (fallback opcional via flag).
2. Mapeia automaticamente os modelos Gemini → OpenAI equivalentes.
3. Trata erros 429/402 com mensagens claras pro frontend.
4. Loga uso em `ai_usage_logs` (já existe no schema, conforme ADR-003).

Depois, refactor das 53 functions trocando `fetch('https://ai.gateway.lovable.dev/...')` → `callAI(...)`. Refactor mecânico, sem mudar lógica.

### Mapeamento de modelos

| Hoje (Lovable AI) | Migra para (OpenAI) |
|---|---|
| `google/gemini-2.5-pro` | `gpt-5` |
| `google/gemini-2.5-flash` | `gpt-5-mini` |
| `google/gemini-2.5-flash-lite` | `gpt-5-nano` |
| `google/gemini-3-flash-preview` | `gpt-5-mini` |

(Modelos de imagem `gemini-*-image-*` ficam fora — OpenAI usa `gpt-image-1` e o uso é diferente; tratar caso a caso se houver.)

## Correções de prompt (anti-"data no passado")

Além da migração, corrigir o **prompt-defeito raiz** em `ai-field-suggestions`:

1. Injetar `Hoje é: ${new Date().toISOString().split('T')[0]}` em **todos os prompts** que envolvem datas.
2. Adicionar regra explícita: *"Sugestões de close_date_prevista DEVEM ser ≥ data de hoje. Nunca sugira datas passadas."*
3. Reforçar validação server-side em `validateSuggestion()`: rejeitar `close_date_prevista < today` antes de gravar em `ai_suggestions`.

Aplicar essa mesma sanidade nas outras functions que sugerem datas (`ai-next-action`, `ai-score-deal`, `generate-forecast-prediction`, `ai-meeting-prep`).

## Fases de execução

### Fase 1 — Fundação (1 commit)
- Criar `supabase/functions/_shared/ai-client.ts` com `callAI()`, mapper de modelos e logging.
- Validar com 1 function piloto: `ai-field-suggestions` (que é o caso reportado).
- **Aqui já fica resolvido o bug da data** + migrada pra OpenAI.

### Fase 2 — Refactor em lote por categoria
Migrar as 52 restantes em grupos lógicos pra facilitar QA:
- **Coaching/Insights** (8 funcs): `ai-sales-coach`, `ai-team-coaching`, `ai-manager-coaching`, `ai-rep-insights`, `ai-owner-briefing`, `ai-bi-insights`, `ai-generate-insights`, `ai-vibe-advisor`.
- **Geração de conteúdo** (7 funcs): `ai-email-assist`, `ai-generate-message`, `ai-generate-proposal-intro`, `ai-generate-template-content`, `ai-generate-client`, `ai-meeting-prep`, `ai-handle-objection`.
- **Scoring/Análise** (10 funcs): `ai-score-deal`, `ai-next-action`, `analyze-deal-health`, `analyze-opportunity-risk`, `analyze-objections-heatmap`, `analyze-playbook-roi`, `analyze-proposal-behavior`, `analyze-winloss-batch`, `ml-win-probability`, `calculate-explainable-probability`.
- **Sugestões/Automação** (8 funcs): `ai-activity-suggestions`, `ai-proposal-suggestions`, `ai-parse-automation-rule`, `ai-parse-sequence`, `ai-sequence-orchestrator`, `auto-apply-ai-suggestions`, `generate-followup-suggestion`, `auto-task-creator`.
- **Email Agent / Simulation** (6 funcs): `execute-email-agent-run`, `run-agent-simulation`, `generate-agent-blueprint`, `aggregate-email-agent-metrics`, `compute-email-cadence-eligibility`, `enqueue-email-agent-triggers`.
- **Outros** (13 funcs): `lead-sourcing`, `validate-import-data`, `extract-memory-engine`, `daily-briefing-generator`, `generate-forecast-prediction`, `ai-recommend-videos`, `ai-evaluate-session`, `ai-simulate-client`, `ai-analyze-proposal`, `calculate-revenue-impact`, `daily-vibe-check`, `detect-vibe-state`, `gamification-engine`.

### Fase 3 — Limpeza e validação
- Remover dependência de `LOVABLE_API_KEY` do código (manter como fallback opcional via env flag `AI_PROVIDER_FALLBACK=lovable`).
- Smoke test end-to-end: abrir oportunidade → gerar sugestões → confirmar que data sugerida é ≥ hoje.
- Atualizar memória do projeto (`mem://`) com a nova decisão arquitetural.

## Custo estimado (referência)

| Modelo | Input (1M tok) | Output (1M tok) | Uso típico |
|---|---|---|---|
| `gpt-5-mini` | ~US$ 0,25 | ~US$ 2,00 | Default na maioria das funcs |
| `gpt-5` | ~US$ 1,25 | ~US$ 10 | Coaching, scoring crítico |
| `gpt-5-nano` | ~US$ 0,05 | ~US$ 0,40 | Classificação, parse |

Com volume atual estimado (~5k requests/dia), custo mensal projetado: **US$ 30–80** dependendo do mix.

## Detalhes técnicos

- **Wrapper signature**: `callAI({ model, messages, response_format?, tools?, tool_choice?, reasoning_effort? })` retornando `{ content, usage, raw }`.
- **Reasoning models**: `gpt-5` aceita `reasoning_effort: "minimal" | "low" | "medium" | "high"` — usar `low` por padrão pra balancear latência.
- **Structured output**: manter padrão de tool calling (já usado em várias funcs) — OpenAI tem suporte nativo melhor que Gemini, então simplifica.
- **Streaming**: `ai-email-assist` usa SSE; manter formato OpenAI nativo (compatível com o parser atual do frontend).
- **Logging**: gravar em `ai_usage_logs` (organization_id, feature, model, tokens_in/out, latency_ms, success) pra monitorar custo por org.
- **Migration de DB**: nenhuma — só código de edge functions.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Latência OpenAI > Gemini Flash | Default `gpt-5-mini` (rápido); usar `gpt-5-nano` em parses simples |
| Custo descontrolado | Logging + circuit breaker por org (já previsto no ADR-003) |
| Quebra de contrato JSON | Manter `response_format: { type: "json_object" }` — funciona igual |
| 53 funcs = 53 deploys | Wrapper centralizado evita refactor profundo; deploy em lote via Lovable |

## O que NÃO muda

- Fase 1/2/3 do RAG (já usam OpenAI direto pra embeddings).
- `ai-email-assist` mantém arquitetura RAG implementada.
- Schemas, tabelas, RLS, frontend — tudo intacto.

## Pergunta antes de executar

Quer que eu comece pela **Fase 1 (fundação + correção do bug da data)** e te mostre o resultado em `ai-field-suggestions` antes de propagar pras outras 52? Ou prefere que eu faça tudo de uma vez?

