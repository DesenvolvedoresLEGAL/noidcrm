# Plano: Ajustes Finais do Kairós

## Diagnóstico

Examinei a Edge Function `lead-sourcing`, a RPC `import_prospect_to_pipeline`, a função `enrich-prospect-identity`, o componente `RunHistoryTable.tsx` e a função `send-smtp-email`. Identifiquei que:

1. **Histórico**: o `playbook_runs.input_payload` já guarda `event_name` e `event_url`, mas a tabela não exibe — falta apenas adicionar a coluna **Fonte**.
2. **Origem "Kairós"**: hoje a RPC grava `origem = 'lead_sourcing'` em `opportunities` e `origem_principal = 'lead_sourcing'` em `accounts`. Precisa virar `'kairos'`.
3. **Enriquecimento CNPJ na importação**: o `enrich-prospect-identity` SÓ chama `lookup-cnpj` quando o prospect **não tem CNPJ ainda**. Quando o sourcing já trouxe o CNPJ (caso do Swapcard/FEIMEC), os campos `cnae_code`, `cnae_desc`, `cep`, `endereco`, `cidade_enriched`, `uf_enriched`, `porte` ficam vazios — e ao importar, a conta nasce sem endereço/segmento/CNAE.
4. **E-mail rascunho duplicado**: a RPC cria uma `activity` tipo `email` com status `pending` ("Rascunho: e-mail inicial para…") na timeline. Você quer que isso vire um e-mail real disparado via SMTP do usuário (com fallback para rascunho na aba E-mails se SMTP não estiver configurado).

---

## Alterações

### 1. Coluna "Fonte" no Histórico de Execuções
**Arquivo**: `src/components/playbook/RunHistoryTable.tsx`

- Adicionar coluna **Fonte** entre **Tipo** e **Status**, lendo `run.input_payload?.event_name` (ou `eventName`/`directoryName`/`location` para outros tipos).
- Quando vazio, mostrar `—`.
- Manter alinhamento e responsividade.

### 2. Origem "Kairós" em contas e oportunidades
**Migração SQL** — atualizar a RPC `import_prospect_to_pipeline`:

- Em `INSERT INTO accounts (..., origem_principal, ...)` trocar `'lead_sourcing'` por `'kairos'`.
- Em `INSERT INTO opportunities (..., origem, ...)` trocar `'lead_sourcing'` por `'kairos'`.
- Em `source_metadata` manter o sub-campo `'source': 'kairos'` (era `'lead_sourcing'`).
- Manter `imported_via: 'import_prospect_to_pipeline'` para auditoria interna.

> Não vamos rebatizar registros antigos — só novos imports. Se você quiser depois, posso fazer um update retroativo nos imports do Kairós.

### 3. Enriquecimento CNPJ completo antes/durante importação
**Arquivo**: `supabase/functions/enrich-prospect-identity/index.ts`

Refatorar a etapa 2 (CNPJ) para sempre tentar enriquecer endereço/CNAE/porte:

- Se o prospect **já tem CNPJ** mas faltam `cnae_code`/`endereco`/`cep`, chamar `lookup-cnpj` mesmo assim e preencher `razao_social`, `nome_fantasia`, `cnae_code`, `cnae_desc`, `porte`, `cep`, `cidade_enriched`, `uf_enriched`, `endereco`, e como fallback `email_public`/`phone_public`.
- Se o prospect **não tem CNPJ**, manter o fluxo atual (busca via Firecrawl + valida via lookup-cnpj).
- O `lookup-cnpj` já tem cache de 30 dias com fallback OpenCNPJ → BrasilAPI (regra registrada em memória), então não há custo extra significativo.

**Migração SQL** — Reforçar a RPC `import_prospect_to_pipeline` para casos onde o enrich nunca rodou:

- Antes do `INSERT INTO accounts`, se o prospect tem CNPJ mas **não tem** `cnae_code`/`endereco`/`cep`, chamar `pg_net` ou simplesmente **deixar a tarefa para a função de enrich** (preferir esse caminho).
- Melhor abordagem: o frontend (hook `useImportProspect`) deve chamar `enrich-prospect-identity` antes de chamar a RPC quando faltar dados de endereço/CNAE no prospect. Isso evita dependência de `pg_net` e mantém a RPC pura.

**Arquivo**: `src/hooks/useProspectImport.ts`

- Antes de `importViaRpc`, verificar se faltam campos críticos da conta (`cnae_code`, `cep` ou `endereco`). Se faltar e tiver CNPJ, invocar `supabase.functions.invoke('enrich-prospect-identity', { body: { prospect_id } })` e aguardar.
- Mesmo tratamento no `useBulkImportProspects` (com paralelismo controlado, batch de 5).
- Toast de progresso: "Enriquecendo dados…".

### 4. Disparo automático de e-mail via SMTP do usuário
**Migração SQL** — modificar a RPC `import_prospect_to_pipeline`:

- **Remover** o `INSERT INTO activities` de `type='email'` com título "Rascunho: e-mail inicial para…".
- **Manter** o `opportunity_notes` com o brief comercial (isso é útil).
- Em vez disso, retornar no JSON da RPC um campo `email_to_send` com `{ subject, body, to, opportunity_id, account_id, contact_id }` quando houver `commercial_brief.first_touch_message` e `email_public`.

**Nova Edge Function** `send-kairos-initial-email`:
- Recebe `{ opportunity_id, subject, body, to, account_id, contact_id }`.
- Verifica se o usuário (`auth.uid()`) tem SMTP configurado em `user_smtp_settings` (mesma fonte que `send-smtp-email` usa).
- **Se sim**: invoca internamente `send-smtp-email` (que já registra em `opportunity_emails` com tracking pixel/click, sincroniza com Gmail, etc — regra registrada em memória "SMTP fallback / Custom SMTP config").
- **Se não**: cria registro em `opportunity_emails` com `status='draft'` para o vendedor abrir na aba E-mails da oportunidade, completar e enviar (em vez da activity).
- Retorna `{ sent: bool, draft_id: uuid? }`.

**Arquivo**: `src/hooks/useProspectImport.ts`

- Após a RPC retornar com `email_to_send`, invocar `send-kairos-initial-email`.
- Toast contextual:
  - Se enviado: "✅ Importado e e-mail inicial disparado para {email}"
  - Se rascunho: "✉️ Importado — e-mail inicial salvo como rascunho na aba E-mails"
- No bulk: contar `emails_sent` e `emails_drafted`.

**Arquivo**: `src/components/playbook/ProspectDetailDrawer.tsx`

- Atualizar o texto que diz "Atividade de e-mail (rascunho) na timeline…" para refletir o novo comportamento ("E-mail inicial disparado automaticamente via seu SMTP, ou salvo como rascunho na aba E-mails se SMTP não estiver configurado").

---

## Arquivos impactados

- `src/components/playbook/RunHistoryTable.tsx` — coluna Fonte
- `src/hooks/useProspectImport.ts` — pré-enriquecimento + disparo de e-mail
- `src/components/playbook/ProspectDetailDrawer.tsx` — copy do "what happens"
- `src/components/playbook/enrichment/CommercialBriefCard.tsx` — copy do brief
- `supabase/functions/enrich-prospect-identity/index.ts` — sempre enriquecer endereço/CNAE quando tem CNPJ
- `supabase/functions/send-kairos-initial-email/index.ts` — **NOVA**
- Migração SQL: ajuste em `import_prospect_to_pipeline` (origem `kairos` + remoção da activity email + retorno de `email_to_send`)

---

## Riscos e Mitigações

- **Origem "kairos" pode quebrar relatórios** que filtram por `origem='lead_sourcing'`. Vou rodar `rg` para localizar e atualizar (provavelmente Win/Loss Hub e analytics de sourcing — regra de "Sourcing feedback loop" em memória).
- **Disparo automático sem revisão**: o vendedor recebe um e-mail saindo "em nome dele" sem ler. Mitigação: o brief comercial é gerado por IA com `confidence` e o `first_touch_message` segue regras estritas (1ª pessoa, máx 120 palavras, 1 pergunta de qualificação) — o sistema só dispara se houver `commercial_brief.first_touch_message` E `email_public` válido. Caso contrário, vira rascunho.
- **Custo Firecrawl/OpenCNPJ**: o pré-enriquecimento na importação aumenta chamadas, mas há cache de 30d no `lookup-cnpj` (regra de memória "CNPJ lookup resilience"), então o impacto real é baixo em re-imports.
- **Compatibilidade com o sourcing já feito (BETT/FEIMEC)**: nada do scraping muda. Apenas o fluxo pós-aprovação.

---

## Próximos passos

Após aprovação, executo na ordem:
1. Migração SQL da RPC (origem + remover activity + retornar email_to_send).
2. Ajustar `enrich-prospect-identity` e re-deploy.
3. Criar e deployar `send-kairos-initial-email`.
4. Atualizar `useProspectImport`, `RunHistoryTable`, `ProspectDetailDrawer` e `CommercialBriefCard`.
5. Atualizar memórias (`mem://`) com a nova origem `kairos` e o novo fluxo de e-mail Kairós.