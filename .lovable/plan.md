

## Análise Forense

**Erro**: `Uncaught ReferenceError: Cannot access '$' before initialization` em `vendor-CVwby_-l.js:1:10075`

**Causa raiz**: Circular dependency entre chunks gerada pelo `manualChunks` atual. Quando você divide vendors em múltiplos chunks (`vendor`, `charts-vendor`, `editor-vendor`, `motion-vendor`, `pdf-excel-vendor`), o Rollup pode gerar referências cruzadas. Variáveis minificadas (`$`) ficam em TDZ porque o chunk A espera o chunk B que espera o A.

Foi exatamente esse tipo de problema que já enfrentamos com Radix/React (corrigido no fix anterior). Agora o problema migrou pra `recharts ↔ vendor` (recharts importa lodash/d3 que está em `vendor`, e algo em `vendor` importa de volta).

## Fix

**Estratégia segura**: consolidar TODOS os vendors em **2 chunks apenas**:
1. `react-vendor` — React + Radix + tudo que toca React internals (já está correto)
2. `vendor` — TODO o resto (recharts, tiptap, framer-motion, lodash, d3, etc.)

Manter separados apenas os que são **carregados via `await import()`** (jspdf, xlsx) — esses não criam ciclo porque são lazy de verdade.

### Mudança em `vite.config.ts`

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;

  // React + tudo que depende de React internals
  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/react/jsx-runtime') ||
    id.includes('/scheduler/') ||
    id.includes('@radix-ui') ||
    id.includes('react-remove-scroll') ||
    id.includes('react-style-singleton') ||
    id.includes('use-callback-ref') ||
    id.includes('use-sidecar') ||
    id.includes('aria-hidden') ||
    id.includes('@floating-ui')
  ) {
    return 'react-vendor';
  }

  // Apenas libs que SÃO carregadas via dynamic import ficam isoladas
  // (não causam ciclo porque não são importadas pelo bundle inicial)
  if (id.includes('jspdf') || id.includes('xlsx') || id.includes('papaparse')) {
    return 'pdf-excel-vendor';
  }

  // TUDO o resto (recharts, tiptap, framer-motion, lodash, d3, prosemirror...)
  // vai num único chunk → zero ciclo possível
  return 'vendor';
}
```

E adicionar comentário-marcador para forçar novo build/commit.

## Por que isso resolve

- Rollup só cria ciclo entre chunks quando há imports de A→B e B→A
- Com **um único** chunk pra "tudo que não é React", impossível ter ciclo entre chunks (vira ciclo intra-chunk, que o Rollup ordena corretamente)
- `pdf-excel-vendor` continua isolado porque é carregado via `await import()` (lazy real, sem referência síncrona)

## Risco

- Bundle `vendor` fica maior (~400KB extras), mas ainda muito menor que o bundle único pré-otimização
- TTI ainda melhora vs estado original; trade-off necessário pra eliminar o crash

## Próximo passo (após approve)

1. Editar `vite.config.ts` removendo `charts-vendor`, `editor-vendor`, `motion-vendor`
2. Atualizar comentário de build trigger
3. Aguardar republicação — usuário precisará hard-refresh (Ctrl+Shift+R)

