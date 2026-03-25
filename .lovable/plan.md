

## Problema

Quando você compartilha o link da proposta no WhatsApp, o crawler do WhatsApp lê o `index.html` estático e pega as meta tags fixas:
```
<meta property="og:title" content="NOID CRM - Sistema de Gestão Comercial Inteligente">
```

Como é um SPA (Single Page App), o WhatsApp nunca executa JavaScript - ele só vê esse título genérico, independente da proposta.

## Solução

Criar uma Edge Function `og-proposal-meta` que intercepta links de proposta e retorna HTML com meta tags dinâmicas (título da oportunidade, nome do cliente, etc.) para crawlers. Para navegadores normais, redireciona ao SPA.

### Fluxo

```text
WhatsApp/Crawler → /api/p/:token → Edge Function → HTML com OG dinâmico
Navegador humano → /api/p/:token → Redirect 302 → /p/:token (SPA)
```

### Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/og-proposal-meta/index.ts` | CRIAR - Edge Function que consulta a proposta pelo token e retorna HTML com OG tags dinâmicas |
| `supabase/config.toml` | ATUALIZAR - registrar a nova function |

### Como a Edge Function funciona

1. Recebe o token da proposta via query param ou path
2. Consulta `proposals` + `opportunities` + `accounts` + `organizations` pelo `public_token`
3. Detecta se é crawler (via User-Agent: WhatsApp, facebookexternalhit, Telegram, etc.)
   - **Se crawler**: retorna HTML mínimo com `og:title` = título da oportunidade (ex: "Proposta Personalizada para FEICON 2026"), `og:description` com valor/itens, `og:image` com logo da org
   - **Se navegador**: redireciona 302 para `/p/:token` no frontend
4. O link compartilhado será no formato: `https://{SUPABASE_URL}/functions/v1/og-proposal-meta?token=xxx`

### Mudança no frontend

Atualizar os locais que geram o link público da proposta para usar a URL da Edge Function em vez do path direto do SPA:

| Arquivo | Mudança |
|---------|---------|
| `src/components/proposals/ProposalsList.tsx` | URL do link público → Edge Function |
| `src/components/proposals/ProposalActionsBar.tsx` | URL do link público → Edge Function |
| `src/components/proposals/ProposalEditorHeader.tsx` | URL do link público → Edge Function |
| `src/components/opportunity/OpportunityProposalsTab.tsx` | URL do link público → Edge Function |
| `src/pages/ProposalEditor.tsx` | URL do link público → Edge Function |
| `supabase/functions/send-proposal-email/index.ts` | URL no email → Edge Function |

### Exemplo de OG tags geradas

```html
<meta property="og:title" content="Proposta Personalizada para FEICON 2026">
<meta property="og:description" content="Proposta comercial de Empresa XYZ - R$ 15.000,00">
<meta property="og:image" content="https://logo-da-org.png">
<meta property="og:url" content="https://noidcrm.humanoid-os.ai/p/abc123">
```

### Resultado

No WhatsApp, em vez de "NOID CRM - Sistema de Gestão Comercial Inteligente", aparecerá o título da oportunidade/proposta personalizado.

