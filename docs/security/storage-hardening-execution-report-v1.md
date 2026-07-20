# Storage Hardening Execution Report v1

**Sprint:** NOID-SECURITY 1.0 — Fase 8
**Status:** **NÃO EXECUTADO EM STAGING — bloqueado por ausência do projeto Supabase de staging.**

## 1. Estado planejado

As 7 migrations em `supabase/migrations-staged/storage/` permanecem staged
(não aplicadas em produção nem em staging):

| Arquivo | Objetivo | Rollback | Estado |
| --- | --- | --- | --- |
| `01_add_storage_path_columns.sql` | Adiciona colunas `*_storage_path` em `proposals`, `opportunity_files`, `account_documents` | `ALTER TABLE ... DROP COLUMN` documentado | STAGED |
| `02_backfill_storage_paths.sql` | Backfill server-side dos paths existentes | Idempotente; sem rollback destrutivo | STAGED |
| `03_harden_opportunity_files_policies.sql` | Restringe RLS de `storage.objects` para `opportunity-files` por membership | Restaurar policies anteriores | STAGED |
| `04_harden_proposal_pdfs_policies.sql` | Mesmo para `proposal-pdfs` | Idem | STAGED |
| `05_privatize_proposal_layouts.README.md` + `05b_proposal_layouts_policies.sql` | Torna `proposal-layouts` privado + RLS por org | Reabrir bucket + policy antiga | STAGED |
| `06_create_signed_url_rpcs.sql` | RPCs `resolve_proposal_pdf_path` / `resolve_opportunity_file_path` (SECURITY DEFINER, search_path fixo) | `DROP FUNCTION` | STAGED |
| `07a_pdf_url_write_audit.sql` | Trigger de auditoria: registra escritas em `proposals.pdf_url` em `system_events` | Drop trigger | STAGED |
| `07b_pdf_url_enforcement.sql` | Trigger que **bloqueia** escritas em `proposals.pdf_url` fora de `service_role` | Drop trigger | STAGED |

## 2. Motivo do bloqueio

Idem Fase 5 — sem projeto de staging, a política aprovada em
`docs/security/phase2-approval-decisions.md` **proíbe aplicar essas migrations
em produção**. Especificamente, 07a → observar violações → corrigir → só então
07b não pode ser encurtado.

## 3. Inventário atual (produção — apenas leitura)

Não realizado nesta sprint. O inventário estático permanece em
`docs/security/storage-inventory.md` e `storage-classification.csv`. A
homologação depende de re-inventariar em staging após aplicar as migrations.

## 4. Signed URLs

RPCs `resolve_proposal_pdf_path` e `resolve_opportunity_file_path` estão
prontas em `06_create_signed_url_rpcs.sql`, com:

- `SECURITY DEFINER`, `SET search_path = public`.
- Verificação de membership contra a organização dona do arquivo.
- Retorno apenas do path — cliente chama edge function que gera signed URL com
  TTL curto (padrão 300s).

**Homologação (bucket privado / signed URL válida / expirada / cross-org)
não executada** — depende do staging.

## 5. `pdf_url`

Fluxo em duas etapas aprovado (07a auditoria → 07b enforcement) permanece o
plano oficial. Aplicação e observação de logs precisam do staging.

## 6. Rollback

Cada arquivo staged inclui bloco `-- Rollback:` no cabeçalho. Simulação de
rollback também depende do staging.

## 7. Conclusão parcial

- **P0-03 (Storage / buckets privados / signed URLs):** permanece **ABERTO**.
- Nenhuma alteração de bucket, policy de `storage.objects` ou trigger em
  `proposals` foi aplicada nesta sprint em qualquer ambiente.
