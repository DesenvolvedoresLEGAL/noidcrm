

# Email Analytics: Abertura, Leitura, Cliques e Tempo

## Como funciona (conceito)

Emails enviados via SMTP são "fire and forget" — depois de enviados, não temos controle direto. Para rastrear engajamento, usamos técnicas padrão da indústria:

1. **Abertura (Open tracking)**: Pixel invisível 1x1 inserido no HTML do email. Quando o destinatário abre o email, o cliente de email carrega a imagem, gerando uma requisição HTTP para nossa Edge Function que registra o evento.

2. **Clique em links**: Os links no corpo do email (especialmente o link da proposta) são substituídos por URLs de redirecionamento que passam pela nossa Edge Function antes de redirecionar ao destino final.

3. **Tempo no email**: Estimado pela diferença entre primeiro e último carregamento do pixel (alguns clientes recarregam periodicamente). Limitação: não é tão preciso quanto o tracking da proposta.

> **Limitação importante**: Clientes de email que bloqueiam imagens externas (ex: Outlook com config restritiva, Apple Mail Privacy Protection) não registrarão abertura. Isso é padrão da indústria — taxas de abertura reais são sempre maiores que as reportadas.

## Alterações

### 1. Nova Edge Function: `track-email-open`
- Recebe `emailId` como query param
- Retorna imagem 1x1 pixel transparente (GIF)
- Atualiza `opportunity_emails`: incrementa `opened_count`, define `opened_at` na primeira abertura
- Registra IP, User-Agent, timestamp

### 2. Nova Edge Function: `track-email-click`  
- Recebe `emailId` e `url` (destino original) como query params
- Registra o clique em `link_clicks` (JSONB) com URL, timestamp, IP
- Define `clicked_at` na primeira vez
- Redireciona (302) para a URL original

### 3. Modificar `send-smtp-email/index.ts`
- Antes de enviar, processar o `html_body`:
  - Inserir pixel de tracking no final do HTML (`<img src="...track-email-open?id=EMAIL_ID" width="1" height="1">`)
  - Substituir links `href` por URLs de redirecionamento via `track-email-click`
- Isso requer inserir o registro no banco ANTES de enviar (para ter o `emailId`)

### 4. Atualizar UI: `OpportunityEmailsTab.tsx`
- Mostrar indicadores visuais em cada email da lista:
  - Badge "Aberto" (verde) com contagem de aberturas e data
  - Badge "Clicado" (azul) quando houve clique em link
  - Tooltip com detalhes (primeira abertura, última abertura, links clicados)
- No modal de detalhe do email, seção "Analytics" com:
  - Timeline de aberturas
  - Links clicados com timestamps
  - Contagem total de aberturas

### 5. Atualizar `OpportunityEmail` interface
- Adicionar campos `opened_at`, `opened_count`, `clicked_at`, `link_clicks` na interface TypeScript (já existem no banco)

## Arquivos impactados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/track-email-open/index.ts` | **Criar** — pixel tracking |
| `supabase/functions/track-email-click/index.ts` | **Criar** — link redirect tracking |
| `supabase/functions/send-smtp-email/index.ts` | **Modificar** — injetar pixel e reescrever links |
| `src/components/opportunity/OpportunityEmailsTab.tsx` | **Modificar** — exibir analytics |
| `src/services/supabase/opportunity-emails.ts` | **Modificar** — adicionar campos na interface |

## Fluxo

```text
Vendedor envia email
       │
       ▼
send-smtp-email:
  1. Insere registro no banco (pega emailId)
  2. Injeta pixel: <img src=".../track-email-open?id=EMAIL_ID">
  3. Reescreve links: href → .../track-email-click?id=EMAIL_ID&url=ORIGINAL
  4. Envia via SMTP
       │
       ▼
Cliente abre email ──► pixel carrega ──► track-email-open ──► UPDATE opened_at, opened_count
       │
       ▼
Cliente clica link ──► track-email-click ──► UPDATE link_clicks, clicked_at ──► 302 redirect
```

## Resultado esperado
- Cada email na lista mostra se foi aberto e quantas vezes
- Cliques em links da proposta são rastreados
- Analytics visíveis diretamente na aba de E-mails da oportunidade

