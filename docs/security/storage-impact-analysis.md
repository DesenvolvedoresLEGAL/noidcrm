# Storage Migration — Análise de Impacto

Data: 2026-07-11
Escopo: privatização de `proposal-layouts` + hardening de `opportunity-files` e `proposal-pdfs`.
Não altera `avatars`, `organization-logos`, `product-images` (permanecem PUBLIC_APPROVED).

## 1. Bucket `proposal-layouts` (público → privado)

### Telas / componentes / hooks afetados

- `src/pages/settings/ProposalLayouts.tsx` — CRUD de layouts.
- `src/pages/settings/ProposalTemplateEditor.tsx` — seleção de layout.
- `src/components/proposals/ProposalEditorModal.tsx` — preview durante edição.
- `src/components/proposals/ProposalTemplatesManager.tsx` — listagem.
- `src/components/templates/TemplateConfigSidebar.tsx` — atribuição.
- `src/pages/ProposalEditor.tsx` — renderização inline.

### Serviços afetados

- `src/services/supabase/proposal-layouts.ts` — chama `getPublicUrl` (linha 219–221) e persiste URL pública no banco.
- `src/services/crm/proposal-layouts.ts` — consumidor secundário.

### Edge Functions afetadas

- `generate-proposal-pdf/index.ts` — não consome `proposal-layouts` diretamente hoje (usa `layoutPages` do banco). Sem impacto.

### Colunas de banco com URL pública persistida

- `proposal_layouts.terms_pdf_url` — atualmente public URL. Após privatização, quebra em qualquer consumidor que abra a URL sem passar pela nova camada de signed URL.
- `proposal_layout_pages.file_url` — mesmo tratamento.

### Riscos

- **Alto**: PDFs de termos de propostas antigas param de abrir para usuários finais que tinham a URL salva.
- **Médio**: PDF anexado a propostas já enviadas via email deixa de resolver se o email carrega a URL pública.
- **Médio**: Preview em `ProposalEditor` quebra até a camada de signed URL ser conectada.

### Estratégia de compatibilidade

1. Adicionar coluna `proposal_layouts.storage_path` (nullable) e backfill a partir de `terms_pdf_url` (extrair path após `/object/public/proposal-layouts/`).
2. Mesma coisa para `proposal_layout_pages.storage_path`.
3. Reescrever leitura para usar `signedUrlService.getSignedUrl('proposal-layouts', storage_path)`.
4. Só privatizar o bucket após deploy do consumidor novo.
5. Manter `terms_pdf_url` populado com signed URL curta (1h) para telas que ainda dependem do campo, gerada no momento da leitura — nunca persistida.

## 2. Bucket `opportunity-files` (já privado — hardening)

### Riscos

- **Baixo**: bucket já é privado; upload/download passa por API com JWT.
- **Médio**: policy INSERT atual valida path por prefixo `organization_members`, mas não impede caminhos como `<orgA>/../<orgB>/file.pdf` normalizados pelo storage. Reforçar exigindo `storage.foldername(name)[1]::uuid = get_user_organization_id()`.
- **Médio**: filenames preservam nome original do arquivo (contratos com nome de cliente). Adicionar recomendação de renomear no upload para `<uuid>.<ext>` mantendo o nome original apenas em `opportunity_files.file_name` (campo de banco protegido por RLS).

### Consumidores

- `services/supabase/opportunity-files.ts` (linha 47–58): já usa `<orgId>/<opportunityId>/<uuid>-<random>.<ext>` — bom. Mudança sugerida: usar `crypto.randomUUID()` puro (sem `Date.now()` que vaza timestamp).

## 3. Bucket `proposal-pdfs` (já privado — corrigir P-01)

### Problema

`generate-proposal-pdf` gera signed URL de 7 dias e persiste em `proposals.pdf_url`. Snapshot/log/BI export vaza a URL, válida até expirar.

### Correção proposta

1. Parar de persistir a signed URL. Guardar apenas `proposals.pdf_storage_path` (nullable text).
2. Nova RPC `get_proposal_pdf_signed_url(proposal_id uuid)` (SECURITY DEFINER, `search_path = public`) que valida acesso via `organization_members` e chama camada de signed URL.
3. Migrar leituras do frontend para chamar a RPC sob demanda (TTL curto, 5 minutos).
4. Migration de deprecação: `proposals.pdf_url` → mantida temporariamente NULL, removida em release seguinte.

### Consumidores de `proposals.pdf_url`

Buscar com `rg "pdf_url" src/ supabase/functions/` antes de aplicar. Substituir por `getProposalPdfSignedUrl(proposal.id)`.

### Riscos

- **Alto**: qualquer relatório ou export que serializa `proposals.*` inclui `pdf_url`. Auditar `v_report_*` e exports antes de remover.
- **Médio**: usuário anônimo em link público de proposta (`/p/<token>`) precisa de rota separada; a RPC pública `get_proposal_by_public_token` já retorna dados; adicionar campo signed URL gerado no lado servidor por essa RPC.

## 4. Camada centralizada de signed URLs

Nova função utilitária:

```ts
// src/services/supabase/signed-url.ts
export async function getSignedUrl(
  bucket: 'proposal-pdfs' | 'proposal-layouts' | 'opportunity-files',
  path: string,
  ttlSeconds = 300,
): Promise<string>
```

- Faz cache in-memory por até `ttl - 30s`.
- Nunca aceita bucket público via essa função (assertion).
- Nunca é chamada com service role no frontend.
- Erro de acesso retorna `null` (não vaza motivo).

Server-side, edge functions usam `SUPABASE_SERVICE_ROLE_KEY` apenas via wrapper `_shared/signed-url.ts` com log de auditoria em `system_events`.

## 5. Backfill

- `proposal_layouts.storage_path`: `regexp_replace(terms_pdf_url, '^.*/object/public/proposal-layouts/', '')` onde `terms_pdf_url IS NOT NULL`.
- `proposal_layout_pages.storage_path`: mesma coisa.
- `proposals.pdf_storage_path`: extrair de `pdf_url` a parte `<orgId>/<proposalId>.html`. Fallback: reconstruir como `<organization_id>/<id>.html`.

Backfills em migração separada, idempotente, com log em `system_events`.

## 6. Decisões que exigem aprovação humana

1. **Manter product-images público**? Cliente pode considerar catálogo confidencial. Default: manter público. Requer aceite do usuário.
2. **Manter accounts.logo_url público**? Logos de terceiros em página pública podem ter implicação de imagem/consentimento. Default: manter público, adicionar disclaimer no upload.
3. **TTL de signed URL para `proposal-pdfs` público** (link `/p/<token>`): 5 min ou 30 min? Recomendação: 15 min com renovação transparente.
4. **Renomear filenames existentes em `opportunity-files`** para remover nomes de clientes? Recomendação: **não retroagir** (preserva rastreabilidade); aplicar apenas a novos uploads.
5. **Remover `proposals.pdf_url`** ou manter como coluna deprecated? Recomendação: manter deprecated por 1 release, remover na sprint seguinte.
6. **Auditoria de acesso**: registrar toda geração de signed URL em `system_events`? Recomendação: sim, com throttling.
