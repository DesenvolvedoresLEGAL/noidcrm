

## Fix: Scraping de páginas com scroll infinito / lazy loading

### Problema

Páginas de eventos com 800+ expositores usam lazy loading — o conteúdo só carrega conforme o usuário rola a tela. O Firecrawl captura apenas o conteúdo visível no primeiro render, resultando em apenas ~50 expositores.

### Solução

A API do Firecrawl v1 suporta o parâmetro `actions` no endpoint de scrape, que permite executar ações no navegador antes da extração. Vamos usar ações de `scroll` repetidas para forçar o carregamento de todo o conteúdo lazy-loaded.

### Mudança técnica

**Arquivo:** `supabase/functions/lead-sourcing/index.ts`

No Step 3 (Scrape) do `handleEventFirecrawl`, adicionar ações de scroll ao body do request de scrape para páginas de lista de expositores:

```typescript
// Para páginas de lista (exhibitors_list), usar scroll actions
const isListPage = page.page_type === "exhibitors_list";
const scrapeBody: any = {
  url: page.url,
  formats: ["markdown"],
  onlyMainContent: true,
  waitFor: 2000, // esperar 2s para JS inicial carregar
};

if (isListPage) {
  // Scroll repetido para carregar todo conteúdo lazy-loaded
  scrapeBody.actions = [
    { type: "scroll", direction: "down", amount: 3 },
    { type: "wait", milliseconds: 2000 },
    { type: "scroll", direction: "down", amount: 3 },
    { type: "wait", milliseconds: 2000 },
    { type: "scroll", direction: "down", amount: 3 },
    { type: "wait", milliseconds: 2000 },
    { type: "scroll", direction: "down", amount: 3 },
    { type: "wait", milliseconds: 2000 },
    { type: "scroll", direction: "down", amount: 3 },
    { type: "wait", milliseconds: 2000 },
  ];
}
```

Isso faz 5 ciclos de scroll-para-baixo + espera, cobrindo a maioria das páginas com lazy loading. A combinação de `amount: 3` (3 viewports por scroll) e 5 repetições percorre ~15 viewports de conteúdo.

Adicionalmente, aumentar o limite de markdown enviado à AI de 15.000 para 50.000 caracteres para acomodar listas maiores, e logar quantos caracteres foram capturados para diagnóstico.

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/lead-sourcing/index.ts` | Adicionar `actions` de scroll + `waitFor` no scrape de páginas de lista; aumentar limite de chars para AI |

