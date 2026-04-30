## Resposta direta à sua pergunta

**Hoje NÃO dá para escolher os cargos no Kairós.** A lista de títulos está **hardcoded** na edge function `run-apollo-enrichment` (constante `RELEVANT_TITLES`), com os mesmos termos genéricos para TODOS os prospects:

```
ceo, founder, head, director, vp, vice president,
marketing, sales, growth, events, manager,
diretor, diretora, presidente, fundador
```

É por isso que a Juliana Abreu (Gerente Executiva de Trade Marketing) **deveria aparecer** — "marketing" e "manager" estão na lista. Se não apareceu, é porque o Apollo retornou ela em outro endpoint que o nosso fallback não cobre, ou o filtro `person_titles` do Apollo é literal demais (busca exata, não keyword).

Para o caso da **LEGAL** (você quer "gerente de marketing", "analista de eventos", "analista de marketing"), você precisa poder **digitar os cargos por prospect** antes de clicar em Confirmar.

---

## Plano

### 1. UI — Campo de cargos customizados no `ApolloConfirmModal`
Adicionar antes do botão "Confirmar":
- Input de tags (chips) "Cargos para buscar (opcional)"
- Placeholder: `gerente de marketing, analista de eventos, head de trade...`
- Sugestões rápidas (chips clicáveis): "Decisores Marketing", "Decisores Vendas", "Decisores Eventos", "C-Level" — cada um preenche um preset de títulos
- Se o usuário deixar vazio → usa o `RELEVANT_TITLES` padrão (comportamento atual)
- Se preencher → manda os títulos digitados para a edge function

### 2. Service — `apolloService.ts` e `apolloPreview.ts`
- `runApolloEnrichment(prospectId, trigger_source, custom_titles?: string[])`
- Passar `custom_titles` no body da invocação

### 3. Edge function — `run-apollo-enrichment/index.ts`
- Aceitar `custom_titles: string[]` no payload
- Se vier preenchido: usar como `person_titles` na chamada Apollo (Attempt 1) e como keywords no fallback (Attempt 2 — `contacts/search`)
- Se vazio: manter `RELEVANT_TITLES` atual
- Ajustar `isRelevantTitle()` para aceitar a lista dinâmica no pós-filtro (senão o backend descarta os contatos que não batem com a lista hardcoded)
- Log no `enrichment_jobs.request` dos títulos efetivamente usados (auditoria)

### 4. Memória do prospect (opcional, mas recomendado)
- Salvar os últimos `custom_titles` usados no prospect (`prospects.last_search_titles jsonb`) para pré-preencher na próxima vez que o usuário reabrir o modal daquele mesmo prospect.

---

## Detalhes técnicos

**Arquivos editados:**
- `src/components/playbook/enrichment/ApolloConfirmModal.tsx` — novo input de chips + estado `customTitles`
- `src/components/playbook/ProspectContactsTab.tsx` — passar `customTitles` no `onConfirm`
- `src/services/enrichment/apolloService.ts` — assinatura aceitando `custom_titles`
- `supabase/functions/run-apollo-enrichment/index.ts`:
  - parse de `custom_titles` no body
  - `const titlesToUse = custom_titles?.length ? custom_titles : RELEVANT_TITLES;`
  - usar em `person_titles` (linha 282) e no `isRelevantTitle` dinâmico (linha 380)
- (Opcional) migração: `ALTER TABLE prospects ADD COLUMN last_search_titles jsonb;`

**Risco:** baixo. Mantém comportamento padrão quando o campo está vazio (zero regressão). Aumenta drasticamente a precisão da busca quando o SDR sabe o cargo-alvo.

**Próximo passo após aprovação:** implemento, faço deploy da edge function e você testa no prospect TIROLEZ digitando "gerente de trade marketing, gerente executiva, head de marketing".
