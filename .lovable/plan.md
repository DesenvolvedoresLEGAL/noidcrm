
# NOID Skills Engine — Sprint NS.01

Camada de habilidades comerciais reutilizáveis. Playbook é estratégia, Skill é capacidade operacional, Agente decide quando usar. Skills geram recomendação — nunca enviam mensagem nem alteram CRM.

## 1. Backend — Schema

Migration única com 3 tabelas + GRANTs + RLS por organização.

**`noid_skills`** — biblioteca versionada
- Campos-chave: `organization_id`, `name`, `slug` (único por org+versão), `category`, `skill_type`, `status` (draft|active|deprecated|archived), `description`, `input_schema` jsonb, `output_schema` jsonb, `system_prompt`, `task_prompt`, `guardrails` jsonb, `examples` jsonb, `success_criteria` jsonb, `failure_modes` jsonb, `version` int, `created_by`, timestamps.
- Índices: `(organization_id, status)`, `(organization_id, category)`, `(organization_id, slug, version)` unique.

**`noid_skill_runs`** — histórico de execuções
- `skill_id`, `prospect_id`, `account_id`, `opportunity_id`, `contact_id`, `source_module`, `input_payload`, `output_payload`, `model_used`, `status` (success|schema_invalid|guardrail_blocked|error), `confidence_score`, `quality_score`, `latency_ms`, `error_message`, `created_by`, `created_at`.

**`noid_skill_feedback`**
- `skill_run_id`, `rating` (-1..1), `feedback_type` (positive|negative|edited_by_user|used_in_outreach|ignored|converted|failed), `feedback_notes`, `outcome_event_id`, `created_by`, `created_at`.

**RLS** (via `has_role`/`is_org_member`):
- `noid_skills`: SELECT membros da org. INSERT/UPDATE owner/admin. Draft nunca é retornado pelo router.
- `noid_skill_runs`: SELECT org; INSERT autenticado da org; sem UPDATE cliente (service_role only).
- `noid_skill_feedback`: SELECT/INSERT membros da org.

GRANTs padrão authenticated + service_role.

## 2. Backend — Edge Functions

**`supabase/functions/_shared/skills.ts`** — helpers: load skill, validar payload contra JSON schema (Ajv leve manual — checar `required` e tipos), aplicar guardrails textuais (maxLength, blocklist), formatar output.

**`noid-run-skill`**
- Input: `{ skill_id, context, source_module?, links?: {prospect_id, opportunity_id, ...} }`
- Fluxo: carrega skill ativa → valida input_schema → monta prompt (system + task + context) → chama OpenAI via `_shared/ai-client.ts` com `response_format: json_object` → valida output_schema → aplica guardrails → grava `noid_skill_runs` → retorna `{ run_id, output, confidence, status }`.
- Skill em `draft`/`deprecated`/`archived` → 400 (exceto se `allow_draft=true` do playground e o caller for admin).

**`noid-skill-router`**
- Input: `{ source_module, goal, context, preferred_category? }`
- Mapa `goal → { category, skill_type, slug_hint? }`. Ex.: `generate_whatsapp_message → (prospecting, message_generation, slug='first-touch-whatsapp-expositor')`.
- Seleciona skill ativa de maior versão que combine; fallback pelo slug_hint. Chama `noid-run-skill` internamente. Retorna `{ skill_id, skill_slug, run_id, output }`.

Ambas com CORS, verificação JWT em código, uso de `openai` via wrapper compartilhado, `dateContextPrompt()` quando aplicável.

## 3. Seed — 10 skills iniciais

Insert data (via `supabase--insert` após aprovar migration) das 10 skills descritas no briefing, todas `status='active'`, `version=1`, `organization_id = null` (globais) — RLS permite SELECT quando `organization_id IS NULL` (skills de plataforma).

Slugs:
1. `first-touch-whatsapp-expositor`
2. `first-touch-email-expositor`
3. `call-script-expositor`
4. `objection-already-has-vendor`
5. `objection-price-too-high`
6. `objection-will-think-about-it`
7. `explain-professional-event-internet`
8. `qualification-questions-expositor`
9. `reactivate-stale-lead`
10. `next-best-action`

Cada uma com `input_schema`, `output_schema`, `system_prompt` (herda master prompt), `task_prompt`, `guardrails` (maxLength, tom, sem SLA/desconto inventado).

## 4. Frontend — Intelligence > Skills

Rotas em `src/pages/intelligence/skills/`:
- `SkillsLibraryPage.tsx` — tabela com nome, categoria, tipo, status, versão, execuções (join count), % feedback positivo, última run. Filtros por categoria/status/tipo. Botão "Nova skill" (owner/admin).
- `SkillDetailPage.tsx` — abas Visão Geral, Prompts, Schemas, Guardrails, Exemplos, Runs recentes, Feedback, Versões. Owner/admin editam se `status='draft'` (nova versão cria linha nova mantendo histórico imutável).
- `SkillPlaygroundPage.tsx` — formulário dinâmico a partir de `input_schema`, botão Executar chama `noid-run-skill` com `dry_run=true` (não persiste run com `source_module='playground'` mas marca `status='playground'`), exibe output JSON + copiar.

Serviços em `src/services/intelligence/skills.ts` + hooks em `src/hooks/intelligence/useSkills.ts` (React Query, mesmo padrão do SDR Copilot).

Menu: adicionar item "Skills" em `NoidIntelligenceHub.tsx` com badge `Novo`.

## 5. Integração SDR Copilot

Refatorar `kairos-generate-sdr-message`:
- Antes: prompt fixo por canal.
- Depois: chama `noid-skill-router` com `goal ∈ {generate_whatsapp_message, generate_email_message, generate_call_script}`, `context = { company_name, contact_name, event_name, pain_hypothesis, product_context, tone, brief }`.
- Cacheia em `kairos_sdr_copilot_tasks.suggested_messages[channel] = { skill_slug, run_id, output, generated_at }`.
- Fallback ao prompt antigo se router falhar (log em `system_events`).

## 6. Permissões e Guardrails

- `usePermissions`: owner/admin criam/editam/ativam; manager vê+playground; SDR usa+feedback.
- Router recusa skills `draft`. Executor sempre grava run. Nenhum envio automático, nenhum write no CRM.
- Feedback via botões nas mensagens do SDR Copilot (👍/👎/editei/usei/ignorei) → `noid_skill_feedback` linkado ao `run_id`.

## 7. Learning loop (mínimo viável nesta sprint)

- `revenue_events`: novos tipos `skill_run_created`, `skill_output_used`, `skill_output_edited`, `skill_output_ignored`, `skill_converted`.
- View `v_skill_metrics` (nome, execuções, %positivo, %editado, latência p50) para a tabela da Library.

## 8. Fora do escopo NS.01

- Roleplay/voz/WhatsApp agents (só preparação; consumo real vem em sprint dedicada).
- Auto-versionamento por A/B (registrar hipóteses em `experiment_hypotheses` fica para NS.02).
- Skills por unidade de negócio ou território.

## Aceite

Tabelas + RLS + GRANTs criadas · router + executor deployados · 10 skills ativas · Library/Detail/Playground funcionais · SDR Copilot consumindo router com fallback · runs e feedback persistindo · nenhuma skill envia mensagem nem altera CRM.

## Ordem de execução

1. Migration (schema + RLS + GRANTs + view de métricas).
2. Seed das 10 skills (insert tool).
3. Edge functions `_shared/skills.ts`, `noid-run-skill`, `noid-skill-router`.
4. Serviços/hooks + páginas Library/Detail/Playground + rota no Hub.
5. Refactor `kairos-generate-sdr-message` + feedback UI no SDR Copilot.
6. Verificação: playground + 1 task SDR Copilot ponta-a-ponta.

Confirma pra eu tocar?
