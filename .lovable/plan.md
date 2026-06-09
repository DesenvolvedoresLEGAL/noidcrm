## Diagnóstico forense — por que a Luisa apareceu como Mak Frigo, Arauterm, Tecnosul, etc.

### Causa raiz (1) — Domínio errado salvo no prospect
A view `prospects` tem **18 prospects** com `normalized_domain` apontando para sites agregadores/diretórios em vez do site oficial da empresa:

| Domínio poluente | Qtde prospects |
|---|---|
| `jusbrasil.com.br` | 9 (ARAUTERM, Mak Frigo, Tecnosul, Itambé, Softys, Clextral, Canalinox, Ziemann, PGB) |
| `instagram.com` | 4 |
| `facebook.com` | 2 |
| `linkedin.com` | 2 |
| `econodata.com.br` | 1 |

O Apollo é chamado em `run-apollo-enrichment` com `q_organization_domains: jusbrasil.com.br` → ele devolve funcionários da **JusBrasil** (Luisa Voiciechovski, Events Analyst Jr.) como se fossem da Arauterm/Mak Frigo. O mesmo aconteceria com qualquer prospect cujo domínio aponte para um agregador.

### Causa raiz (2) — Blocklist incompleta e não aplicada em todos os writers
`supabase/functions/enrich-prospect-identity/index.ts` tem `BLOCKED_DOMAINS` (linhas 20-25) mas:
- Falta `jusbrasil.com.br`, `econodata.com.br`, `cnpj.biz`, `consultasocio.com`, `empresaqualifica.com.br`, `cnpjs.rocks`, `apontador.com.br`, `econoinfo.com.br`, `solucoes.receita.fazenda.gov.br`, `cnpj.info`, `casadosdados.com.br`, `cnpjbiz.com`.
- A blocklist só é usada em `enrich-prospect-identity`. Há **3 outros writers** em `lead-sourcing/index.ts` (linhas 890, 2839, 3171) que setam `normalized_domain` sem passar pelo filtro — daí `linkedin.com`/`instagram.com` foram persistidos mesmo já estando na lista.

### Causa raiz (3) — Apollo não valida que a pessoa pertence ao prospect
`run-apollo-enrichment` (linhas 412-442) confia cegamente em qualquer pessoa retornada pelo Apollo. Não há sanity check de que `person.organization.primary_domain` (ou `organization.website_url`) bate com `prospect.normalized_domain` — então mesmo com domínio errado, a contaminação passa direto.

### Causa raiz (4) — Sem dedupe global de pessoas
A unique constraint atual é `(prospect_id, email_normalized)`. Como a Luisa veio **sem e-mail** em quase todas as execuções, o constraint não bateu e ela foi inserida 10x em 10 prospects diferentes. Não há nenhum sinal cross-prospect tipo "este `apollo_person_id` ou `linkedin_url` já existe na sua org com outra empresa — provavelmente domínio errado".

### Causa raiz (5) — Telefone do `phone_public` da empresa virando phone da pessoa
`run-apollo-enrichment` linha 418 faz fallback `phone = person.phone_numbers?.[0] ?? person.organization?.phone ?? person.account?.phone`. Isso pega o telefone **da empresa** quando a pessoa não tem telefone próprio, gerando falso positivo (`+5511994543677` é provavelmente telefone da JusBrasil, não da Luisa).

---

## Plano de correção

### 1) Edge function `enrich-prospect-identity`
- Expandir `BLOCKED_DOMAINS` para incluir agregadores BR: `jusbrasil.com.br`, `econodata.com.br`, `cnpj.biz`, `cnpj.info`, `cnpjs.rocks`, `cnpjbiz.com`, `consultasocio.com`, `empresaqualifica.com.br`, `casadosdados.com.br`, `apontador.com.br`, `econoinfo.com.br`, `solucoes.receita.fazenda.gov.br`, `receita.fazenda.gov.br`, `gov.br`, `mercadolivre.com.br`, `olx.com.br`, `tiktok.com`, `pinterest.com`, `medium.com`, `crunchbase.com`, `bloomberg.com`, `dnb.com`, `zoominfo.com`, `apollo.io`, `rocketreach.co`.
- Exportar `isBlockedDomain` / `BLOCKED_DOMAINS` em módulo compartilhado novo: `supabase/functions/_shared/domain-blocklist.ts`.

### 2) Edge function `lead-sourcing`
- Importar o blocklist compartilhado e validar nos 3 pontos (linhas 890, 2839, 3171) antes de gravar `normalized_domain`. Se bloqueado → grava `null` e marca `review_needed = true` com `recommended_next_action = 'verify_domain'`.

### 3) Edge function `run-apollo-enrichment` — proteções defensivas
- **Sanity check de domínio** antes do upsert: para cada pessoa retornada, comparar `person.organization?.primary_domain` (ou website) com `prospect.normalized_domain` (normalizado, removendo `www.`). Se divergir, descartar a linha e logar em `attempts` como `domain_mismatch_filtered`.
- **Bloqueio de domínio poluente na chamada**: se `pickDomain(prospect)` cair em `isBlockedDomain`, retornar `skip("blocked_domain", ...)` em vez de consultar Apollo com lixo.
- **Não usar telefone da empresa como telefone da pessoa**: remover o fallback `organization?.phone / account?.phone` da linha 418 (manter apenas `person.phone_numbers` e `sanitized_phone`).

### 4) Dedupe cross-prospect (defesa em profundidade)
- Index único parcial `enriched_contact_profiles_apollo_person_id_unique`: `(workspace_id, apollo_person_id) WHERE apollo_person_id IS NOT NULL AND is_merged = false`. Evita a mesma pessoa Apollo em 2 prospects da mesma org.
- Index único parcial `enriched_contact_profiles_linkedin_url_unique`: `(workspace_id, lower(linkedin_url)) WHERE linkedin_url IS NOT NULL AND is_merged = false`.
- Em `run-apollo-enrichment`: ao detectar conflito (23505) por `apollo_person_id`/`linkedin_url`, registrar `system_events('apollo_cross_prospect_conflict', { prospect_id, apollo_person_id, existing_prospect_id })` para virar sinal de domínio errado.

### 5) Limpeza de dados (migration)
- Para os 18 prospects com `normalized_domain` em blocklist: `UPDATE prospects SET normalized_domain = NULL, website = NULL, enrichment_status = 'pending', review_needed = true, recommended_next_action = 'verify_domain' WHERE …`.
- Para todos os `enriched_contact_profiles` desses 18 prospects (e especificamente a Luisa nas 10 ocorrências): marcar `is_merged = true` com motivo `wrong_company_domain` para sumir da UI sem perder histórico.
- Marcar `decision_maker_found = false` e zerar `apollo_enriched_at` nesses prospects para permitir reenriquecimento após a equipe corrigir o domínio.

### 6) UI Kairós (opcional, escopo mínimo)
- No card de prospect quando `review_needed = true` e `recommended_next_action = 'verify_domain'`, exibir badge "Domínio suspeito — verificar antes de enriquecer". Bloquear o botão "Enriquecer com Apollo" enquanto o usuário não informar domínio manual. *Pode ficar para um segundo passo se você quiser apenas a correção backend agora.*

### 7) Validação pós-deploy
- Reenriquecer manualmente 1 prospect saneado (ex: ARAUTERM após informar domínio correto) e confirmar que Luisa NÃO aparece mais.
- Rodar `SELECT count(*) FROM enriched_contact_profiles WHERE full_name='Luisa' AND role_title ILIKE '%events analyst%' AND is_merged=false;` → deve retornar 0.
- Conferir log `system_events` por `apollo_cross_prospect_conflict` nos próximos enriquecimentos.

---

## Arquivos impactados
- **Novo**: `supabase/functions/_shared/domain-blocklist.ts`
- **Editado**: `supabase/functions/enrich-prospect-identity/index.ts`
- **Editado**: `supabase/functions/lead-sourcing/index.ts` (3 writers)
- **Editado**: `supabase/functions/run-apollo-enrichment/index.ts` (skip blocked, sanity check, phone fallback)
- **Migration**: 2 índices únicos parciais + UPDATE de saneamento (prospects + enriched_contact_profiles)
- *(Opcional)* `src/components/kairos/...` para badge de domínio suspeito.

## Riscos
- **Baixo**: ampliar blocklist pode bloquear prospect legítimo cuja única referência é redes sociais — mitigado pelo `review_needed=true` que mantém o lead na fila para correção manual.
- **Médio**: índice único parcial em `apollo_person_id` pode falhar se já houver duplicatas. Mitigado pelo passo 5 (marca `is_merged=true` antes de criar o índice).
- **Nulo**: nenhuma quebra de RLS/multi-tenant; tudo dentro de `workspace_id/organization_id`.

## Quer que eu siga com o plano completo (1→7) ou prefere uma versão enxuta só com 1+2+3+5 (correção crítica sem UI nem índices novos)?