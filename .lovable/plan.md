# Fix: Exclusão de atividades bloqueada por RLS

## Causa raiz

A tabela `public.activities` tem hoje **uma única policy de DELETE**, restrita a admins:

```
Admins delete activities
USING: (organization_id = get_user_organization_id()) AND can_view_all(auth.uid())
```

Qualquer usuário que não seja admin/manager com `can_view_all=true` bate em RLS, o `.delete()` retorna 0 linhas afetadas sem erro, e a UI mostra "Atividade excluída com sucesso" — mas o registro continua no banco. É exatamente o sintoma do print.

Os erros 400 em `contacts` no console são de outra query (filtro com `contact_id IS NULL`) e não têm relação com a exclusão.

## Mudança

Substituir a policy `Admins delete activities` por uma que permita exclusão a **qualquer membro autenticado da mesma organização**, mantendo o isolamento multi-tenant.

### Migration SQL

```sql
DROP POLICY IF EXISTS "Admins delete activities" ON public.activities;

CREATE POLICY "Org members delete activities"
ON public.activities
FOR DELETE
TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id = public.get_user_organization_id()
);
```

## O que NÃO muda

- Frontend (`deleteActivity` em `src/services/supabase/activities.ts`) já chama `.delete().eq('id', id)` corretamente — nada a alterar.
- Policies de SELECT/INSERT/UPDATE permanecem como estão (visibilidade por owner/team continua intacta).
- Isolamento multi-tenant preservado (mantém `organization_id = get_user_organization_id()`).
- Sem impacto em soft-delete, triggers de snapshot ou `deletion_alerts` (continuam disparando normalmente via triggers existentes).

## Riscos

- **Baixo**: qualquer membro da org passa a poder excluir atividades de colegas. É exatamente o comportamento pedido ("habilitar pra qualquer tipo de usuário"). O sistema de `entity_snapshots` + `deletion_alerts` + lixeira já cobre auditoria e restauração.

## Próximos passos

1. Aplicar a migration.
2. QA: logar como Sales (não-admin), excluir uma atividade antiga, confirmar que some da lista e aparece em Lixeira.
