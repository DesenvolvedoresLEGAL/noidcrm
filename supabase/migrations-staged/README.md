# Migrations Staged

Migrations preparadas mas **NÃO aplicadas** ao projeto atual (produção). O Supabase aplica automaticamente apenas o que está em `supabase/migrations/`.

Fluxo:
1. Revisar `docs/security/storage-migration-plan.md`.
2. Provisionar staging.
3. Copiar arquivos para `supabase/migrations/` **apenas** quando promovido para aplicação.
4. Nunca commitar migrations aqui diretamente para `supabase/migrations/` sem passar por staging + suíte tenant-isolation.
