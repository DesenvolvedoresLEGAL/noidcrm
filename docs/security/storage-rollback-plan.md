# Rollback — Storage privatization

Escopo: migrations `01..07` em `supabase/migrations-staged/storage/`.

## Rollback total (staging)

```bash
# 1. Reverter privatização de proposal-layouts
#    (executar via tooling do Supabase, não SQL)
supabase--storage_update_bucket(name="proposal-layouts", public=true)

# 2. Remover trigger e função de bloqueio
psql "$TEST_SUPABASE_DB_URL" <<'SQL'
DROP TRIGGER IF EXISTS trg_block_pdf_url_persistence ON public.proposals;
DROP FUNCTION IF EXISTS public.tg_block_pdf_url_persistence();
SQL

# 3. Remover RPCs de resolução
psql "$TEST_SUPABASE_DB_URL" <<'SQL'
DROP FUNCTION IF EXISTS public.resolve_proposal_pdf_path(uuid);
DROP FUNCTION IF EXISTS public.resolve_proposal_layout_path(uuid);
SQL

# 4. Recriar policies antigas (arquivadas em docs/security/legacy-storage-policies.sql)
psql "$TEST_SUPABASE_DB_URL" -f docs/security/legacy-storage-policies.sql

# 5. (Opcional) DROP das colunas — só se nenhum consumidor novo já usa
psql "$TEST_SUPABASE_DB_URL" <<'SQL'
ALTER TABLE public.proposal_layouts       DROP COLUMN IF EXISTS storage_path;
ALTER TABLE public.proposal_layout_pages  DROP COLUMN IF EXISTS storage_path;
ALTER TABLE public.proposals              DROP COLUMN IF EXISTS pdf_storage_path;
SQL
```

## Rollback parcial

- **Apenas policies**: DROP policies novas + reaplicar snapshot legacy.
- **Apenas trigger**: `DROP TRIGGER trg_block_pdf_url_persistence` — restabelece comportamento antigo.
- **Apenas bucket**: `supabase--storage_update_bucket(public=true)` — restaura URLs públicas.

## Dados

Backfill deixa dados em `storage_path`/`pdf_storage_path`. Rollback não perde informação; colunas apenas ficam órfãs.

## Sinal de emergência em produção

Se privatização de `proposal-layouts` quebrar clientes:
1. `supabase--storage_update_bucket(name="proposal-layouts", public=true)` — 1 chamada.
2. Comunicar time; investigar consumidor esquecido; re-executar suíte.
3. Não reverter as demais mudanças (policies mais estritas em opportunity-files/proposal-pdfs) — elas não têm impacto observável em usuários legítimos.

## Snapshot legacy

Antes de aplicar em produção, gerar `docs/security/legacy-storage-policies.sql` com:

```bash
psql "$PROD_DB_URL" -tAc "
  SELECT 'CREATE POLICY ' || quote_ident(policyname) || ' ON storage.objects '
      || CASE cmd WHEN 'ALL' THEN '' ELSE 'FOR ' || cmd END
      || ' TO ' || array_to_string(roles, ',')
      || COALESCE(' USING (' || qual || ')', '')
      || COALESCE(' WITH CHECK (' || with_check || ')', '') || ';'
  FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
" > docs/security/legacy-storage-policies.sql
```
