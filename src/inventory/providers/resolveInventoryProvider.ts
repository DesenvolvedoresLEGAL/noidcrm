// NOID-VERTICAL-1.0-VERT-01.2B
// Resolver de provider de inventário.
//
// Precedência:
//   1. `inventory_provider_settings` (fonte canônica tenant-aware).
//   2. `eventrix_inventory_integration_settings` (fallback legado de transição).
//   3. Native (default seguro).
//
// Fallback legado permanece durante a janela de transição enquanto a UI
// administrativa ainda for Eventrix-specific (VERT-01.2B).
import { supabase } from '@/integrations/supabase/client';
import type { InventoryProviderAdapter } from './InventoryProviderAdapter';
import {
  getDefaultInventoryProviderRegistry,
  type InventoryProviderRegistry,
} from './InventoryProviderRegistry';
import type {
  InventoryProviderContext,
  InventoryProviderStatus,
  InventoryProviderType,
} from './types';

export type InventoryProviderResolutionSource =
  | 'canonical_provider_settings'
  | 'legacy_eventrix_settings'
  | 'native_default';

export interface InventoryProviderResolution {
  providerType: InventoryProviderType;
  source: InventoryProviderResolutionSource;
  status: InventoryProviderStatus;
  adapter: InventoryProviderAdapter;
}

export interface CanonicalProviderSettingsRow {
  provider_type: string;
  is_enabled: boolean;
  selection_source?: string | null;
}

export interface ResolveOptions {
  registry?: InventoryProviderRegistry;
  fetchCanonicalSettings?: (
    ctx: InventoryProviderContext,
  ) => Promise<CanonicalProviderSettingsRow | null>;
  fetchEventrixSettings?: (
    ctx: InventoryProviderContext,
  ) => Promise<{ status: string; is_enabled: boolean } | null>;
}

async function defaultFetchCanonicalSettings(ctx: InventoryProviderContext) {
  const { data, error } = await (supabase as any)
    .from('inventory_provider_settings')
    .select('provider_type,is_enabled,selection_source')
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as CanonicalProviderSettingsRow | null) ?? null;
}

async function defaultFetchEventrixSettings(ctx: InventoryProviderContext) {
  const { data, error } = await (supabase as any)
    .from('eventrix_inventory_integration_settings')
    .select('status,is_enabled')
    .eq('organization_id', ctx.organizationId)
    .maybeSingle();
  if (error) throw error;
  return data as { status: string; is_enabled: boolean } | null;
}

function isKnownProviderType(v: string): v is InventoryProviderType {
  return v === 'native' || v === 'eventrix';
}

export async function resolveInventoryProvider(
  ctx: InventoryProviderContext,
  opts: ResolveOptions = {},
): Promise<InventoryProviderResolution> {
  const registry = opts.registry ?? getDefaultInventoryProviderRegistry();
  const fetchCanonical =
    opts.fetchCanonicalSettings ?? defaultFetchCanonicalSettings;
  const fetchEventrix =
    opts.fetchEventrixSettings ?? defaultFetchEventrixSettings;

  // 1. Canonical source.
  let canonical: CanonicalProviderSettingsRow | null = null;
  let canonicalError: Error | null = null;
  try {
    canonical = await fetchCanonical(ctx);
  } catch (err) {
    canonicalError = err as Error;
  }

  if (canonical) {
    if (canonical.is_enabled === false) {
      const native = registry.getDefault();
      return {
        providerType: 'native',
        source: 'canonical_provider_settings',
        status: await native.getStatus(ctx),
        adapter: native,
      };
    }
    if (!isKnownProviderType(canonical.provider_type)) {
      // Não cair silenciosamente para Eventrix.
      const native = registry.getDefault();
      return {
        providerType: 'native',
        source: 'canonical_provider_settings',
        status: {
          code: 'error',
          message: 'Provider canônico inválido; usando provider nativo.',
          detail: `unknown provider_type=${canonical.provider_type}`,
        },
        adapter: native,
      };
    }
    const adapter = registry.get(canonical.provider_type);
    if (!adapter) {
      const native = registry.getDefault();
      return {
        providerType: 'native',
        source: 'canonical_provider_settings',
        status: {
          code: 'degraded',
          message: `Provider "${canonical.provider_type}" não registrado; fallback nativo.`,
        },
        adapter: native,
      };
    }
    return {
      providerType: canonical.provider_type,
      source: 'canonical_provider_settings',
      status: await adapter.getStatus(ctx),
      adapter,
    };
  }

  // 2. Legacy Eventrix fallback.
  let eventrixSettings: { status: string; is_enabled: boolean } | null = null;
  try {
    eventrixSettings = await fetchEventrix(ctx);
  } catch (err) {
    const native = registry.getDefault();
    return {
      providerType: 'native',
      source: 'native_default',
      status: {
        code: 'available',
        message: canonicalError
          ? 'Falha ao consultar configuração; usando provider nativo.'
          : 'Falha ao consultar configuração Eventrix; usando provider nativo.',
        detail: (canonicalError ?? (err as Error)).message,
      },
      adapter: native,
    };
  }

  const eventrixActive = !!eventrixSettings && eventrixSettings.is_enabled === true;
  if (eventrixActive) {
    const adapter = registry.get('eventrix');
    if (!adapter) {
      const native = registry.getDefault();
      return {
        providerType: 'native',
        source: 'native_default',
        status: {
          code: 'degraded',
          message: 'EventrixInventoryProvider não registrado; fallback nativo.',
        },
        adapter: native,
      };
    }
    return {
      providerType: 'eventrix',
      source: 'legacy_eventrix_settings',
      status: await adapter.getStatus(ctx),
      adapter,
    };
  }

  const native = registry.getDefault();
  return {
    providerType: 'native',
    source: 'native_default',
    status: await native.getStatus(ctx),
    adapter: native,
  };
}
