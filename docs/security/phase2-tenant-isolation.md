# Fase 2 — Tenant Isolation Suite (Status atualizado)

Data: 2026-07-11

## Estado atual

- Suíte automatizada criada em `src/test/security/tenant-isolation/`.
- Workflow `.github/workflows/tenant-isolation.yml` configurado.
- **Bloqueio**: sem projeto Supabase de staging provisionado, a suíte ainda não foi executada end-to-end. Fixture aborta se `TEST_SUPABASE_URL === VITE_SUPABASE_URL`.

## Progresso — Storage (paralelo ao provisionamento do staging)

Concluído nesta iteração (Opção B do último ciclo):

- Inventário completo: `docs/security/storage-inventory.md`.
- Classificação: `docs/security/storage-classification.csv`.
- Análise de impacto: `docs/security/storage-impact-analysis.md`.
- Plano de migração: `docs/security/storage-migration-plan.md`.
- Migrations preparadas em `supabase/migrations-staged/storage/` (NÃO aplicadas).
- Testes ampliados em `src/test/security/tenant-isolation/storage.test.ts` cobrindo S1–S12.
- Script de staging: `scripts/apply-migrations-staging.sh`.
- Checklist manual: `docs/security/storage-post-migration-checklist.md`.
- Rollback: `docs/security/storage-rollback-plan.md`.

## Buckets

| Bucket             | Estado hoje | Classificação alvo   | Ação pendente                                             |
| ------------------ | :---------: | -------------------- | --------------------------------------------------------- |
| avatars            |   public    | PUBLIC_APPROVED      | manter — mime/size limits em migration futura              |
| organization-logos |   public    | PRIVATE_ORG_SCOPED   | **reclassificado 2026-07-11** — privatizar por default; flag público via fluxo deliberado (fase futura) |
| product-images     |   public    | PUBLIC_APPROVED      | manter — content policy (só imagens genéricas de catálogo, sem PII/preços/propostas) + mime/size limits |
| proposal-layouts   |   public    | PRIVATE_ORG_SCOPED   | **privatizar + policies + backfill storage_path + signed URL 5–15min** |
| opportunity-files  |   private   | PRIVATE_ORG_SCOPED   | endurecer policies + renomeação gradual via `storage_path_migration` |
| proposal-pdfs      |   private   | PRIVATE_ORG_SCOPED   | rollout em 2 etapas (`07a` audit → `07b` enforcement)      |

> Decisões aprovadas em `docs/security/phase2-approval-decisions.md` (2026-07-11).

## Findings principais

- **P-01** — `proposals.pdf_url` armazena signed URL de 7 dias. Correção: RPC `resolve_proposal_pdf_path` + trigger que bloqueia persistência.
- **P-02** — Privatização de `proposal-layouts` quebra `terms_pdf_url`. Correção: coluna `storage_path` + signed URL sob demanda.
- **P-03/04** — Policies de storage podem ser mais estritas em cast `uuid` e checagem de `organization_members.status='active'`.
- **P-05** — Nenhum bucket tem `file_size_limit`/`allowed_mime_types` definidos.
- **P-06** — Falta função utilitária única `getSignedUrl()`.

## Decisões pendentes de aprovação humana

Ver `storage-impact-analysis.md §6`. Nenhuma migração destrutiva será aplicada sem sinal explícito após:

1. Provisionamento do staging + secrets no CI.
2. Execução end-to-end da suíte (Fase 2 completa).
3. Aprovação das decisões listadas.

## Bloqueio para Fases 3, 4, 5

Mantido. Fases 3 (segredos no bundle), 4 (backup/restore) e 5 (relatório final) começam **somente** após:

- Fixture rodar 100% no staging com 0 falhas / 0 skips não justificados.
- Teardown validado (12 usuários + 2 orgs).
- Evidências salvas em `docs/security/evidence/phase2/`.
- Inventário/classificação de buckets aceito.
- Nenhum arquivo sensível permanecendo em bucket público.
