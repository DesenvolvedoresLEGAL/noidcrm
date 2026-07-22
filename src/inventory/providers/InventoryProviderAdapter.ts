// NOID-VERTICAL-1.0-VERT-01.2A
import type {
  InventoryAvailabilityRequest,
  InventoryAvailabilityResult,
  InventoryCategory,
  InventoryFamily,
  InventoryItem,
  InventoryItemFilters,
  InventoryProductRequirement,
  InventoryProviderCapability,
  InventoryProviderContext,
  InventoryProviderStatus,
  InventoryProviderType,
  InventoryRequirementsValidation,
} from './types';

export interface InventoryProviderAdapter {
  getType(): InventoryProviderType;
  getDisplayName(): string;
  getCapabilities(): InventoryProviderCapability[];
  hasCapability(cap: InventoryProviderCapability): boolean;

  getStatus(ctx: InventoryProviderContext): Promise<InventoryProviderStatus>;

  listCategories(ctx: InventoryProviderContext): Promise<InventoryCategory[]>;
  listFamilies(
    ctx: InventoryProviderContext,
    categoryId?: string | null,
  ): Promise<InventoryFamily[]>;
  listItems(
    ctx: InventoryProviderContext,
    filters?: InventoryItemFilters,
  ): Promise<InventoryItem[]>;
  getItem(
    ctx: InventoryProviderContext,
    itemId: string,
  ): Promise<InventoryItem | null>;

  checkAvailability(
    ctx: InventoryProviderContext,
    request: InventoryAvailabilityRequest,
  ): Promise<InventoryAvailabilityResult>;

  validateProductRequirements(
    ctx: InventoryProviderContext,
    requirements: InventoryProductRequirement[],
  ): Promise<InventoryRequirementsValidation>;
}
