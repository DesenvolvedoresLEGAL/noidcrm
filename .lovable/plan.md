## Plano cirúrgico para destravar Publish/Update

### Escopo
- Alterar somente pipeline de build e registro PWA/service worker.
- Não alterar telas, rotas, UI, banco, regras de negócio ou integrações de CRM.

### Causa provável
- `package.json` mostra que o Publish usa o script real de produção: `npm run build` → `vite build`.
- O `vite.config.ts` ainda inclui `vite-plugin-pwa` no build de produção por padrão.
- Mesmo sem `virtual:pwa-register` estático em `src/main.tsx`, o build de produção ainda entra no fluxo `vite-plugin-pwa`/Workbox, que é compatível com a assinatura do erro assíncrono do Lovable (`readFile/open` via Vite/Rollup depois de milhares de módulos transformados).

### Implementação proposta
1. **Gating explícito do PWA no `vite.config.ts`**
   - Calcular `shouldEnablePWA` com regra segura:
     - `command === 'build'`
     - `mode === 'production'`
     - `process.env.VITE_ENABLE_PWA === 'true'`
     - `process.env.CI !== 'true'`
     - não detectar ambiente Lovable/builder/preview por variáveis comuns (`LOVABLE_*`, `GITHUB_ACTIONS`, etc.)
   - Só incluir `VitePWA(...)` no array de plugins quando `shouldEnablePWA === true`.
   - Resultado esperado: no Publish padrão do Lovable, o plugin PWA não entra no pipeline.

2. **Registro de service worker seguro em `src/main.tsx`**
   - Manter removido qualquer import obrigatório de `virtual:pwa-register`.
   - Ajustar o registro manual de `/sw.js` para só executar quando:
     - `import.meta.env.PROD`
     - `import.meta.env.VITE_ENABLE_PWA === 'true'`
     - fora de iframe/preview/Lovable preview
   - Assim, quando o PWA estiver desabilitado no build, nenhum caminho de runtime tenta registrar `/sw.js`.

3. **Lockfile sincronizado**
   - Garantir que `package-lock.json` esteja sincronizado com `package.json` para `npm ci` passar em ambiente limpo.
   - Não adicionar/remover dependências, salvo se o lockfile exigir apenas sincronização.

### Validação obrigatória
Em uma cópia limpa sem `node_modules` e sem `dist`:
1. `npm ci`
2. `npm run build`
3. `npm run build:dev`

Além disso, verificar nos logs que não aparecem erros relacionados a:
- `readFile`
- `open`
- `virtual:pwa`
- `service worker`
- `workbox`
- `vite-plugin-pwa`
- filesystem/Rollup load fallback

### Entrega final
Ao concluir, retornar:
- arquivos alterados;
- causa raiz;
- confirmação explícita de teste de `npm run build` e `npm run build:dev` em cópia limpa;
- riscos.