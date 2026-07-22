// NOID-VERTICAL-1.0-VERT-01.2A
// Fallback nativo. NÃO presume disponibilidade, NÃO inventa estoque.
// É seguro chamar sem integração externa configurada.
import type { InventoryProviderAdapter } from './InventoryProviderAdapter';
import type {
  InventoryAvailabilityRequest,
  InventoryAvailabilityResult,
  InventoryCategory,
  InventoryFamily,
  InventoryItem,
  InventoryProductRequirement,
  InventoryProviderCapability,
  InventoryProviderContext,
  InventoryProviderStatus,
  InventoryRequirementsValidation,
} from './types';

const CAPS: InventoryProviderCapability[] = [];

export class NativeInventoryProvider implements InventoryProviderAdapter {
  getType() {
    return 'native' as const;
  }
  getDisplayName() {
    return 'Inventário Nativo';
  }
  getCapabilities() {
    return [...CAPS];
  }
  hasCapability(cap: InventoryProviderCapability) {
    return CAPS.includes(cap);
  }

  async getStatus(_ctx: InventoryProviderContext): Promise<InventoryProviderStatus> {
    return {
      code: 'available',
      message: 'Provider nativo ativo. Integração de inventário externo não configurada.',
    };
  }

  async listCategories(_ctx: InventoryProviderContext): Promise<InventoryCategory[]> {
    return [];
  }
  async listFamilies(
    _ctx: InventoryProviderContext,
    _categoryId?: string | null,
  ): Promise<InventoryFamily[]> {
    return [];
  }
  async listItems(_ctx: InventoryProviderContext): Promise<InventoryItem[]> {
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
      message: 'Provider nativo não suporta consulta de disponibilidade.',
    };
  }

  async validateProductRequirements(
    _ctx: InventoryProviderContext,
    requirements: InventoryProductRequirement[],
  ): Promise<InventoryRequirementsValidation> {
    return {
      valid: true,
      issues: requirements.map((_, index) => ({
        index,
        code: 'not_supported' as const,
        message: 'Provider nativo não valida requisitos de inventário.',
      })),
    };
  }
}
