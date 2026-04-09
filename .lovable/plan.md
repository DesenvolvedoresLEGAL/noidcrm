
Objetivo: fazer o Lead Sourcing Engine capturar a lista completa de expositores da Agrishow e aplicar o score mínimo de forma real, previsível e auditável.

Diagnóstico confirmado no código:
1. O “score mínimo” hoje não filtra os leads retornados no sourcing.
- Em `supabase/functions/lead-sourcing/index.ts`, `scoreThreshold` é lido, mas no fluxo de evento não é usado para decidir quais prospects criar.
- Hoje ele impacta basicamente o `autoImportEligibleProspects`, não a quantidade de leads exibidos.

2. O scraping de evento está incompleto para diretórios grandes.
- O handler de evento raspa no máximo `50` páginas relevantes e só `5` páginas não-lista (`otherPages.slice(0, 5)`).
- Em diretórios massivos, isso limita demais a cobertura.
- A captura atual da Agrishow mostra só o trecho inicial da lista (A até AZUL PACK), então a extração está parcial.

3. A estratégia atual depende demais de uma extração única por IA sobre páginas grandes.
- O conteúdo da lista é truncado em `120000` caracteres antes de ir para a IA.
- Em uma feira com 800+ expositores, isso corta boa parte da lista.
- Resultado: mesmo com score 0, entram só os expositores que chegaram a ser capturados/extratos.

4. Falta observabilidade operacional.
- Hoje a tela mostra o total encontrado, mas não separa claramente:
  - links de perfis descobertos
  - páginas raspadas com sucesso
  - expositores extraídos
  - removidos por dedupe
  - removidos por score
  - falhas de scrape/extração

Ajustes que precisam ser feitos:
1. Fazer o score mínimo valer de verdade
- Aplicar `scoreThreshold` antes de persistir/exibir prospects em todos os playbooks.
- Registrar também os descartados por score em métricas da run.
- Resultado esperado: se score = 0, nada é excluído por score; se score > 0, a redução fica explicável.

2. Trocar a estratégia de evento “lista gigante -> IA única” por “descoberta de perfis -> scrape distribuído”
- A partir da página da feira, extrair programaticamente todos os links `/exhibitor/...`.
- Priorizar scraping dos perfis individuais dos expositores, em vez de depender só da listagem agregada.
- A listagem vira fonte de descoberta; os perfis viram fonte principal de dados.

3. Adicionar fallback específico para diretórios alfabéticos/virtualizados
- Detectar páginas em ordem alfabética como a Agrishow.
- Quando a lista raspada vier parcial, acionar fallback:
  - parse de links no HTML bruto
  - expansão por padrões alfabéticos/perfis
  - scraping em lotes dos perfis descobertos
- Isso resolve o caso “a lista existe, mas o markdown só trouxe o começo”.

4. Remover limites que hoje estrangulam cobertura
- Revisar o cap de `50` páginas e o limite de `5` perfis extras.
- Tornar esses limites configuráveis por run.
- Priorizar cobertura por número de perfis encontrados, não por número fixo de páginas.

5. Quebrar extrações grandes em chunks
- Se ainda houver páginas-lista úteis, dividir o conteúdo em blocos menores e rodar extração por chunk.
- Deduplicar por `normalized_company_name` e por `exhibitor_profile_url`.
- Isso evita perder expositores que ficam depois do corte de contexto.

6. Melhorar deduplicação sem matar cobertura
- Manter dedupe contra contas existentes.
- Adicionar dedupe intrarun por nome normalizado + URL do perfil + domínio.
- Isso evita duplicados sem derrubar empresas válidas.

7. Melhorar logs e métricas da execução
- Gravar na run:
  - `profile_links_discovered`
  - `list_pages_scraped`
  - `profile_pages_scraped`
  - `ai_chunks_processed`
  - `exhibitors_extracted_raw`
  - `deduped_in_run`
  - `discarded_below_score`
  - `persisted_prospects`
  - `scrape_failures`
- Exibir isso no drawer de detalhe da execução.

8. Ajustar a UI para não mascarar problema
- Deixar claro na tela a diferença entre:
  - expositores descobertos
  - prospects criados
  - prospects acima do score mínimo
- Hoje “28 de 28 leads” passa a sensação de completude, mas é só o total persistido.

Arquivos centrais a revisar:
- `supabase/functions/lead-sourcing/index.ts`
- `src/components/playbook/RunDetailDrawer.tsx`
- `src/components/playbook/LeadSearchForm.tsx`
- `src/hooks/useLeadSourcingV2.ts`

Critério de aceite:
1. Na Agrishow, a run deve descobrir centenas de perfis/empresas, não só dezenas.
2. Com score mínimo `0`, o total persistido deve refletir a cobertura real capturada, sem corte artificial por score.
3. Com score maior, a redução precisa aparecer claramente nas métricas.
4. O detalhe da execução deve mostrar onde houve perda: descoberta, scrape, extração, dedupe ou score.

Resultado esperado:
- O motor deixa de ser “cego” em eventos grandes.
- A Agrishow passa a ter cobertura compatível com o diretório real.
- O score mínimo passa a funcionar corretamente.
- Você consegue enxergar exatamente onde o pipeline falhou quando não trouxer tudo.
