// NOID-VERTICAL-1.0-VERT-01.2B
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type { InventoryProviderType } from '../providers/types';

export type InventoryProviderSelectionSource =
  | 'manual'
  | 'legacy_backfill'
  | 'legacy_eventrix_settings';

export interface InventoryProviderSettingsRow {
  id: string;
  organization_id: string;
  provider_type: InventoryProviderType;
  is_enabled: boolean;
  selection_source: InventoryProviderSelectionSource;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertInventoryProviderInput {
  provider_type: InventoryProviderType;
  is_enabled?: boolean;
  selection_source?: InventoryProviderSelectionSource;
}

const TABLE = 'inventory_provider_settings';

async function fetchSettings(organizationId: string) {
  const { data, error } = await (supabase as any)
    .from(TABLE)
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as InventoryProviderSettingsRow | null) ?? null;
}

export async function upsertInventoryProviderSettings(params: {
  organizationId: string;
  userId?: string | null;
  input: UpsertInventoryProviderInput;
}): Promise<InventoryProviderSettingsRow> {
  const { organizationId, userId, input } = params;
  const payload = {
    organization_id: organizationId,
    provider_type: input.provider_type,
    is_enabled: input.is_enabled ?? true,
    selection_source: input.selection_source ?? 'manual',
    updated_by: userId ?? null,
  };

  const { data: existing, error: readErr } = await (supabase as any)
    .from(TABLE)
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (readErr) throw readErr;

  if (existing?.id) {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as InventoryProviderSettingsRow;
  }

  const { data, error } = await (supabase as any)
    .from(TABLE)
    .insert({ ...payload, created_by: userId ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryProviderSettingsRow;
}

export function useInventoryProviderSettings() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id ?? null;
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['inventory-provider-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => fetchSettings(orgId as string),
    staleTime: 60_000,
  });

  const upsert = useMutation({
    mutationFn: async (input: UpsertInventoryProviderInput) => {
      if (!orgId) throw new Error('Organização não encontrada.');
      return upsertInventoryProviderSettings({
        organizationId: orgId,
        userId: user?.id,
        input,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-provider-settings', orgId] });
      qc.invalidateQueries({ queryKey: ['inventory-provider', orgId] });
    },
  });

  return {
    settings: q.data ?? null,
    providerType: q.data?.provider_type ?? null,
    isEnabled: q.data?.is_enabled ?? null,
    source: q.data?.selection_source ?? null,
    isLoading: q.isLoading,
    error: q.error,
    upsertProvider: upsert.mutateAsync,
    isSaving: upsert.isPending,
    refresh: q.refetch,
  };
}
