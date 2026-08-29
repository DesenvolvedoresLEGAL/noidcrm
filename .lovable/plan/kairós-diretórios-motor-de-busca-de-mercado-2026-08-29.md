# Kairós · Diretórios — Motor de Busca de Mercado

Transformar a aba "Diretórios" (hoje marcada como *Em desenvolvimento*) em um motor de prospecção por mercado: você descreve o alvo em linguagem natural ("agências de eventos em São Paulo") e o Kairós devolve uma lista de empresas reais com telefone, site, e-mail, endereço, porte/CNPJ e decisor Apollo — no mesmo nível de assertividade da busca por expositores.

## Como vai funcionar (visão do usuário)

1. Você escolhe **Diretórios**, seleciona o ICP e escreve o alvo: segmento, cidade/UF e, opcionalmente, filtros (porte, palavras-chave, excluir clientes atuais).
2. O Kairós roda a busca em background (até 50 empresas por execução) e mostra o progresso.
3. O resultado cai na mesma tabela de prospects já existente, com score, grade, badge de duplicado/cliente atual e ações de aprovar/importar em massa.
4. Cada empresa traz: nome, site, telefone, e-mail público, endereço/cidade, CNPJ + porte + CNAE, e (opcional por execução) decisor com cargo via Apollo.

## Pipeline em 6 etapas (server-side)

```text
1. Interpretação   IA transforma o pedido em plano de busca
                   (segmento, sinônimos, cidade/bairros, termos negativos)
2. Fan-out         Google Places  -> empresas locais (nome, tel, site, endereço)
                   Firecrawl Search -> listas, diretórios, portais setoriais
                   Perplexity Sonar -> respostas com citações (fontes extras)
3. Consolidação    Dedup por domínio + nome normalizado + telefone;
                   cruzamento com contas/prospects existentes da organização
4. Enriquecimento  Scrape do site oficial (contato/sobre) -> e-mail, telefone,
                   redes; lookup-cnpj -> CNPJ, razão social, porte, CNAE
5. Scoring         Reuso do scoring atual (ICP fit, sinais, qualidade, fonte)
                   + bônus por match de segmento/cidade/porte
6. Persistência    prospects + prospect_scores + lead_sources + source_pages
                   + run_events; auto-import conforme regras de aprovação
```

Apollo entra como passo opcional pós-persistência, disparado pelas funções de enriquecimento já existentes (`kairos-apollo-*`), respeitando os guardrails atuais (anti-spam 24h, rate limit, confirmação).

## Precisão: o que garante assertividade

- **Plano de consultas múltiplas**: cada busca gera de 6 a 10 consultas variadas (sinônimos do segmento, bairros/regiões, "empresas de X em Y", diretórios setoriais) em vez de uma consulta única.
- **Três fontes independentes** com voto de confiança: empresa citada por 2+ fontes ganha score maior; empresa vinda só de resposta de IA sem site/telefone entra como `review_needed`.
- **Filtro anti-lixo**: descarta agregadores, portais de notícia, marketplaces e perfis de rede social; exige domínio próprio ou telefone válido.
- **Sem invenção de dados**: campo só é preenchido se veio de fonte rastreável; cada prospect guarda as URLs de origem em `source_pages`.

## Escopo técnico

**Backend**
- `supabase/functions/lead-sourcing/index.ts`: reescrever `handleDirectorySearch` como `handleMarketSearch` (mantendo o tipo `directory`), com execução em background (`EdgeRuntime.waitUntil`) e eventos de progresso.
- Novos módulos em `supabase/functions/lead-sourcing/providers/`:
  - `google-places.ts` — Places Text Search + Place Details paginado.
  - `perplexity-search.ts` — Sonar com `search_domain_filter` e citações.
  - `market-plan.ts` — geração do plano de consultas via IA.
  - `contact-scraper.ts` — extração de e-mail/telefone/redes do site oficial.
- Reuso de `firecrawlSearch`, `saveProspectsFromExtraction`, `dedupeProspect`, `autoImportEligibleProspects` e `lookup-cnpj` — nada de lógica duplicada.

**Frontend**
- `src/components/playbook/LeadSearchForm.tsx`: remover o status `wip` de Diretórios e trocar os dois campos atuais por um formulário de mercado (alvo em texto, segmento, cidade/UF, porte, limite, toggle Apollo).
- `src/components/playbook/LeadResultsTable.tsx` e `ProspectDetailDrawer.tsx`: exibir telefone, e-mail, porte/CNAE e as fontes que citaram a empresa.
- Stepper de progresso reaproveitado do fluxo de eventos.

**Credenciais**
- Google Places API key e Perplexity: precisam ser configurados antes do primeiro uso. Firecrawl e Apollo já estão ativos. Se uma fonte não estiver configurada, o motor roda com as demais e registra o aviso no log da execução.

## Riscos

- Custo por execução sobe (3 fontes + scrape + CNPJ): mitigado pelo teto de 50 empresas e cache de CNPJ de 30 dias.
- Google Places cobra por detalhe consultado: só buscamos detalhes das empresas que passam no filtro anti-lixo.
- Perplexity pode citar empresas sem site: entram como `review_needed`, nunca como auto-import.

## Entrega em duas etapas

1. **Etapa 1** — pipeline Firecrawl + Places + enriquecimento (contato, CNPJ/porte), UI nova e persistência. Já entrega valor completo de pré-vendas.
2. **Etapa 2** — camada Perplexity, voto de confiança multi-fonte e disparo Apollo direto da tela de resultados.
