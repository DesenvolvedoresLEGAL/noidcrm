import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchUserContextOptions,
  fetchUserContexts,
  saveUserContext,
  type SaveUserContextPayload,
  type UserContextRow,
} from '@/services/crm/userContext';

export function useUserContextOptions(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-context-options', tenantId],
    queryFn: () => fetchUserContextOptions(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserContexts(tenantId: string | null | undefined, organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-contexts', tenantId, organizationId],
    queryFn: () => fetchUserContexts(tenantId!, organizationId!),
    enabled: !!tenantId && !!organizationId,
    staleTime: 30 * 1000,
  });
}

export type ReviewStatus = 'validated' | 'needs_review' | 'incomplete' | 'no_context';

export function getReviewStatus(row: UserContextRow): ReviewStatus {
  if (!row.context_id) return 'no_context';
  if (!row.permission_key || !row.department_key || !row.business_function_key) return 'incomplete';
  const requiresReview = (row.metadata as any)?.requires_review === true;
  return requiresReview ? 'needs_review' : 'validated';
}

export function useUserContextStats(rows: UserContextRow[] | undefined) {
  if (!rows) return { total: 0, withContext: 0, needsReview: 0, noContext: 0, incomplete: 0 };
  let withContext = 0;
  let needsReview = 0;
  let noContext = 0;
  let incomplete = 0;
  for (const r of rows) {
    const s = getReviewStatus(r);
    if (s === 'no_context') noContext++;
    else withContext++;
    if (s === 'needs_review') needsReview++;
    if (s === 'incomplete') incomplete++;
  }
  return { total: rows.length, withContext, needsReview, noContext, incomplete };
}

export function useSaveUserContext(tenantId: string | null | undefined, organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveUserContextPayload) => saveUserContext(payload),
    onSuccess: (_data, variables) => {
      toast.success('Contexto do usuário atualizado com sucesso.');
      // Invalidate the list view used by the Contexto CRM tab
      qc.invalidateQueries({ queryKey: ['user-contexts', tenantId, organizationId] });
      // Invalidate the per-user (self) view used by ProfileSettings card
      qc.invalidateQueries({ queryKey: ['user-context-self', tenantId, variables.user_id] });
      // Force an immediate refetch so the UI reflects the saved state without manual reload
      qc.refetchQueries({ queryKey: ['user-contexts', tenantId, organizationId], type: 'active' });
      qc.refetchQueries({ queryKey: ['user-context-self', tenantId, variables.user_id], type: 'active' });
    },
    onError: (err: any) => {
      console.error('[useSaveUserContext] error', err);
      toast.error(
        err?.message?.includes('forbidden')
          ? 'Você não tem permissão para editar este contexto.'
          : 'Não foi possível atualizar o contexto do usuário. Verifique suas permissões e tente novamente.',
      );
    },
  });
}
