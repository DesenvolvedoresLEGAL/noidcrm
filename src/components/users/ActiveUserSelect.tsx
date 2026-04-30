import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveUsers, useActiveSalesUsers } from '@/hooks/users/useActiveUsers';
import type { ActiveUserOption } from '@/types/activeUser';

interface ActiveUserSelectProps {
  value?: string | null;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** salesOnly = filtra org_role IN ('sales','cs') */
  salesOnly?: boolean;
  /** assignableOnly = mesmo que getActiveAssignableUsers (default = todos ativos) */
  assignableOnly?: boolean;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  excludeUserIds?: string[];
  /**
   * Usuário histórico (inativo) que precisa aparecer como rótulo do valor
   * atualmente selecionado. Renderizado com sufixo "(Inativo)" e desabilitado.
   */
  historicalUser?: { user_id: string; full_name?: string | null } | null;
  className?: string;
}

const ALL = '__all__';

export function ActiveUserSelect({
  value,
  onChange,
  placeholder = 'Selecione um usuário',
  salesOnly = false,
  assignableOnly: _assignableOnly = false,
  includeAllOption = false,
  allOptionLabel = 'Todos',
  disabled,
  excludeUserIds = [],
  historicalUser = null,
  className,
}: ActiveUserSelectProps) {
  const queryAll = useActiveUsers();
  const querySales = useActiveSalesUsers();
  const query = salesOnly ? querySales : queryAll;
  const isLoading = query.isLoading;
  const users = query.data || [];

  const options = useMemo<ActiveUserOption[]>(() => {
    const exclude = new Set(excludeUserIds);
    const filtered = users.filter((u) => !exclude.has(u.user_id));
    // Anexa usuário histórico (inativo) somente se selecionado e não estiver na lista ativa
    if (historicalUser && historicalUser.user_id && !filtered.some((u) => u.user_id === historicalUser.user_id)) {
      filtered.push({
        tenant_id: '',
        user_id: historicalUser.user_id,
        full_name: `${historicalUser.full_name || 'Usuário'} (Inativo)`,
        email: null,
        avatar_url: null,
        org_role: null,
        status: 'active',
        label: `${historicalUser.full_name || 'Usuário'} (Inativo)`,
        value: historicalUser.user_id,
        isInactive: true,
      });
    }
    return filtered;
  }, [users, excludeUserIds, historicalUser]);

  const selected = includeAllOption && (!value || value === '') ? ALL : value || undefined;

  return (
    <Select
      value={selected}
      onValueChange={(v) => onChange(v === ALL ? '' : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? 'Carregando...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAllOption && <SelectItem value={ALL}>{allOptionLabel}</SelectItem>}
        {options.map((u) => (
          <SelectItem key={u.user_id} value={u.user_id} disabled={u.isInactive}>
            {u.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
