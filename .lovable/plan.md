

# Análise Forense: Sincronização de Respostas Gmail Quebrada

## O que aconteceu (evidência do banco)

Email enviado pelo Email Agent para a Frasnelli (`7afc6ff7...`):
- ✅ Gravado em `opportunity_emails` (direction=outbound)
- ✅ Tracking pixel funcionou (5 aberturas, última `2026-04-21 18:18`)
- ❌ `gmail_message_id` = **NULL**
- ❌ `gmail_thread_id` = **NULL**

A cliente Viviane respondeu pelo Gmail dela em ~17h depois (vista no print do Gmail). Mas o sync não trouxe a resposta porque não consegue correlacionar.

## Causas raiz (3 bugs reais, em camadas)

### Bug 1 — A busca pós-envio no Gmail nunca encontra o email enviado

No `send-smtp-email-internal` (linha 227), depois do SMTP, ele tenta:
```
from:wagner@operadora.legal to:viviane@frasnelli.com.br subject:"..." newer_than:1h
```
**Problemas:**
1. Roda **sincronamente logo após o `client.send()`** — o Gmail leva de poucos segundos a alguns minutos para indexar a mensagem em `Sent`. Na maioria dos envios, a busca volta vazia. Por isso `gmail_message_id` fica NULL.
2. O envio é **via SMTP do `operadora.legal`** (não pela API do Gmail), então o Gmail só consegue ver o email enviado se o `from_email` também for um endereço Gmail/Workspace conectado à conta OAuth. Se o domínio `operadora.legal` não estiver no Workspace dessa conta Gmail, **o "Sent" do Gmail nunca terá esse email** — e a correlação falha para sempre.
3. Não há retry assíncrono. Falhou uma vez = perdido.

### Bug 2 — O `Message-ID` customizado não está sendo aplicado pelo denomailer

Linha 188:
```ts
sendOptions.headers = { "Message-ID": customMessageId };
```
O `denomailer` v1.6.0 **ignora** a chave `headers` quando passada via `sendOptions` no formato simples — ele espera `internalTag` ou `inReplyTo`/`references` em campos próprios, e/ou `headers` como `Map`. Resultado: o servidor SMTP gera um `Message-ID` aleatório e perdemos a âncora que permitiria casar com o thread Gmail via header `In-Reply-To`/`References` quando ela respondesse.

### Bug 3 — O fallback do `sync-email-replies` por subject também falha aqui

Quando `gmail_thread_id` está NULL, ele cai em (linha 243):
```
from:viviane@frasnelli.com.br subject:"Bate papo sobre proposta de conectividade"
```
**Problemas:**
1. A query Gmail aceita esse formato, mas o subject **com aspas e acentos** muitas vezes retorna 0 resultados quando o cliente respondeu com `Re:` (Gmail trata `Re:` como prefixo, mas a busca exata de subject sem `Re:` às vezes só pega o original).
2. Não há nenhuma tentativa de buscar **por destinatário + janela de tempo** (ex.: "qualquer email recente de `viviane@frasnelli.com.br` para mim"), que seria o fallback robusto.
3. O loop só processa os 50 últimos outbounds; se o usuário tem muitos, o da Frasnelli pode nem entrar.

## Plano de correção (ataque cirúrgico nas 3 camadas)

### Camada 1 — Garantir captura do `gmail_thread_id` no envio

Em `send-smtp-email-internal/index.ts`:
- **Estratégia primária**: parar de depender da indexação imediata. Em vez de buscar 1 vez, agendar a busca via `EdgeRuntime.waitUntil` com **3 tentativas (5s, 30s, 120s)** após o envio. Isso roda em background, não bloqueia a resposta SMTP, e cobre a janela de indexação do Gmail.
- **Salvar `Message-ID`** corretamente como header SMTP usando o formato que o denomailer 1.6 aceita (`headers: new Map([["Message-ID", id]])` ou via `internalTag`). Confirmar via teste curl.
- Quando `from_email` **não pertencer ao domínio Gmail/Workspace conectado**, registrar `last_sync_error` informativo na linha do `email_sync_config` ("emails enviados de outros domínios não aparecem no Sent do Gmail; respostas serão correlacionadas por header") e pular a busca primária — passar direto pra Camada 3.

### Camada 2 — Tornar o `Message-ID` real e verificável

- Salvar o `Message-ID` enviado em uma nova coluna `message_id_header` em `opportunity_emails` (migração: `ALTER TABLE opportunity_emails ADD COLUMN message_id_header TEXT`).
- Esse header é o que o cliente coloca em `In-Reply-To` quando responde. Com isso a Camada 3 fica determinística.

### Camada 3 — Reescrever `sync-email-replies` com 3 estratégias em cascata

Para cada outbound dos últimos 30 dias (não 50 itens):
1. **Estratégia A (determinística)**: se `gmail_thread_id` existe → buscar por `threadId` (já funciona).
2. **Estratégia B (header)**: se `message_id_header` existe → buscar Gmail com `rfc822msgid:<id>` e também `in-reply-to:<id>` — pega tanto o original (se entrou no Sent) quanto qualquer reply que cite esse ID. Quando achar, salvar `gmail_thread_id` para acelerar próximas sincs.
3. **Estratégia C (heurística por janela)**: buscar `from:<recipient> to:me newer_than:30d` e, para cada match, comparar `In-Reply-To`/`References` do header com `message_id_header` da nossa outbound; ou comparar subject normalizado (remover `Re:`, `Fwd:`, espaços, lowercase, sem acento). Match = inbound dessa opportunity.

Adicionar também:
- **Sync abrangente**: quando o usuário aciona "Sincronizar respostas" sem `opportunity_id`, varrer **todas as outbounds dos últimos 60 dias** sem `gmail_thread_id`, não só as 50 mais recentes.
- **Toast informativo**: quando 0 respostas são encontradas mas existem outbounds sem `gmail_thread_id`, retornar `{ synced: 0, hint: "X emails enviados ainda não têm thread Gmail correlacionado. Tentando por header..." }` para a UI mostrar o estado real.

### Camada 4 — Corrigir o caso atual da Frasnelli imediatamente

Como já existe a outbound `7afc6ff7...` sem `gmail_thread_id` e a resposta está no Gmail da Viviane:
- Após deploy, executar **uma vez** o sync com a nova Estratégia C — vai achar o email da Viviane no Gmail por `from:viviane@frasnelli.com.br to:me newer_than:7d`, validar via subject normalizado, e inserir o inbound + notificação.

## Arquivos tocados

**Backend**
- `supabase/functions/send-smtp-email-internal/index.ts` — Message-ID via Map (denomailer), busca thread em background com 3 retries, gravar `message_id_header`.
- `supabase/functions/sync-email-replies/index.ts` — 3 estratégias em cascata, janela 30/60 dias, normalização de subject (acento/case/prefixos).
- **Migração**: `ALTER TABLE opportunity_emails ADD COLUMN message_id_header TEXT;` + index parcial.

**Frontend**
- `src/services/supabase/opportunity-emails.ts` — propagar campo `hint` do retorno do sync para o toast.
- `src/components/opportunity/OpportunityEmailsTab.tsx` (ou onde está o botão "Sincronizar respostas") — mostrar hint quando vier.

## Validação pós-deploy

1. Disparar sync na opp Frasnelli → resposta da Viviane deve aparecer como inbound no histórico, com badge "Cliente respondeu" e notificação no Inbox.
2. Enviar novo email pelo Email Agent → checar em ~2 min se `gmail_thread_id` foi preenchido (background job). Se domínio não-Gmail, checar `message_id_header`.
3. Cliente responder → próximo sync deve achar via Estratégia B (header) mesmo sem thread_id.
4. Disparar 3 emails de teste com domínios diferentes (Gmail próprio, Workspace, domínio externo) e validar que todos correlacionam corretamente.

## Riscos

- A busca por `from:<recipient> to:me newer_than:30d` consome quota Gmail API. Mitigação: limitar a 1 chamada por outbound única (deduplicar por recipient+subject) e cachear o resultado por 5 min.
- O background `waitUntil` no SMTP precisa que a função siga viva até terminar — Supabase Edge suporta até 150s, mais que suficiente para os 3 retries (5s+30s+120s = 155s). Reduzir para (3s, 20s, 90s) para caber com folga.

