// NOID-VERTICAL-1.0-VERT-01.2A
// Encapsula o consumo atual da integração Eventrix.
// Termos e schemas específicos do Eventrix devem ficar confinados a este arquivo.
import { supabase } from '@/integrations/supabase/client';
import type { InventoryProviderAdapter } from './InventoryProviderAdapter';
import {
  InventoryProviderError,
  type InventoryAvailabilityRequest,
  type InventoryAvailabilityResult,
  type InventoryCategory,
  type InventoryFamily,
  type InventoryItem,
  type InventoryItemFilters,
  type InventoryProductRequirement,
  type InventoryProviderCapability,
  type InventoryProviderContext,
  type InventoryProviderStatus,
  type InventoryRequirementsValidation,
} from './types';

interface EventrixCacheRow {
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
  payload: Record<string, unknown> | null;
  synced_at: string | null;
}

// NOID-VERTICAL-1.0-VERT-01.2D-A
// `proposal_demand` é declarado porque o cálculo de demanda de
// propostas depende apenas de referências (categoria/família) que
// já estão modeladas nos requisitos do produto — nenhum call
// externo adicional é necessário. A lógica comercial permanece no
// domínio genérico (`src/inventory/demand`) e NÃO é movida para
// dentro do adapter nesta fase.
const CAPS: InventoryProviderCapability[] = [
  'categories',
  'families',
  'product_requirements',
  'proposal_demand',
];

export interface EventrixProviderDeps {
  fetchSettings?: (
    ctx: InventoryProviderContext,
  ) => Promise<{ status: string; is_enabled: boolean } | null>;
  fetchCache?: (ctx: InventoryProviderContext) => Promise<EventrixCacheRow[]>;
}

export class EventrixInventoryProvider implements InventoryProviderAdapter {
  constructor(private deps: EventrixProviderDeps = {}) {}

  getType() {
    return 'eventrix' as const;
  }
  getDisplayName() {
    return 'Eventrix';
  }
  getCapabilities() {
    return [...CAPS];
  }
  hasCapability(cap: InventoryProviderCapability) {
    return CAPS.includes(cap);
  }

  private async fetchSettings(ctx: InventoryProviderContext) {
    if (this.deps.fetchSettings) return this.deps.fetchSettings(ctx);
    const { data, error } = await (supabase as any)
      .from('eventrix_inventory_integration_settings')
      .select('status,is_enabled')
      .eq('organization_id', ctx.organizationId)
      .maybeSingle();
    if (error) throw new InventoryProviderError('error', error.message, error);
    return data as { status: string; is_enabled: boolean } | null;
  }

  private async fetchCache(ctx: InventoryProviderContext): Promise<EventrixCacheRow[]> {
    if (this.deps.fetchCache) return this.deps.fetchCache(ctx);
    const { data, error } = await (supabase as any)
      .from('eventrix_inventory_sync_cache')
      .select('*')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw new InventoryProviderError('error', error.message, error);
    return (data ?? []) as EventrixCacheRow[];
  }

  async getStatus(ctx: InventoryProviderContext): Promise<InventoryProviderStatus> {
    try {
      const s = await this.fetchSettings(ctx);
      if (!s) return { code: 'not_configured', message: 'Integração Eventrix não configurada.' };
      if (!s.is_enabled) return { code: 'unavailable', message: 'Integração Eventrix desabilitada.' };
      if (s.status === 'error') return { code: 'error', message: 'Integração Eventrix em erro.' };
      if (s.status === 'not_configured') return { code: 'not_configured' };
      return { code: 'available' };
    } catch (err) {
      if (err instanceof InventoryProviderError) return { code: err.code, message: err.message };
      return { code: 'error', message: (err as Error).message };
    }
  }

  private normalizeCategory = (r: EventrixCacheRow): InventoryCategory => ({
    id: r.eventrix_entity_id,
    externalId: r.eventrix_entity_id,
    name: r.name,
    description: r.description,
    active: r.is_active,
    metadata: { control_mode: r.control_mode, synced_at: r.synced_at },
  });

  private normalizeFamily = (r: EventrixCacheRow): InventoryFamily => ({
    id: r.eventrix_entity_id,
    externalId: r.eventrix_entity_id,
    categoryId: r.parent_eventrix_entity_id,
    name: r.name,
    description: r.description,
    active: r.is_active,
    itemKind: r.item_kind,
    metadata: { synced_at: r.synced_at },
  });

  async listCategories(ctx: InventoryProviderContext): Promise<InventoryCategory[]> {
    const rows = await this.fetchCache(ctx);
    return rows.filter((r) => r.entity_type === 'category').map(this.normalizeCategory);
  }

  async listFamilies(
    ctx: InventoryProviderContext,
    categoryId?: string | null,
  ): Promise<InventoryFamily[]> {
    const rows = await this.fetchCache(ctx);
    const all = rows.filter((r) => r.entity_type === 'family').map(this.normalizeFamily);
    if (!categoryId) return all;
    return all.filter((f) => f.categoryId === categoryId);
  }

  async listItems(
    _ctx: InventoryProviderContext,
    _filters?: InventoryItemFilters,
  ): Promise<InventoryItem[]> {
    // Não exposto pela integração atual; a leitura fina de itens continua
    // dentro dos hooks legados até a próxima sprint.
    return [];
  }

  async getItem(): Promise<InventoryItem | null> {
    return null;
  }

  async checkAvailability(
    _ctx: InventoryProviderContext,
    _request: InventoryAvailabilityRequest,
  ): Promise<InventoryAvailabilityResult> {
    return {
      code: 'not_supported',
      message: 'Consulta de disponibilidade não exposta pelo adapter Eventrix nesta sprint.',
    };
  }

  async validateProductRequirements(
    ctx: InventoryProviderContext,
    requirements: InventoryProductRequirement[],
  ): Promise<InventoryRequirementsValidation> {
    const rows = await this.fetchCache(ctx);
    const cats = new Set(
      rows.filter((r) => r.entity_type === 'category').map((r) => r.eventrix_entity_id),
    );
    const fams = new Set(
      rows.filter((r) => r.entity_type === 'family').map((r) => r.eventrix_entity_id),
    );
    const issues: InventoryRequirementsValidation['issues'] = [];
    requirements.forEach((req, index) => {
      if (!req.categoryId) issues.push({ index, code: 'missing_category', message: 'Categoria obrigatória.' });
      else if (!cats.has(req.categoryId)) issues.push({ index, code: 'unknown_category', message: 'Categoria desconhecida.' });
      if (!req.familyId) issues.push({ index, code: 'missing_family', message: 'Família obrigatória.' });
      else if (!fams.has(req.familyId)) issues.push({ index, code: 'unknown_family', message: 'Família desconhecida.' });
    });
    return { valid: issues.length === 0, issues };
  }
}
