
Objetivo: corrigir de forma definitiva o fluxo de captura de leads em páginas SPA do playbook de evento, priorizando confiabilidade de backend e observabilidade para parar de “adivinhar” onde quebra.

1. Confirmar a causa real no runtime
- Inspecionar logs da função de backend e os dados da execução recente com 0 leads.
- Verificar 3 pontos exatos:
  1) se a run terminou mesmo com erro parcial escondido,
  2) se a extração AI retornou 0 expositores,
  3) se houve falha de persistência no banco.
- Suspeita forte já encontrada no código: `source_pages` está sendo inserido sem `playbook_run_id`, embora essa coluna seja `NOT NULL`. Se isso estiver estourando em produção, a execução pode ficar inconsistente logo na fase de descoberta/classificação.

2. Corrigir o backend para SPA grande com estratégia resiliente
- Ajustar `supabase/functions/lead-sourcing/index.ts` para não depender só de “map + prompt”.
- Implementar pipeline em camadas:
  - camada A: map/discovery normal;
  - camada B: scrape profundo de SPA com scroll progressivo;
  - camada C: extração determinística de links/perfis direto do HTML;
  - camada D: fallback por fatias/variantes quando a SPA não expõe URLs suficientes;
  - camada E: extração AI apenas como enriquecimento, não como ponto único de falha.
- Corrigir a persistência de `source_pages` incluindo `playbook_run_id`.
- Garantir que qualquer erro de etapa registre evento e não finalize “completed” silenciosamente com 0 leads sem diagnóstico claro.

3. Trocar extração frágil por extração híbrida
- Hoje o código depende demais de markdown + AI para listar expositores.
- Vou reforçar com parsing híbrido:
  - extrair candidatos do HTML bruto/processado,
  - capturar anchors/cards repetidos,
  - identificar padrões de empresa/estande/site,
  - usar AI só para estruturar e complementar quando necessário.
- Se a AI retornar 0 mas o HTML tiver muitos cards/nomes repetitivos, usar fallback determinístico para não perder tudo.

4. Melhorar a estratégia específica para SPA lazy-loaded
- Substituir o scroll fixo por lógica incremental com checkpoints:
  - scrape inicial,
  - re-scrape com mais scroll,
  - comparar crescimento de conteúdo,
  - parar só quando estabilizar.
- Se detectar filtro A-Z, abas ou paginação interna, executar scrapes segmentados e unir resultados.
- Se a página for “single-route SPA”, trabalhar com múltiplas ações sobre a mesma URL em vez de esperar sub-URLs do mapa.

5. Blindar dedupe e threshold para não zerar run boa
- Auditar se o score mínimo ou o dedupe está descartando tudo depois da extração.
- Adicionar métricas separadas para:
  - candidatos brutos detectados no HTML,
  - expositores extraídos por AI,
  - candidatos válidos após normalização,
  - removidos por dedupe,
  - removidos por threshold,
  - persistidos no banco.
- Se houver extração válida mas score excessivamente agressivo, ajustar a lógica para evento/diretório.

6. Melhorar observabilidade da execução
- Expandir `run_events` com mensagens de etapa realmente úteis:
  - conteúdo capturado por scrape,
  - crescimento entre passes,
  - quantos links vieram do HTML,
  - quantos candidatos vieram do parser determinístico,
  - quantos vieram da AI,
  - por que ficaram 0 no final.
- Atualizar as métricas mostradas no detalhe da run para ficar óbvio onde a perda aconteceu.

7. Ajustar o frontend para refletir o backend real
- Manter `RecentRunsList` e histórico, mas melhorar a leitura de runs com 0 leads:
  - mostrar erro/aviso quando houve scrape sem persistência,
  - destacar runs “completed com 0” como caso suspeito quando houver páginas/chunks processados.
- Revisar o stepper de progresso para usar eventos reais da execução, e não só tempo decorrido.

8. Validação após correção
- Reexecutar o caso da SPA problemática.
- Validar:
  - run criada corretamente,
  - eventos registrados por etapa,
  - páginas/listas/perfis capturados,
  - leads persistidos acima de zero,
  - contagem aparecendo corretamente nos cards e tabela.
- Comparar com a execução anterior de 248 e garantir que a nova versão não regrida para 0.

Arquivos principais
- `supabase/functions/lead-sourcing/index.ts`
- `src/components/playbook/RunDetailDrawer.tsx`
- `src/components/playbook/EventProgressStepper.tsx`
- possivelmente `src/components/playbook/RecentRunsList.tsx`
- possivelmente `src/hooks/useLeadSourcingV2.ts`

Detalhes técnicos
```text
Problemas já identificados na leitura do código:
1. source_pages recebe:
   { organization_id, lead_source_id, url, page_type, status }
   mas a tabela exige playbook_run_id NOT NULL.

2. O fluxo de evento depende muito de:
   scrape(markdown/html) -> AI extraction -> insert prospects
   Se a AI falhar em interpretar a SPA atual, a run pode terminar com 0.

3. A UI hoje mostra "completed" com 0 leads sem explicar
   se o zero veio de scrape ruim, extração ruim, dedupe ou threshold.
```

Resultado esperado
- parar de depender de tentativa e erro manual;
- capturar leads em SPA de forma robusta;
- nunca mais ter run “0 leads” sem diagnóstico explícito;
- backend confiável o suficiente para iterar em cima de evidência, não de chute.
