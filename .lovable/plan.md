## Sprint: Apollo Eligibility — aceitar `usable` com revisão

### Objetivo
Liberar enriquecimento Apollo para leads `quality_label = usable` (mantendo `priority_score >= 180`, domínio obrigatório, sem decisor já encontrado, dedupe e anti-spam 24h), sinalizando claramente que esses leads exigem **revisão humana** e bloqueando auto-send nesta etapa.

---

### Regra única de elegibilidade (compartilhada preview ↔ run)

```text
ALLOWED_QUALITY = ["high_confidence", "usable"]

eligible = true SE
  quality_label ∈ ALLOWED_QUALITY
  AND priority_score >= 180
  AND domain != null
  AND decision_maker_found != true
  AND não existe job apollo (running OU done) nas últimas 24h

review_required = (quality_label === "usable")
auto_send_allowed = (quality_label === "high_confidence")  // usable nunca auto-send
```

Bloqueios continuam valendo:
- `low_confidence`, `insufficient`, `null` → não elegível
- score < 180 → não elegível
- sem domínio → não elegível
- decisor já encontrado → não elegível
- job `running` ou `done` < 24h → não elegível (skip `already_enriched` no run)

---

### Mudanças por arquivo

**1. `supabase/functions/preview-apollo-enrichment/index.ts`**
- Trocar `if (qLabel !== "high_confidence")` por checagem em set `["high_confidence", "usable"]`.
- Quando `qLabel === "usable"` e demais critérios passam:
  - `eligible = true`
  - `review_required = true`
  - `warning = "Lead com qualidade utilizável. Enriquecimento permitido, mas recomenda revisão humana antes de automação."`
  - `auto_send_allowed = false`
- Quando `qLabel === "high_confidence"`: `review_required = false`, `auto_send_allowed = true`.
- Adicionar `review_required`, `auto_send_allowed` ao JSON de resposta.

**2. `supabase/functions/run-apollo-enrichment/index.ts`**
- Substituir `if (qLabel !== "high_confidence") return await skip("low_quality", ...)` por:
  ```ts
  if (!["high_confidence", "usable"].includes(qLabel)) return await skip("low_quality", `quality_label=${qLabel}`);
  ```
- Demais guardas (score, decision_maker, anti-spam, rate-limit, domain) ficam idênticas — garante paridade total com preview.
- Persistir `review_required` no `request` do `enrichment_jobs` para auditoria:
  ```ts
  request: { domain, person_titles: RELEVANT_TITLES, review_required: qLabel === "usable", trigger_source }
  ```
- No `trackEvent("apollo_enrichment_started")` incluir `review_required`.
- Bloquear `trigger_source === "automation"` quando `qLabel === "usable"`:
  ```ts
  if (qLabel === "usable" && trigger_source === "automation")
    return await skip("review_required", "usable quality requires manual trigger");
  ```

**3. `src/services/enrichment/apolloPreview.ts`**
- Adicionar campos opcionais à interface `ApolloPreview`:
  ```ts
  review_required?: boolean;
  auto_send_allowed?: boolean;
  ```

**4. `src/components/playbook/enrichment/ApolloConfirmModal.tsx`**
- Status badge condicional:
  - `eligible && review_required` → badge âmbar "Elegível com revisão" (ícone `AlertTriangle`)
  - `eligible && !review_required` → badge verde "Elegível" (atual)
  - `!eligible` → badge vermelho "Não elegível" (atual)
- Botão "Confirmar enriquecimento" continua habilitado para `eligible` (inclui usable).
- Para `review_required`: alterar label do botão para "Confirmar (revisão humana)" e manter o `warning` âmbar já renderizado pelo backend.
- Não alterar lógica de `disabled` — `usable` agora tem `eligible=true` então será permitido manualmente.

---

### Critério de aceite (validação manual pós-deploy)
1. Lead `high_confidence` + score ≥ 180 + domínio → badge "Elegível", botão habilitado, sem warning de revisão.
2. Lead `usable` + score ≥ 180 + domínio → badge "Elegível com revisão", warning âmbar exibido, botão habilitado.
3. Lead `low_confidence` ou `insufficient` → badge "Não elegível", botão desabilitado.
4. Lead sem domínio → "Não elegível".
5. Lead com `decision_maker_found = true` → "Não elegível".
6. Lead com job apollo recente (24h) → "Não elegível" / `skip already_enriched` no run.
7. Run com `trigger_source = "automation"` em lead `usable` → skip `review_required` (não consome créditos Apollo).
8. Preview e run produzem o mesmo veredicto para os mesmos inputs.

---

### Riscos
- Aumento de consumo de créditos Apollo proporcional ao volume de leads `usable` ≥ 180 — mitigado por anti-spam 24h e rate-limit 20/min existentes.
- Contatos vindos de leads `usable` podem ter qualidade inferior — mitigado pelo bloqueio de auto-send e flag `review_required` persistida em `enrichment_jobs.request` para análise futura.
- Nenhuma migration de banco necessária.

### Arquivos alterados
- `supabase/functions/preview-apollo-enrichment/index.ts`
- `supabase/functions/run-apollo-enrichment/index.ts`
- `src/services/enrichment/apolloPreview.ts`
- `src/components/playbook/enrichment/ApolloConfirmModal.tsx`
