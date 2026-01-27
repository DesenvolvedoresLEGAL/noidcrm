
<contexto-e-diagnostico>
Você já tentou publicar mais de 20 vezes, inclusive revertendo para versões antigas que antes publicavam, e mesmo assim o “Publish” fica carregando e termina em “Production build error: Publishing failed”. Os logs de build mostram “✓ 5214 modules transformed”, ou seja: o Vite está conseguindo compilar e gerar o dist. Isso aponta para falha na etapa pós-build (upload/deploy/ativação) ou um problema de sessão/cache do editor (não do código em si).

Além disso, há sinais de sessão/autenticação instável no Preview: chamadas para a função `get-current-user` retornando 401 e tentativa de refresh token inválido (“refresh_token_not_found”). Isso normalmente se resolve limpando storage/cookies/service worker e refazendo login, e pode também afetar o fluxo do editor se ele depender da sessão.
</contexto-e-diagnostico>

<objetivo>
1) Destravar a publicação (deploy) de forma confiável.
2) Se necessário, aplicar mudanças técnicas que reduzam risco de timeout/limites (muitos chunks/arquivos) e evitem travas no pipeline de publicação.
3) Caso seja um problema da infraestrutura, criar um caminho de contorno (remix/novo build) e coletar evidências para suporte.
</objetivo>

<passo-a-passo-acao-imediata-sem-codigo (5-10 min)>
1) “Reset” de cache e sessão do projeto (desktop)
   - Fechar todas as abas do projeto (Preview e Published).
   - No navegador: limpar dados do site do domínio do projeto (cookies + localStorage + cache) e remover o service worker.
     - Em geral: DevTools → Application → Storage → “Clear site data”
     - Ainda em Application → Service Workers → “Unregister”
   - Reabrir o editor e fazer login novamente no app (se houver tela de login).
   - Tentar Publish novamente.

2) Teste em janela anônima (incognito) e/ou outro navegador
   - Abrir o editor em uma janela anônima (isso elimina extensões, cookies antigos e service worker).
   - Repetir a tentativa de Publish.

3) Verificar se o “Publish falhou” é real ou apenas falha de UI
   - Abrir o site publicado (URL publicada).
   - Confirmar se alguma mudança recente aparece (às vezes o deploy conclui, mas a UI do editor acusa falha).
   - Se não dá para confirmar visualmente, no próximo passo (com código) vamos inserir um “build id” visível no app para checar facilmente.

Critério de sucesso desse bloco: se depois de limpar storage/SW e relogar o publish passa, não precisamos mexer em build.
</passo-a-passo-acao-imediata-sem-codigo>

<investigacao-tecnica (somente leitura + evidencias)>
1) Coletar evidência do erro de publish
   - Repetir Publish uma vez após limpeza.
   - Capturar screenshot do modal/erro e, se existir, qualquer “error id”/timestamp.

2) Conferir que o build realmente não quebra
   - Os logs atuais já indicam build ok. Vamos tratar “Build errors truncated” como truncamento por volume de saída, não erro real do Vite.

3) Mapear risco de “muitos chunks / muitos assets”
   - Seu build está gerando centenas/milhares de arquivos pequenos (vários chunks com nomes de ícones etc). Em alguns pipelines, isso pode causar timeout no upload ou limite interno.
</investigacao-tecnica>

<plano-de-correcao-no-codigo (quando voce aprovar e eu puder implementar)>
Se os passos sem código não resolverem (ou se voltarem a falhar), a correção mais pragmática do lado do projeto é reduzir a quantidade de arquivos gerados no dist e o custo do build, para diminuir chance de timeout/falha na etapa de deploy.

A) Reduzir custo do build e quantidade de arquivos gerados (Vite)
   1. Ajustar `vite.config.ts`:
      - Desativar cálculo de gzip no build (reduz tempo/custo no pipeline): `build.reportCompressedSize = false`.
      - Consolidar chunks de vendor via `build.rollupOptions.output.manualChunks` (menos arquivos no dist; upload mais simples).
      - (Opcional) reduzir code splitting agressivo se ainda estiver gerando milhares de chunks.

   2. Validar que a PWA não está contribuindo para travas
      - Manter a PWA, mas revisar se o Workbox está precacheando demais ou gerando manifest gigante.
      - Se necessário como teste: desabilitar PWA no modo de produção temporariamente (apenas para destravar publish), e reativar depois.

B) Inserir “Build ID”/versão visível no app (debug rápido)
   - Adicionar um pequeno texto no rodapé/“About” mostrando:
     - data/hora de build (via `import.meta.env.MODE` + um hash simples ou timestamp)
   - Isso permite confirmar em segundos se o site publicado atualizou ou não, mesmo que a UI do Publish diga “failed”.

C) Corrigir a instabilidade de sessão no Preview (401 get-current-user)
   - O erro 401 vem da função `get-current-user` quando não consegue validar o token.
   - O browser mostrou refresh token inválido; isso costuma ser storage corrompido/antigo.
   - Após estabilizar publish, faremos:
     - Garantir que o app trata refresh token inválido com logout forçado e limpeza de sessão.
     - Evitar loop de chamadas 401 que polui logs e pode causar comportamento estranho.

Critério de sucesso desse bloco: Publish volta a funcionar consistentemente e o “Build ID” prova que o site publicado atualiza.
</plano-de-correcao-no-codigo>

<plano-de-contorno-se-for-problema-da-infra>
Se mesmo após:
- limpeza de storage/service worker + relogin + incognito
- redução de chunks/build cost

…a publicação continuar falhando, isso indica problema fora do repositório.

Nessa situação:
1) Fazer um “Remix” do projeto (cópia) e tentar publicar o remix.
   - Se o remix publica, o problema está preso no projeto atual (estado interno do deploy).
   - Se o remix também não publica, é instabilidade geral na publicação da conta/workspace.

2) Reunir evidências para suporte
   - Timestamp, screenshot do erro, confirmação de que build local no pipeline transforma módulos com sucesso.
   - Informar que falha até ao publicar versões antigas e após limpeza de cache.

Critério de sucesso: publicar via remix (contorno) ou suporte destravar o projeto original.
</plano-de-contorno-se-for-problema-da-infra>

<sequenciamento>
1) Aplicar agora: “Reset” de cache/SW + relogin + incognito e tentar Publish (sem mexer em código).
2) Se falhar: aprovar implementação técnica no `vite.config.ts` para reduzir chunks e custo do build, e inserir “Build ID” visível.
3) Se ainda falhar: remix como contorno + coletar evidências para suporte.
4) Depois de publish resolvido: estabilizar a sessão (tratamento de refresh token inválido e 401 do `get-current-user`).
</sequenciamento>

<riscos-e-tradeoffs>
- Consolidar chunks pode aumentar um pouco o tamanho de alguns bundles, mas tende a deixar deploy mais confiável.
- Desabilitar PWA temporariamente é apenas uma estratégia de isolamento; não é o destino final.
- Se o problema for puramente infraestrutura, nenhuma mudança de código resolverá; por isso o plano inclui contorno (remix) e evidências.
</riscos-e-tradeoffs>

<o-que-eu-preciso-de-voce-agora>
Antes de eu implementar mudanças (quando você aprovar e eu sair do modo read-only), execute apenas o bloco “ação imediata sem código” (limpar storage/SW e incognito) e me diga:
- Depois disso o Publish passou ou falhou do mesmo jeito?
- Se falhou, quanto tempo ficou “carregando” antes de dar erro (aprox.)?
</o-que-eu-preciso-de-voce-agora>
