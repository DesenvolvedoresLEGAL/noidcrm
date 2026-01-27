
## O que está acontecendo (diagnóstico “de uma vez por todas”)

Você está vendo dois sintomas ao mesmo tempo:

1) **Runtime no navegador**: `Cannot read properties of undefined (reading 'createContext')` em `vendor-*.js`  
Isso normalmente ocorre quando, no bundle final, algum pacote está tentando acessar `React.createContext`, mas o objeto `React` que ele recebeu está **undefined**. As causas mais comuns neste cenário Vite + React + PWA são:
- **duas instâncias de React** no bundle (dedupe falhando) ou interop CJS/ESM quebrado
- **service worker registrando/atualizando em duplicidade** e servindo assets inconsistentes (index/JS mismatch)
- **code-splitting extremo** (muitos chunks) + SW/cache => ordem/versões inconsistentes

2) **Publish/build pipeline**: o log mostra “transforming/rendering chunks” e cria milhares de arquivos; depois aparece “Publishing failed”. Isso indica que o build está gerando **um número absurdo de chunks** (por exemplo, centenas/milhares de pequenos arquivos), o que pode causar **timeout/limites do pipeline** e, mesmo quando publica, aumenta muito o risco do SW servir combinações inconsistentes.

Pontos concretos que vi no seu código:
- O `vite.config.ts` está “normal”, sem manualChunks agora, mas o build ainda gera **muitos chunks minúsculos** (isso é um alerta).
- Você tem **dois mecanismos de registro do Service Worker** ao mesmo tempo:
  - `VitePWA({ registerType: "autoUpdate" })` (isso injeta/gera `registerSW.js`)
  - `src/main.tsx` registrando manualmente `navigator.serviceWorker.register("/sw.js")`
  
Essa duplicidade é um forte candidato a causar “loop de update”, cache inconsistente e, no fim, o `createContext` quebrar por carregar JS antigo/errado.

---

## Estratégia de correção (objetivo: estabilidade imediata)

Vamos atacar em 3 frentes, em ordem de impacto:

### Frente A — Unificar e corrigir o Service Worker (eliminar duplicidade)
1) **Remover o registro manual** do SW em `src/main.tsx`.
2) **Usar o método recomendado do vite-plugin-pwa** via `virtual:pwa-register` (um único ponto de registro).
3) Manter comportamento “autoUpdate”, mas com controle: quando detectar `onNeedRefresh`, acionar `updateSW(true)` e recarregar.
4) Garantir que não haja “dois SW brigando” e que o update seja previsível.

Resultado esperado: para de ter update loop e mismatch de assets que derruba o app.

---

### Frente B — Forçar dedupe de React/ReactDOM (garantir uma única instância)
No `vite.config.ts`:
1) Adicionar `resolve.dedupe: ["react", "react-dom"]`.
2) (Opcional/forte) Adicionar `optimizeDeps.include: ["react", "react-dom"]` para reduzir chances de interop estranho em dev/prod.
3) Verificar se não existe import indireto “duplicando” React (por monorepo/symlink — aqui é improvável, mas o dedupe resolve).

Resultado esperado: qualquer pacote que dependa de React recebe a mesma instância e `createContext` não fica undefined.

---

### Frente C — Reduzir drasticamente a quantidade de chunks (estabilidade de publish + cache)
Como medida “urgente/definitiva” para estabilizar publicação e evitar milhares de assets:
1) No `vite.config.ts`, aplicar uma estratégia de bundling mais conservadora:
   - Opção 1 (mais robusta para “apagar incêndio”): `build.rollupOptions.output.inlineDynamicImports = true`  
     Isso **desliga code splitting** (incluindo routes lazy) e gera poucos arquivos.
   - Opção 2 (meio-termo): limitar splitting com `manualChunks` simples (ex.: `vendor` único) e evitar micro-chunks.
2) Validar que o build de produção passa sem “Publishing failed” e com número bem menor de arquivos.

Trade-off: bundle fica maior, mas para CRM isso é aceitável por enquanto. Depois a gente reintroduz splitting com cuidado.

---

## Sequência de implementação (passo a passo)

1) **Ler/confirmar o conteúdo atual de `src/main.tsx`** e remover o bloco de registro manual do SW.
2) **Adicionar** em `src/main.tsx` o registro via `virtual:pwa-register` (um único registro).
3) **Atualizar `vite.config.ts`**:
   - adicionar `resolve.dedupe`
   - aplicar estratégia anti-micro-chunk (inlineDynamicImports ou vendor único)
   - manter `globPatterns` sem HTML (já está correto)
4) **Publicar**.
5) **Verificação pós-publish**:
   - abrir o site em aba anônima (evita cache antigo)
   - confirmar que não aparece mais `createContext`
   - confirmar que as páginas carregam
6) Se ainda houver erro, última etapa “cirúrgica”:
   - instrumentar log no bootstrap (antes do React render) para confirmar versão/execução do SW e se `import("react")` retorna namespace válido (diagnóstico definitivo).

---

## Arquivos que serão alterados

- `src/main.tsx`
  - remover registro manual de SW
  - usar `virtual:pwa-register` e controlar update
- `vite.config.ts`
  - adicionar `resolve.dedupe`
  - reduzir chunks (inlineDynamicImports ou vendor único)

---

## Critérios de sucesso

- Published URL carrega a home e rotas /app sem erro no console
- Nenhum `createContext undefined` em `vendor-*.js`
- Publish deixa de falhar intermitentemente
- Service Worker atualiza sem loop e sem quebrar assets

---

## Observação importante (para não perder tempo)
O log que mostra “✓ 5214 modules transformed” e depois “Build errors truncated” geralmente não é erro de compilação; o problema real aqui é **runtime/cache/chunking** + **duplicidade de service worker**. O plano acima elimina esses fatores na raiz.
