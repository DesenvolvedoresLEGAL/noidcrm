# Storage Migration Plan (staged — NÃO aplicar em produção nesta fase)

Data: 2026-07-11
Localização das migrations: `supabase/migrations-staged/storage/` — pasta fora do path que o Supabase aplica automaticamente. Só serão movidas para `supabase/migrations/` após:

1. Provisionamento do projeto Supabase de staging.
2. Aplicação em staging via `scripts/apply-migrations-staging.sh`.
3. Suíte de tenant-isolation executada com 0 falhas.
4. Aprovação humana das decisões pendentes em `storage-impact-analysis.md §6`.

## Ordem de aplicação

| # | Arquivo                                                          | Descrição                                                                                                    | Idempotente | Rollback                                     |
| - | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | :---------: | -------------------------------------------- |
| 1 | `01_add_storage_path_columns.sql`                                | Adiciona `proposal_layouts.storage_path`, `proposal_layout_pages.storage_path`, `proposals.pdf_storage_path` |      ✔      | `ALTER TABLE ... DROP COLUMN`                |
| 2 | `02_backfill_storage_paths.sql`                                  | Backfill a partir de URLs públicas atuais                                                                    |      ✔      | Colunas nullable — reversível deixando NULL  |
| 3 | `03_harden_opportunity_files_policies.sql`                       | Substitui policies INSERT/UPDATE por validação estrita via `storage.foldername(name)[1]::uuid`                |      ✔      | `DROP POLICY` + `CREATE POLICY` legada       |
| 4 | `04_harden_proposal_pdfs_policies.sql`                           | Mesmo padrão em `proposal-pdfs`                                                                               |      ✔      | idem                                         |
| 5 | `05_privatize_proposal_layouts.sql`                              | Via `supabase--storage_update_bucket` — não SQL; policies novas em `storage.objects`                          |      ✔      | `supabase--storage_update_bucket public=true` |
| 6 | `06_create_signed_url_rpcs.sql`                                  | `get_proposal_pdf_signed_url`, `get_proposal_layout_signed_url` (SECURITY DEFINER, search_path=public)         |      ✔      | `DROP FUNCTION`                              |
| 7 | `07_deprecate_pdf_url_persistence.sql`                           | Trigger que impede novos `UPDATE proposals SET pdf_url = <valor não NULL>` fora de service_role                |      ✔      | `DROP TRIGGER`                                |

**Após deploy do código consumidor** (nova camada de signed URL): remover coluna `proposals.pdf_url` em migration futura, não incluída neste plano.

## Detalhamento

### 03_harden_opportunity_files_policies.sql (extrato)

```sql
-- DROP + RECREATE em bloco transacional
DROP POLICY IF EXISTS "Users can upload org files" ON storage.objects;

CREATE POLICY "Users upload own-org opportunity files"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'opportunity-files'
  AND (storage.foldername(name))[1]::uuid = public.get_user_organization_id()
  AND public.user_org_membership_active(auth.uid())
);
```

### 06_create_signed_url_rpcs.sql (extrato)

```sql
CREATE OR REPLACE FUNCTION public.get_proposal_pdf_signed_url(_proposal_id uuid, _ttl int DEFAULT 300)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _path text;
BEGIN
  SELECT organization_id, pdf_storage_path INTO _org, _path
  FROM proposals WHERE id = _proposal_id;

  IF _org IS NULL OR _path IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid() AND organization_id = _org AND status = 'active'
  ) THEN
    RETURN NULL; -- não vaza o motivo
  END IF;

  -- delega para storage.sign() (Supabase Storage API interna) — chamado pelo edge function
  -- mantém apenas metadados; RPC não gera a URL sozinha
  RETURN _path; -- edge function completa
END;
$$;
```

## Rollback global

- Migrations 1–4 e 6–7: reversíveis via DROP.
- Migration 5 (privatize bucket): reversível chamando `supabase--storage_update_bucket(name='proposal-layouts', public=true)`.
- Backfill (2): dados originais em `terms_pdf_url` permanecem preservados até release seguinte.

## Ambientes

| Ambiente     | Aplicar migrations? | Executar suíte tenant-isolation? |
| ------------ | :-----------------: | :------------------------------: |
| staging      |          ✔          |                ✔                 |
| produção     |          ✗ (aguarda aprovação humana)          |                ✗                 |

## Ações destrutivas paradas para revisão

- **Alterar bucket `proposal-layouts` para privado** — impacta URLs em emails, exports e materiais entregues a clientes.
- **Trigger que bloqueia `UPDATE proposals SET pdf_url = X`** — impacta edge functions legadas se houver.
- **Remoção futura de `proposals.pdf_url`** — não incluída aqui, mas antecipada.

Nada disso será aplicado sem sinal explícito de "aprovar" após revisão deste plano + resultados da Fase 2 em staging.
