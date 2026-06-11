# Sourcing Engine Audit — KAI.12

Auditoria das fontes de sourcing do módulo Kairós em 2026-06-11.
Esta auditoria embasa a desabilitação visual das fontes sem engine operacional.

| Fonte                 | id          | Engine                                                | Edge functions / providers                            | Status      | Ação UI                              |
|-----------------------|-------------|-------------------------------------------------------|--------------------------------------------------------|-------------|--------------------------------------|
| Evento (Expositores)  | `event`     | Sim — Caramelo v5 + ExpoFP provider                   | `lead-sourcing`, ExpoFP iframe + Firecrawl fallback   | **live**    | Habilitada                           |
| Lista Importada       | `import`    | Sim — parsing client-side + enrichment pipeline       | `lead-sourcing` (modo `import`), enrichment jobs      | **live**    | Habilitada                           |
| Diretórios            | `directory` | Não — apenas UI; engine genérica não implementada     | _nenhuma_                                              | **wip**     | Desabilitada com badge "Em desenv."  |
| Busca Geográfica      | `geo`       | Não — sem provider configurado (Google Places off)    | _nenhuma_                                              | **wip**     | Desabilitada com badge "Em desenv."  |
| Seed Expansion        | `seed`      | Não — depende de motor de similaridade ainda inativo  | _nenhuma_                                              | **wip**     | Desabilitada com badge "Em desenv."  |

## Matching com base de clientes (já operacional)

Edge function `kairos-match-company` classifica todo prospect contra:

1. CNPJ
2. Domínio
3. Nome normalizado (pg_trgm)

Resultado persistido em `prospects.relationship_status` e exibido por `RelationshipBadge`:

- 🟢 `customer` — bloqueia importação
- 🟡 `account_existing`
- 🟠 `opportunity_existing`
- ⚪ `new_prospect`

Confirmado em `LeadResultsTable.tsx` (linhas 356, 400-425) e em `useProspectImport.ts` (bloqueio em linhas 76, 124).

---

## KAI.13 — Qualified Queue

Importação direta ao CRM foi removida. O fluxo passa a ser:

```
Sourcing → kairos-enqueue-prospect → Qualified Queue → kairos-promote-to-crm → CRM
```

Botão "Importar" agora chama `kairos-enqueue-prospect`. A promoção ao CRM
acontece exclusivamente em **Kairós > Qualified Queue** quando o item está
`ready_for_sdr` (enriquecido + decisor + contato + score ≥ 60).
