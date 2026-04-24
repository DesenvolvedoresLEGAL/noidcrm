import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ManagedTag {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TagWithUsage extends ManagedTag {
  account_count: number;
  opportunity_count: number;
  total_usage: number;
}

const KEY = ['tags-management'] as const;

async function fetchTagsWithUsage(): Promise<TagWithUsage[]> {
  const { data: tags, error } = await supabase
    .from('tags')
    .select('*')
    .order('name');
  if (error) throw error;

  const ids = (tags || []).map((t) => t.id);
  if (ids.length === 0) return [];

  const [accountsRes, oppsRes] = await Promise.all([
    supabase.from('account_tags').select('tag_id').in('tag_id', ids),
    supabase.from('opportunity_tags').select('tag_id').in('tag_id', ids),
  ]);

  const accCount: Record<string, number> = {};
  for (const r of accountsRes.data || []) {
    accCount[(r as any).tag_id] = (accCount[(r as any).tag_id] || 0) + 1;
  }
  const oppCount: Record<string, number> = {};
  for (const r of oppsRes.data || []) {
    oppCount[(r as any).tag_id] = (oppCount[(r as any).tag_id] || 0) + 1;
  }

  return (tags || []).map((t) => ({
    ...t,
    account_count: accCount[t.id] || 0,
    opportunity_count: oppCount[t.id] || 0,
    total_usage: (accCount[t.id] || 0) + (oppCount[t.id] || 0),
  }));
}

export function useTagsManagement() {
  return useQuery({ queryKey: KEY, queryFn: fetchTagsWithUsage, staleTime: 15_000 });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: orgId, error: orgErr } = await supabase.rpc('get_user_organization_id');
      if (orgErr) throw orgErr;
      if (!orgId) throw new Error('Usuário sem organização');
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: name.trim(), color, organization_id: orgId as unknown as string })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, color, is_active }: { id: string; name?: string; color?: string; is_active?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = name.trim();
      if (color !== undefined) patch.color = color;
      if (is_active !== undefined) patch.is_active = is_active;
      const { data, error } = await supabase
        .from('tags')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Verificação client-side: não excluir se em uso
      const [{ count: accCount }, { count: oppCount }] = await Promise.all([
        supabase.from('account_tags').select('*', { count: 'exact', head: true }).eq('tag_id', id),
        supabase.from('opportunity_tags').select('*', { count: 'exact', head: true }).eq('tag_id', id),
      ]);
      const total = (accCount || 0) + (oppCount || 0);
      if (total > 0) {
        throw new Error(`Tag em uso por ${total} registro(s). Remova os vínculos antes de excluir.`);
      }
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
