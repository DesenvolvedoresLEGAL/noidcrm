# 05 — Privatize proposal-layouts

Este passo **não é SQL**. Ação a executar via tool no CI (não em produção):

```
supabase--storage_update_bucket(name="proposal-layouts", public=false)
```

Depois, aplicar `05b_proposal_layouts_policies.sql` para criar as policies org-scoped.

Rollback: `supabase--storage_update_bucket(name="proposal-layouts", public=true)`.
