/**
 * Sprint Active Users Source of Truth
 * -----------------------------------
 * Reescrito para ler EXCLUSIVAMENTE de `crm_active_users_view`.
 * Mantém a assinatura antiga para não quebrar os 15+ consumidores existentes.
 *
 * `extraUserIds`: usado para incluir o owner/responsável atualmente salvo num
 * registro mesmo que ele não esteja mais ativo, para que o nome histórico
 * apareça em formulários de edição. Esses usuários vêm marcados como
 * `(Inativo)` e ficam visíveis mas o consumidor pode optar por não permitir
 * sua seleção.
 *
 * Telas administrativas (Equipes e Usuários) NÃO devem usar este hook —
 * elas precisam ver inativos/excluídos/aguardando, e fazem isso lendo
 * diretamente de `organization_members` com filtros próprios.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrgUser {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export function useOrganizationUsers(extraUserIds: Array<string | null | undefined> = []) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const extrasKey = extraUserIds.filter((id): id is string => !!id).sort().join(',');

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        setLoading(true);

        const { data: tenantId, error: tenantErr } = await supabase.rpc('get_user_organization_id');
        if (tenantErr) throw tenantErr;
        if (!tenantId) {
          if (!cancelled) setUsers([]);
          return;
        }

        // 1) Usuários ativos (fonte oficial)
        const { data: activeRows, error: activeErr } = await (supabase as any)
          .from('crm_active_users_view')
          .select('user_id, full_name, email, avatar_url')
          .eq('tenant_id', tenantId)
          .order('full_name');
        if (activeErr) throw activeErr;

        const active: OrgUser[] = (activeRows || []).map((r: any) => ({
          id: r.user_id,
          name: r.full_name || 'Sem nome',
          email: r.email || undefined,
          avatar_url: r.avatar_url || undefined,
        }));

        // 2) Histórico: incluir extras (inativos) APENAS se solicitados explicitamente,
        // marcados com "(Inativo)". Permite exibir o owner atual em formulários.
        const activeSet = new Set(active.map((u) => u.id));
        const extras = extrasKey ? extrasKey.split(',') : [];
        const missingExtras = extras.filter((id) => !activeSet.has(id));

        let historical: OrgUser[] = [];
        if (missingExtras.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email, avatar_url')
            .in('user_id', missingExtras);

          historical = (profiles || []).map((p) => ({
            id: p.user_id,
            name: `${p.full_name || 'Sem nome'} (Inativo)`,
            email: p.email || undefined,
            avatar_url: p.avatar_url || undefined,
          }));
        }

        if (!cancelled) setUsers([...active, ...historical]);
      } catch (err) {
        if (!cancelled) setError(err as Error);
        console.error('[useOrganizationUsers] error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [extrasKey]);

  return { users, loading, error };
}
