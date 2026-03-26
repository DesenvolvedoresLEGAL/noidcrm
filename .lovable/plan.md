

## Problema

O preview do link no WhatsApp mostra "NOID CRM - Sistema de Gestão Comercial Inteligente" (metadados genéricos do site) em vez do título da oportunidade. Além disso, a imagem OG usa apenas o logo da organização, mas poderia usar o logo do cliente (conta) para personalizar mais.

**Causa raiz**: A edge function `og-proposal-meta` já busca `opportunity.title` e já monta o `og:title` corretamente no código. Porém, o WhatsApp provavelmente cacheou o preview antigo, OU o link sendo compartilhado é o link direto do SPA (`/p/:token`) em vez do link via edge function (`/functions/v1/og-proposal-meta?token=...`). Preciso verificar qual URL está sendo usada no compartilhamento.

Pela screenshot, o link compartilhado é `https://noidcrm.humanoid-os.ai/p/926c63b...` — ou seja, é o link direto do SPA, **não passa pela edge function**. Por isso o WhatsApp pega os meta tags genéricos do `index.html`.

## Plano

### 1. Corrigir a URL de compartilhamento — `src/lib/proposalUrl.ts`

Verificar se `buildProposalPublicUrl` está sendo usado corretamente ao compartilhar. O domínio na screenshot é `noidcrm.humanoid-os.ai` mas a edge function aponta para `urihdqturaebhiefwjnw.supabase.co`. Preciso garantir que o link compartilhado passe pela edge function.

**Ação**: Verificar onde o "link rápido" é gerado e garantir que usa `buildProposalPublicUrl` (que passa pela edge function) em vez de `buildProposalDirectUrl`.

### 2. Adicionar logo do cliente na OG image — `supabase/functions/og-proposal-meta/index.ts`

**Alterar a query** para incluir a conta vinculada via oportunidade:
```sql
opportunity:opportunities(title, account:accounts(logo_url, nome_fantasia))
```

**Alterar a lógica da og:image**: usar o `account.logo_url` como prioridade, com fallback para `org.logo_url`:
```ts
const accountLogoUrl = proposal.opportunity?.account?.logo_url;
const ogImage = accountLogoUrl || org?.logo_url || '';
```

### 3. Verificar onde o link é copiado/compartilhado

Preciso localizar o componente que gera o "link rápido" para confirmar se está usando a função correta.

---

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `og-proposal-meta/index.ts` | Expandir query para buscar `account.logo_url` via opportunity; usar como og:image com fallback para org logo |
| Componente de compartilhamento (a identificar) | Garantir uso de `buildProposalPublicUrl` para que o link passe pela edge function |

