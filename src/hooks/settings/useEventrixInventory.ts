import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import type {
  EventrixInventorySettingsInput,
  EventrixInventoryStatus,
} from '@/schemas/eventrixInventorySettings';

export interface EventrixInventorySettings {
  id: string;
  organization_id: string;
  environment: 'sandbox' | 'production';
  base_url: string | null;
  api_key_secret_name: string | null;
  status: EventrixInventoryStatus;
  last_connection_check_at: string | null;
  last_connection_status: string | null;
  last_connection_message: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  is_enabled: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventrixSyncCacheRow {
  id: string;
  organization_id: string;
  eventrix_entity_id: string;
  entity_type: 'category' | 'family';
  name: string;
  description: string | null;
  parent_eventrix_entity_id: string | null;
  control_mode: string | null;
  item_kind: string | null;
  is_active: boolean;
  payload: Record<string, unknown>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

const SETTINGS_TABLE = 'eventrix_inventory_integration_settings';
const CACHE_TABLE = 'eventrix_inventory_sync_cache';

// ------------ Settings ------------

export function useEventrixInventorySettings() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['eventrix-inv-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .select('*')
        .eq('organization_id', orgId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EventrixInventorySettings | null;
    },
  });
}

export function useUpsertEventrixInventorySettings() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EventrixInventorySettingsInput) => {
      if (!orgId) throw new Error('Organização não encontrada.');

      const nextStatus: EventrixInventoryStatus = !input.is_enabled
        ? 'disabled'
        : input.base_url && input.base_url.trim().length > 0
          ? 'configured'
          : 'not_configured';

      const payload = {
        organization_id: orgId,
        environment: input.environment,
        base_url: input.base_url?.trim() || null,
        api_key_secret_name: input.api_key_secret_name?.trim() || null,
        is_enabled: input.is_enabled,
        status: nextStatus,
        updated_by: user?.id ?? null,
      };

      // Check if row exists
      const { data: existing, error: findErr } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing?.id) {
        const { data, error } = await (supabase as any)
          .from(SETTINGS_TABLE)
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        return data as EventrixInventorySettings;
      }

      const { data, error } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('*')
        .single();
      if (error) throw error;
      return data as EventrixInventorySettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventrix-inv-settings', orgId] });
    },
  });
}

// Local-only connection test: no external call.
export function useTestEventrixInventoryConnection() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organização não encontrada.');

      // Read current row
      const { data: current, error: readErr } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .select('id, base_url, is_enabled')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (readErr) throw readErr;

      const nowIso = new Date().toISOString();
      const hasUrl = !!current?.base_url && current.base_url.trim().length > 0;

      const patch = hasUrl
        ? {
            last_connection_check_at: nowIso,
            last_connection_status: 'pending',
            last_connection_message:
              'Configuração local validada. Teste real será ativado na próxima etapa.',
            status: (current?.is_enabled ? 'configured' : 'disabled') as EventrixInventoryStatus,
            updated_by: user?.id ?? null,
          }
        : {
            last_connection_check_at: nowIso,
            last_connection_status: 'error',
            last_connection_message: 'URL base do Eventrix não configurada.',
            status: 'not_configured' as EventrixInventoryStatus,
            updated_by: user?.id ?? null,
          };

      if (!current?.id) {
        // Create a stub row so the test result is persisted
        const { data, error } = await (supabase as any)
          .from(SETTINGS_TABLE)
          .insert({
            organization_id: orgId,
            environment: 'sandbox',
            is_enabled: false,
            created_by: user?.id ?? null,
            ...patch,
          })
          .select('*')
          .single();
        if (error) throw error;
        return { row: data as EventrixInventorySettings, hasUrl };
      }

      const { data, error } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .update(patch)
        .eq('id', current.id)
        .select('*')
        .single();
      if (error) throw error;
      return { row: data as EventrixInventorySettings, hasUrl };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventrix-inv-settings', orgId] });
    },
  });
}

// ------------ Sync cache ------------

export function useEventrixInventorySyncCache(entityType: 'category' | 'family') {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['eventrix-inv-sync-cache', orgId, entityType],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(CACHE_TABLE)
        .select('*')
        .eq('organization_id', orgId as string)
        .eq('entity_type', entityType)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventrixSyncCacheRow[];
    },
  });
}

export function useTriggerEventrixInventorySync() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organização não encontrada.');

      const nowIso = new Date().toISOString();
      const patch = {
        last_sync_at: nowIso,
        last_sync_status: 'pending',
        last_sync_message:
          'Sincronização real será ativada após a API do Eventrix estar disponível.',
        updated_by: user?.id ?? null,
      };

      const { data: current, error: readErr } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (readErr) throw readErr;

      if (!current?.id) {
        const { data, error } = await (supabase as any)
          .from(SETTINGS_TABLE)
          .insert({
            organization_id: orgId,
            environment: 'sandbox',
            is_enabled: false,
            created_by: user?.id ?? null,
            ...patch,
          })
          .select('*')
          .single();
        if (error) throw error;
        return data as EventrixInventorySettings;
      }

      const { data, error } = await (supabase as any)
        .from(SETTINGS_TABLE)
        .update(patch)
        .eq('id', current.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as EventrixInventorySettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventrix-inv-settings', orgId] });
      qc.invalidateQueries({ queryKey: ['eventrix-inv-sync-cache', orgId] });
    },
  });
}
