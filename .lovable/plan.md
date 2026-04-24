
## Diagnóstico do erro de import (Educbank)

Olhei o `useProspectImport.ts` e a prospect Educbank no banco:

- A prospect **EDUCBANK** tem `website=null`, `email_public=null`, `phone_public=null`, `normalized_domain=null` — só sobrou o nome da empresa. Não tem como criar conta útil nem oportunidade qualificada com isso.
- O hook `useProspectImport` cria a `opportunity` **sem `pipeline_id` nem `stage_id`** (campos `pipeline_id text` e `stage_id text` ficam NULL). Isso quebra a oportunidade no pipeline (e provavelmente um trigger/RLS está rejeitando, daí o erro 400 que aparece no console: `opportunities?select=id`).
- A organização tem o pipeline `PRÉ VENDAS` (`d1b68a0f-...-sales-1`, tipo `qualification`) com primeiro estágio `Lead Captado` (`...-stage-0`) — é exatamente onde o lead deve cair.

Ou seja, **dois problemas combinados**: (1) faltam dados de enriquecimento; (2) o import não posiciona a opp no funil.

## Estratégia em 2 camadas (mantendo o que já existe)

Já existe a edge function `run-enrichment` (Firecrawl + IA) e o hook `useEnrichment`. Só não está obrigatório no fluxo de import. Vou fazer enriquecimento **bloqueante** antes do import, em duas etapas:

### Etapa A — Enriquecimento de identidade (rápido, determinístico)
Cria nova edge `enrich-prospect-identity` que faz:

1. **Descoberta de domínio/site via Google CSE** (se ainda não houver `website`):
   - Query: `"<company_name>" site oficial` + `"<company_name>" CNPJ`
   - Usa Google Custom Search API (precisa de `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` — vou pedir via `add_secret`).
   - Heurística para escolher o domínio "oficial" (descarta linkedin/facebook/glassdoor; prioriza `.com.br`/`.com` cujo título contém o nome).
2. **Descoberta de CNPJ** via:
   - Regex no snippet do Google (padrão `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`).
   - Se não achar: scrape leve (`fetch` direto) da home + `/contato`/`/sobre` procurando o regex.
3. **Lookup CNPJ** via função `lookup-cnpj` já existente (BrasilAPI/OpenCNPJ com cache 30d) → razão social, nome fantasia, endereço, CNAE, telefone, e-mail, porte.
4. **Email/telefone públicos**: regex em `mailto:` / `tel:` na home + `/contato`.
5. Persiste tudo de volta em `prospects` (`website`, `normalized_domain`, `email_public`, `phone_public`, novos campos `cnpj`, `razao_social`, `nome_fantasia`, `cnae`, `porte`, `address_*`).

> Migração: adicionar colunas `cnpj`, `razao_social`, `nome_fantasia`, `cnae_code`, `cnae_desc`, `porte`, `endereco`, `cidade_enriched`, `uf_enriched`, `cep` em `prospects` (todas opcionais).

### Etapa B — Enriquecimento de inteligência (já existe)
Reutilizo a `run-enrichment` atual (Firecrawl + IA gera `enriched_company_profiles`, `commercial_briefs`, `enrichment_signals`) — ela precisa de website, que a Etapa A garante.

### Recalcular Lead Score
Após A+B, chamo a função existente `calculate-account-scores` (ou criar uma `score-prospect`) usando os sinais reais: porte, CNAE alinhado ao ICP, presença de site, MRR estimado, sinais comerciais. Atualiza `prospects.priority_score` e `grade`.

## Correção do import (`useProspectImport.ts`)

1. Antes de qualquer insert, **bloquear se faltar website E cnpj** (forçar enriquecimento primeiro). UI mostra botão **"Enriquecer agora"** antes de "Importar".
2. Ao importar, fazer chamada RPC nova `import_prospect_to_pipeline(prospect_id, target_pipeline_type)`:
   - Resolve `pipeline_id` = primário com `pipeline_type='qualification'` (ou aceita override).
   - Resolve `stage_id` = stage com menor `order_index` desse pipeline.
   - Cria conta usando `cnpj`/`razao_social`/`nome_fantasia` enriquecidos (com dedup por CNPJ além do domínio).
   - Cria contact com `email_public`/`phone_public`.
   - Cria opportunity com `pipeline_id`, `stage_id`, `status='new'`, `temperatura='warm'`, `priority_score`.
   - Faz tudo dentro de uma transação (security definer) para evitar conta órfã se opp falhar.
3. Toast com link direto para a oportunidade criada.

## UX no Drawer do Prospect

- Banner "⚠️ Faltam dados essenciais" enquanto não houver `cnpj` + `website`.
- Botão **"Enriquecer & Importar"** (one-click): roda Etapa A → Etapa B → Score → Import sequencialmente, com progresso visível (4 passos).
- Botão "Importar" só fica habilitado depois de A concluído.
- Mostra preview antes de importar: razão social, CNPJ formatado, site, e-mail, telefone, CNAE, porte, score.

## Próxima fase (Apollo/Lusha) — não nesta entrega
Estrutura preparada: campo `prospects.decision_makers jsonb` + tabela `prospect_contacts`. A integração com Apollo/Lusha vai consumir `cnpj`/`normalized_domain` enriquecidos para buscar gerentes de marketing por cargo/seniority.

## Arquivos impactados

**Novos:**
- `supabase/functions/enrich-prospect-identity/index.ts` (Etapa A)
- `supabase/migrations/<ts>_prospects_enrichment_columns.sql` (colunas CNPJ + RPC `import_prospect_to_pipeline`)
- `src/hooks/useEnrichProspectIdentity.ts`

**Editados:**
- `src/hooks/useProspectImport.ts` (usar RPC, validar dados mínimos, resolver pipeline/stage)
- `src/components/playbook/ProspectDetailDrawer.tsx` (banner + botão "Enriquecer & Importar" + preview)
- `supabase/functions/run-enrichment/index.ts` (deixar idempotente para rodar após Etapa A)

## Secrets necessários
- `GOOGLE_CSE_KEY` e `GOOGLE_CSE_CX` (Google Programmable Search) — vou pedir via `add_secret` quando começar a implementar. Sem isso, caio em fallback: scrape direto via DuckDuckGo HTML (menos confiável, mas funciona).
- `FIRECRAWL_API_KEY` já existe.
- `OPENAI_API_KEY` já existe.

## Riscos
- Google CSE tem cota grátis baixa (100/dia). Para 447 leads = precisa plano pago ou processar em lotes ao longo de dias.
- Nem toda empresa B2B tem CNPJ no site → fallback: busca pelo nome em BrasilAPI (não suportado) → marcar prospect como "CNPJ não encontrado" e seguir só com domínio.
- Custo: ~1 chamada Firecrawl + 1 OpenAI + 1 CNPJ + 2 Google CSE por prospect ≈ R$ 0,15–0,30/lead.

## Resposta direta às suas dúvidas

> "Onde buscar?" → Google CSE (oficial, pago após 100/dia) ou DuckDuckGo HTML (grátis, frágil). Recomendo CSE.

> "Como funciona o enriquecimento?" → Pipeline determinístico: Google → CNPJ regex → BrasilAPI/OpenCNPJ → scrape contato → Firecrawl + IA → score. Tudo cacheado.

> "Próxima fase Apollo/Lusha?" → Vai consumir `cnpj` + `normalized_domain` desta etapa para buscar pessoas. Nada bloqueia.

Aprova o plano? Quando aprovar, preciso que você decida: **(1) usamos Google CSE (você fornece as keys) ou (2) fallback DuckDuckGo grátis para validar primeiro?**
