// NOID-VERTICAL-1.0-VERT-01.2A
// Tipos genéricos de inventário. Neutros a qualquer provider externo.
// Detalhes específicos de conectividade (IMEI/ICCID/SSID/WiFi) NÃO pertencem
// a este contrato — devem viver em `metadata` do adapter Eventrix até a
// sprint do Pack Conectividade.

export type InventoryProviderType = 'native' | 'eventrix';

export type InventoryProviderCapability =
  | 'categories'
  | 'families'
  | 'items'
  | 'availability'
  | 'reservations'
  | 'kits'
  | 'serialized_items'
  | 'quantity_items'
  | 'product_requirements'
  | 'proposal_demand';

export type InventoryProviderStatusCode =
  | 'available'
  | 'not_configured'
  | 'unavailable'
  | 'degraded'
  | 'unauthorized'
  | 'error';

export interface InventoryProviderStatus {
  code: InventoryProviderStatusCode;
  message?: string;
  detail?: string;
}

export interface InventoryProviderContext {
  organizationId: string;
  userId?: string | null;
}

export interface InventoryCategory {
  id: string;
  externalId?: string | null;
  name: string;
  description?: string | null;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface InventoryFamily {
  id: string;
  externalId?: string | null;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  active: boolean;
  itemKind?: string | null;
  metadata?: Record<string, unknown>;
}

export interface InventoryItem {
  id: string;
  externalId?: string | null;
  categoryId?: string | null;
  familyId?: string | null;
  name: string;
  sku?: string | null;
  serialized: boolean;
  active: boolean;
  availability?: InventoryItemAvailability | null;
  metadata?: Record<string, unknown>;
}

export interface InventoryItemAvailability {
  supported: boolean;
  totalUnits?: number;
  availableUnits?: number;
  reservedUnits?: number;
  windowStart?: string;
  windowEnd?: string;
}

export interface InventoryItemFilters {
  categoryId?: string | null;
  familyId?: string | null;
  search?: string | null;
  activeOnly?: boolean;
}

export interface InventoryAvailabilityRequest {
  windowStart?: string;
  windowEnd?: string;
  items: Array<{
    categoryId?: string | null;
    familyId?: string | null;
    itemId?: string | null;
    quantity: number;
  }>;
}

export type AvailabilityResultCode =
  | 'ok'
  | 'insufficient'
  | 'partial'
  | 'not_supported'
  | 'error';

export interface InventoryAvailabilityResult {
  code: AvailabilityResultCode;
  message?: string;
  lines?: Array<{
    requested: number;
    available?: number;
    status: 'ok' | 'insufficient' | 'unknown';
  }>;
}

export interface InventoryProductRequirement {
  label: string;
  categoryId?: string | null;
  familyId?: string | null;
  quantity: number;
}

export interface InventoryRequirementsValidation {
  valid: boolean;
  issues: Array<{
    index: number;
    code: 'missing_category' | 'missing_family' | 'unknown_category' | 'unknown_family' | 'not_supported';
    message: string;
  }>;
}

export class InventoryProviderError extends Error {
  code: InventoryProviderStatusCode;
  cause?: unknown;
  constructor(code: InventoryProviderStatusCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'InventoryProviderError';
    this.code = code;
    this.cause = cause;
  }
}
