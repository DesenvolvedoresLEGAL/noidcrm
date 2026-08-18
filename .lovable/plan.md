# MIG-04B.1 — Transport Capability Probe (read-only)

No code, database, storage, settings, secrets or configuration was modified. Only read operations and one anonymous HTTP GET per bucket sample were performed.

## Verdict

| Capability | Available | Mechanism |
|---|---|---|
| Export all legacy Postgres rows for org `d1b68a0f-…f2d` | Yes | `psql` in the agent sandbox (managed `PG*` env), `COPY (SELECT …) TO STDOUT WITH CSV HEADER`, plus Supabase `read_query` tool |
| Download bytes of **public** objects (`product-images`, `avatars`, `organization-logos`, `proposal-layouts`) | Yes | Anonymous HTTP GET `/storage/v1/object/public/<bucket>/<path>` via `curl` |
| Download bytes of **private** objects (`proposal-pdfs`, `opportunity-files`) | Conditional — not with current credentials | Requires a minted end-user session JWT (`lovable auth-session`) whose org membership satisfies the existing storage SELECT policies; no service-role key exists in this runtime |

## Evidence gathered

- Database read confirmed: 414 base tables in `public`; 2,897 `opportunities` rows for the target org; `storage.objects` metadata readable.
- Object inventory under the org-id path prefix: `proposal-pdfs` 104, `opportunity-files` 80, `product-images` 30, `organization-logos` 1, `proposal-layouts` 1.
- Bucket public flags: `avatars`, `organization-logos`, `product-images`, `proposal-layouts` = public; `opportunity-files`, `proposal-pdfs` = private.
- Public byte download verified: sample `product-images` object returned HTTP 200 with full payload (SHA-256 computable).
- Private byte download with anonymous key: HTTP 400 (denied), as expected.
- No service-role key or database password is available in this runtime (Lovable Cloud never exposes them). Browser auth status: `signed_out`.
- Private buckets do have `SELECT` policies scoped to active organization members (`Users can view proposal PDFs in their org`, `Users can view org files`), so an authenticated org-member JWT is a valid read path. The target org has 6 active members.

## Recommended transport (if you approve the next step)

1. **Rows**: per-table `COPY … TO STDOUT WITH CSV HEADER` filtered by `organization_id`, plus a manifest with row counts and per-file SHA-256. Purely read-only.
2. **Public objects**: enumerate from `storage.objects`, fetch each public URL, hash bytes.
3. **Private objects**: mint a read-only session for one active member of the target org (`lovable auth-session`, requires your approval in the tool prompt — it creates an auth session but writes no project data), then fetch each object through the Storage API under that member's RLS scope and hash the bytes. If you consider session minting a write to the old project, the alternative is you supplying signed URLs generated outside this runtime.

## Constraints noted

- No secret, key or token value is disclosed anywhere in this report or in any planned artifact.
- Full `pg_dump` is not available from this access path; table/query CSV or JSON exports are.
