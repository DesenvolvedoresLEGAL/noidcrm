

## Diagnóstico: Por que parou em 248 de 800+

Os logs da run mostram claramente o gargalo:

```text
Firecrawl Map → 1 página descoberta (só a URL base)
0 list pages scrapped (URL classificada como profile, não list)
1 profile scrapped → markdown dividido em 2 chunks de 40k
251 expositores extraídos → 248 após dedupe
```

**O problema é o site da Agrishow ser uma SPA (Single Page Application) com lazy-loading.** O Firecrawl Map não encontra sub-URLs porque não existem — todo o conteúdo é carregado dinamicamente via JavaScript na mesma página. Mesmo com 20 scrolls, o Firecrawl só capturou ~1/3 do conteúdo total.

### Ajustes necessários

**1. Aumentar profundidade de scroll para SPAs**
- Atualmente: 20 scrolls × 5 unidades = cobertura parcial
- Necessário: 60+ scrolls para páginas com 800+ itens lazy-loaded
- Adicionar detecção de "fim da lista" (quando o conteúdo para de crescer entre scrolls)

**2. Estratégia de scrape múltiplo para listas grandes**  
- Se o markdown retornado de 1 scrape tiver alta densidade de empresas (>100), fazer um segundo scrape com mais scrolls ou com `actions` que clicam em filtros alfabéticos (A-Z)
- Tentar Firecrawl com `actions` de clique em letras do alfabeto se detectar filtros A-Z no HTML

**3. Fallback: batch scrape com diferentes pontos de entrada**
- Se a página tiver filtros alfabéticos visíveis no HTML, gerar URLs ou ações para cada letra
- Scrape por letra (A, B, C... Z) para garantir cobertura total

**4. Adicionar botão de deletar execuções**
- Adicionar botão de delete em cada card do `RecentRunsList`
- Criar hook `useDeletePlaybookRun` que deleta a run e seus prospects/scores/signals em cascata
- Adicionar confirmação antes de deletar

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/lead-sourcing/index.ts` | Aumentar scrolls para 60, adicionar detecção de filtros A-Z, multi-scrape para SPAs |
| `src/hooks/useLeadSourcingV2.ts` | Adicionar `useDeletePlaybookRun` |
| `src/components/playbook/RecentRunsList.tsx` | Botão de deletar em cada card com confirmação |

### Resultado esperado
- Cobertura de 700-800+ expositores em SPAs como a Agrishow
- Capacidade de limpar o histórico de execuções diretamente pela UI

