

# Plano: corrigir definitivamente o Email Agent (contexto correto + zero alucinação)

## Diagnóstico real (com evidência no banco)

A oportunidade é **`LIVE NO 033 ROOFTOP`** (account `Tela Magica`, contato `Edney`).
O e-mail gerado fala de **"proposta TIGRE da Telamagica para a Agrishow 2026"** — que é uma **outra oportunidade** (`TIGRE NA AGRISHOW 2026`).

Ao inspecionar o run `f53e2cfc...`:

1. **O `context_snapshot_json` está correto**: opp title `LIVE NO 033 ROOFTOP`, account `Tela Magica`. Sem propostas. Sem e-mails manuais. Atividades reais (WhatsApp - 1ª rodada de negociação).
2. **O conteúdo gerado é fabricado.** O modelo inventou "TIGRE", "Agrishow 2026", "proposta visualizada", "follow-up por WhatsApp".
3. **Onde a contaminação entra:** o `feedback_history` (rejections/edits) é injetado **bruto** no prompt e contém o `original_output_json.body_text` + `subject` da oportunidade Tigre, que foi editada antes. O modelo trata isso como "contexto" do deal atual e copia entidades.

### Problemas adicionais críticos no contexto enviado à IA

- O código lê `opportunity.name`, `opportunity.value`, `opportunity.expected_close_date` — **nenhum desses campos existe**. Os reais são `title`, `valor_previsto`, `close_date_prevista`. O modelo recebe `null` no nome do deal e nas finanças e preenche o vazio com fantasia.
- `stage` é enviado como UUID cru (`stage_id`), não como o nome da etapa. O modelo não sabe em que momento do funil está.
- **Faltam totalmente**: nome do account, segmento, score, lifecycle, produto, origem, urgency, temperatura, custom fields, propostas com itens reais, scoring de oportunidade, vibe/emotional state, decision makers, atividades com descrição, histórico de timeline, roleplay/coach insights.
- O `recent_activities` envia só `type/title/status` — sem `description`, então o modelo não vê "Criada pelo workflow: VENDAS - Proposta visualizada → Mover para Proposta na Mesa".
- `manual_emails` envia só `subject` — o corpo do e-mail real do vendedor é descartado.

## O que vou implementar

### 1) Corrigir os nomes de campo lidos do banco
- Trocar `opportunity.name` → `opportunity.title` (e fallback).
- Trocar `opportunity.value` → `opportunity.valor_previsto`.
- Trocar `opportunity.expected_close_date` → `opportunity.close_date_prevista`.
- Ler `stage_id` E resolver para o nome real da etapa (`pipeline_stages.name`) e o nome do pipeline.

### 2) Construir um "Opportunity Brief" rico e determinístico
Criar uma função `buildOpportunityBrief(supabase, opportunityId)` em `_shared/opportunity-context.ts` que retorna **um único bloco JSON estruturado e tipado** com:
- **Identidade do deal**: id, title, status, pipeline name, stage name, valor_previsto, close_date_prevista, probabilidade, urgency_score, temperatura, produto, origem, fonte, owner.
- **Account**: id, razao_social, nome_fantasia, segmento, porte, cidade/UF, lifecycle_stage, lead_score, fit_score, score_financeiro, observacoes (tags), site, cnpj.
- **Contato principal**: nome completo, e-mail principal, telefone, cargo (se houver), is_primary.
- **Outros contatos da oportunidade** (até 5).
- **Custom fields** da oportunidade (chave→valor) lendo `custom_field_values` filtrando por entity_type='opportunity'.
- **Propostas** completas: subject, status, valor líquido (Total - Discount), sent_at, viewed_at, expires_at, items resumidos.
- **Atividades últimas** (10): type, title, **description completa**, status, scheduled_date, completed_at, ai_generated/is_automated.
- **E-mails manuais do vendedor** (5): subject, **trecho do body**, direction, sent_at.
- **Scoring**: opportunity_score atual, fatores principais.
- **Vibe / emotional memory**: last_emotional_state, risk_of_vibe_break.
- **Timeline highlights**: últimos eventos relevantes (proposta enviada/visualizada/recusada, mudança de stage, ganho/perda).
- **NRHS / health drivers** se existirem.

Esse brief vira a **única fonte de verdade** que entra no prompt.

### 3) Reescrever o prompt para forçar fidelidade ao contexto
- Substituir o `contextSummary` atual por: "Você só pode usar fatos que estão dentro de `<opportunity_brief>`. Se uma informação não está lá, NÃO invente. Não cite empresas, produtos, eventos, propostas ou pessoas que não apareçam no brief."
- Incluir lista explícita de "âncoras obrigatórias": `account.razao_social` ou `nome_fantasia`, `contato.nome`, `opportunity.title`, `stage.name`.
- Proibir explicitamente nomes de outras empresas/eventos/propostas: "Se você se pegar escrevendo um nome de empresa, evento ou produto, valide que ele aparece literalmente em `<opportunity_brief>`."

### 4) Eliminar a contaminação por `feedback_history`
- **Não enviar mais** `original_output_json.body_text` nem `subject` no feedback_history.
- Enviar apenas: `feedback_type`, `reason` (texto curto), e **diretrizes destiladas** ("evitar CTAs genéricos como 'quinta às 15min'", "datas precisas", etc.).
- Marcar claramente no prompt: "Esses são aprendizados de OUTRAS oportunidades. NÃO use entidades, nomes ou conteúdo deles aqui."
- Refatorar `buildFeedbackContext` para retornar uma estrutura sanitizada, sem corpo de e-mails passados.

### 5) Validação anti-alucinação pós-geração (server-side)
Antes de salvar `ai_email_messages`, validar que o conteúdo não contém entidades fora do brief:
- Extrair tokens "nome próprio em maiúsculas" do `body_text` + `subject`.
- Cruzar com a allowlist montada do brief: `account.razao_social`, `account.nome_fantasia`, `contact.nome`, `opportunity.title`, palavras do `produto`, `pipeline.name`, `stage.name`, etc.
- Se aparecer um nome próprio fora da allowlist (ex.: "TIGRE", "Agrishow", "Telamagica" quando o account é "Tela Magica" e o deal é "LIVE NO 033 ROOFTOP"), marcar `requires_approval = true` + `validation_flag = 'possible_hallucination'` + popular `validation_warnings_json` com a lista de termos suspeitos.
- Bloquear envio direto (auto_send) sempre que houver `validation_flag` — força revisão humana.

### 6) Surface de auditoria na UI de aprovação
Na fila de aprovações e no card pendente da oportunidade, mostrar:
- Banner amarelo "⚠ Possível alucinação detectada: TIGRE, Agrishow" quando houver `validation_warnings_json`.
- Mostrar o `opportunity_brief` resumido (account, deal, stage, último contato) **acima** do preview do e-mail, para o vendedor cruzar visualmente antes de aprovar.
- Botão "reportar alucinação" que grava feedback estruturado (sem replicar o body) para alimentar o ajuste.

### 7) Logs e observabilidade
- Em `ai_agent_execution_runs`, salvar `prompt_input_hash` + `brief_signature` para podermos reproduzir o prompt exato ao depurar.
- Adicionar `system_events` `email_agent.hallucination_detected` quando o validador 5 disparar.

## Arquivos que serão modificados

### Backend
- **novo** `supabase/functions/_shared/opportunity-context.ts` — `buildOpportunityBrief()`.
- `supabase/functions/_shared/agent-policy-engine.ts` — sanitizar `buildFeedbackContext` (sem body/subject originais).
- `supabase/functions/execute-email-agent-run/index.ts` — usar `buildOpportunityBrief`, corrigir nomes de campo, reescrever prompts, aplicar validador anti-alucinação, gravar warnings, forçar approval em caso de flag.
- `supabase/functions/approve-email-agent-action/index.ts` — re-validar contra brief antes de enviar (defesa em profundidade).
- nova migration: coluna `validation_warnings_json jsonb` em `ai_email_messages` e `ai_agent_execution_runs`.

### Frontend
- `src/hooks/useOpportunityApprovals.ts` — expor `validation_warnings_json` na RPC já criada.
- migration: estender `get_opportunity_pending_approvals` para retornar warnings.
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx` — banner de aviso + brief resumido.
- `src/pages/settings/AgentApprovalsPage.tsx` (ou equivalente da fila global) — mesmo banner.

## Validação

1. Disparar o agente novamente para `LIVE NO 033 ROOFTOP`. Esperado: e-mail mencionando **Tela Magica** e **Edney**, nada de Tigre/Agrishow.
2. Disparar para `TIGRE NA AGRISHOW 2026`. Esperado: e-mail correto da Tigre.
3. Inserir manualmente uma rejeição na Tigre e gerar de novo o de Tela Magica — verificar que **não** aparece "Tigre" no novo conteúdo.
4. Forçar um caso onde o modelo invente um nome → confirmar que `validation_flag` dispara, vira approval, e o banner amarelo aparece na UI.
5. Confirmar que campos antes nulos (`opp.value`, `opp.name`, `opp.expected_close_date`) agora chegam preenchidos no log do prompt.

## Resultado esperado

- Zero referência cruzada entre oportunidades.
- E-mails sempre mencionam o account, deal, contato e stage **reais** da oportunidade alvo.
- Texto deixa de soar genérico porque o modelo passa a ter custom fields, scoring, propostas detalhadas e descrição de atividades.
- Qualquer alucinação residual é detectada antes do envio e forçada para aprovação humana com aviso visual claro.

