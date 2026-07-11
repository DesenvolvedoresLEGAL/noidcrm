# Storage Inventory — Fase 2 (pré-migração)

Data: 2026-07-11
Fonte: consulta direta a `storage.buckets`, `storage.objects`, `pg_policies` e `rg` sobre `src/` + `supabase/`.
Sem conteúdo de arquivos, sem PII de usuário. Apenas metadados sanitizados.

## 1. Buckets existentes

| Bucket             | public | Objetos | Tamanho | Extensões (contagem)                 | Depth path | Padrão de path observado                                                                 |
| ------------------ | :----: | ------: | ------: | ------------------------------------ | :--------: | ---------------------------------------------------------------------------------------- |
| avatars            |  true  |       8 |  5.3 MB | png(8)                               |     2      | `avatars/<uuid>-<slug>.png`                                                              |
| opportunity-files  |  false |      80 |    99 MB | pdf(57), png(18), docx(2), *(sufixo `_contrato`)(3) |     3      | `<organization_id>/<opportunity_id>/<filename>`                                          |
| organization-logos |  true  |       4 |  2.0 MB | png(2), jpg(1), jpeg(1)              |     2      | `<organization_id>/<filename>`                                                           |
| product-images     |  true  |      28 |    36 MB | png(26), jpg(2)                      |     2      | `<organization_id>/<filename>`                                                           |
| proposal-layouts   |  true  |       1 |  1.0 MB | pdf(1)                               |     3      | `<organization_id>/<layout_id>/<filename>`                                               |
| proposal-pdfs      |  false |     104 |  2.4 MB | html(104)                            |     2      | `<organization_id>/<proposal_id>.html`                                                   |

Observações:
- Todos os objetos hoje pertencem a **1 única organização** (`d1b68a0f-...`). Não há evidência de escrita cross-org no dataset atual.
- 3 objetos em `opportunity-files` têm nomes contendo a string `_contrato` — são **contratos assinados** ou anexos comerciais.
- `proposal-pdfs` armazena HTML renderizado da proposta (não PDF binário), inclui variáveis substituídas (`account`, `contact`, `owner`, `terms`).

## 2. Policies em `storage.objects`

| Bucket             | SELECT policy?                              | INSERT | UPDATE | DELETE | Listagem cross-org bloqueada? |
| ------------------ | ------------------------------------------- | :----: | :----: | :----: | :---------------------------: |
| avatars            | (sem policy → depende de public URL)        |   ✔    |   ✔    |   ✔    |               ✔               |
| opportunity-files  | org-scoped (Users can view org files)       |   ✔    |   —    |   ✔    |               ✔               |
| organization-logos | (sem policy → depende de public URL)        |   ✔    |   ✔    |   ✔    |               ✔               |
| product-images     | (sem policy → depende de public URL)        |   ✔    |   ✔    |   ✔    |               ✔               |
| proposal-layouts   | (sem policy → depende de public URL)        |   ✔    |   ✔    |   ✔    |               ✔               |
| proposal-pdfs      | org-scoped (Org members can access ...)     |   ✔    |   ✔    |   ✔    |               ✔               |

Nota Fase 1.5: policies amplas de SELECT em avatars/organization-logos/product-images/proposal-layouts foram removidas — listagem via API está bloqueada, mas **URL pública direta continua acessível** enquanto `public=true`.

## 3. Referências no código

### 3.1 Frontend (`src/`)

| Bucket             | Arquivos                                                                                                                   | Operação                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| avatars            | `pages/settings/ProfileSettings.tsx`, `components/UserProfileCard.tsx`                                                    | upload + `getPublicUrl`                           |
| opportunity-files  | `services/supabase/opportunity-files.ts`, `services/crm/opportunity-files.ts`, `components/opportunity/OpportunityFilesTab.tsx` | upload + `download` (usa API, não public URL)     |
| organization-logos | `pages/settings/OrganizationSettings.tsx`                                                                                  | upload + `getPublicUrl` + remove                  |
| product-images     | `components/products/ImageUpload.tsx`                                                                                      | upload + `getPublicUrl`                           |
| proposal-layouts   | `services/supabase/proposal-layouts.ts`, `pages/settings/ProposalLayouts.tsx`, `components/proposals/*`                    | createBucket + upload + `getPublicUrl` + remove  |
| proposal-pdfs      | (frontend apenas lê `proposals.pdf_url`)                                                                                   | leitura de URL persistida                         |

### 3.2 Edge Functions (`supabase/functions/`)

- `generate-proposal-pdf/index.ts` — grava em `proposal-pdfs` como service_role, gera `createSignedUrl(fileName, 7d)` e **persiste em `proposals.pdf_url`** (finding P-01 abaixo).

### 3.3 Colunas de banco com URLs persistidas

| Tabela               | Coluna              | Tipo de URL             | Risco                                                            |
| -------------------- | ------------------- | ----------------------- | ---------------------------------------------------------------- |
| `proposals`          | `pdf_url`           | signed URL (7d)         | **P-01**: signed URL persistida por 7d — vazamento por logs/BI    |
| `proposals`          | `acceptance_proof_url` | *a inspecionar*      | verificar se contém IP/documento do aceite                        |
| `proposal_layouts`   | `terms_pdf_url`     | public URL              | **P-02**: quebra ao privatizar o bucket                          |
| `proposal_layout_pages` | `file_url`       | public URL (assumido)   | idem P-02                                                         |
| `organizations`      | `logo_url`          | public URL              | aceitável (PUBLIC_APPROVED)                                       |
| `accounts`           | `logo_url`          | public URL              | aceitável (logo de terceiro; verificar consentimento)             |
| `profiles`           | `avatar_url`        | public URL              | aceitável se avatar sem PII embutida                              |
| `products`           | `image_url`         | public URL              | aceitável (imagem comercial)                                      |
| `proposal_items`     | `image_url`         | public URL              | aceitável (herda de products)                                     |
| `opportunity_files`  | `storage_path`      | **path**, não URL       | seguro (download via API com JWT)                                 |

## 4. Findings agregados

- **P-01** — `proposals.pdf_url` armazena signed URL de 7 dias em coluna consultada por múltiplos relatórios/BI/exports. Vazamento por log ou snapshot expõe conteúdo até expiração.
- **P-02** — Ao privatizar `proposal-layouts`, `proposal_layouts.terms_pdf_url` e `proposal_layout_pages.file_url` (public URLs) deixam de resolver. Requer backfill para `storage_path` + geração de signed URL sob demanda.
- **P-03** — `opportunity-files` contém contratos (`*_contrato*`). Já está privado, mas policy atual permite `INSERT` sem validar `metadata.organization_id` contra `organization_members` de forma explícita além do prefixo do path.
- **P-04** — Filenames em `opportunity-files` preservam o nome original do usuário (ex.: `kings league brazil_contrato.pdf`). Pode revelar contraparte comercial em logs de storage.
- **P-05** — Nenhum bucket sensível hoje impõe `file_size_limit` ou `allowed_mime_types`. Risco de upload malicioso e abuso de armazenamento.
- **P-06** — Não há função centralizada para geração de signed URL. Cada consumidor decidiria TTL, escopo e cache — anti-pattern.

## 5. Métricas para relatório final

- Buckets: **6**
- Públicos hoje: **4** (avatars, organization-logos, product-images, proposal-layouts)
- Privados hoje: **2** (opportunity-files, proposal-pdfs)
- Buckets recomendados públicos após reclassificação: **3** (avatars, organization-logos, product-images)
- Buckets recomendados privados após reclassificação: **3** (opportunity-files, proposal-pdfs, proposal-layouts)
- URLs persistidas em colunas de banco a inspecionar: **10 colunas** em 8 tabelas
