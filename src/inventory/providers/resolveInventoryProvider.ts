// NOID-VERTICAL-1.0-VERT-01.2A
// Resolver transitório: usa exclusivamente a configuração Eventrix
// existente (`eventrix_inventory_integration_settings`) para decidir.
// Estratégia definitiva será implementada em VERT-01.2B com
// `inventory_provider_settings` explícita.
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
  | 'legacy_eventrix_settings'
  | 'native_default';

export interface InventoryProviderResolution {
  providerType: InventoryProviderType;
  source: InventoryProviderResolutionSource;
  status: InventoryProviderStatus;
  adapter: InventoryProviderAdapter;
}

export interface ResolveOptions {
  registry?: InventoryProviderRegistry;
  fetchEventrixSettings?: (
    ctx: InventoryProviderContext,
  ) => Promise<{ status: string; is_enabled: boolean } | null>;
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

export async function resolveInventoryProvider(
  ctx: InventoryProviderContext,
  opts: ResolveOptions = {},
): Promise<InventoryProviderResolution> {
  const registry = opts.registry ?? getDefaultInventoryProviderRegistry();
  const fetchEventrix = opts.fetchEventrixSettings ?? defaultFetchEventrixSettings;

  let eventrixSettings: { status: string; is_enabled: boolean } | null = null;
  try {
    eventrixSettings = await fetchEventrix(ctx);
  } catch (err) {
    // Falha ao consultar settings NÃO deve derrubar o CRM. Cai para native.
    const native = registry.getDefault();
    return {
      providerType: 'native',
      source: 'native_default',
      status: {
        code: 'available',
        message: 'Falha ao consultar configuração Eventrix; usando provider nativo.',
        detail: (err as Error).message,
      },
      adapter: native,
    };
  }

  const eventrixActive =
    !!eventrixSettings && eventrixSettings.is_enabled === true;

  if (eventrixActive) {
    const adapter = registry.get('eventrix');
    if (!adapter) {
      // Registro inconsistente: não fingir que Eventrix está OK.
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
    const status = await adapter.getStatus(ctx);
    return {
      providerType: 'eventrix',
      source: 'legacy_eventrix_settings',
      status,
      adapter,
    };
  }

  const native = registry.getDefault();
  const status = await native.getStatus(ctx);
  return {
    providerType: 'native',
    source: 'native_default',
    status,
    adapter: native,
  };
}
