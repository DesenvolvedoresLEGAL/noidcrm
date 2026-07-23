// NOID-VERTICAL-1.0-VERT-01.2E-B1
// Domínio genérico de Product Inventory Requirements.
// Nenhum campo `eventrix_*` deve aparecer aqui — o binding físico
// com as colunas legadas fica confinado a `storageMapper.ts`.

import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from './unitBasis';

export interface InventoryProductRequirement {
  id: string;
  organization_id: string;
  product_id: string;
  label: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  quantity: number;
  unit_basis: UnitBasis;
  is_required: boolean;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryProductRequirementInput {
  label: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind?: string | null;
  quantity: number;
  unit_basis: UnitBasis;
  is_required?: boolean;
  notes?: string | null;
  sort_order?: number;
  is_active?: boolean;
  /** Merge parcial em `metadata` já persistida. Nunca substitui integralmente. */
  metadata?: Record<string, unknown>;
}

/** Chave canônica em `metadata` que identifica o provider de origem/destino. */
export const INVENTORY_PROVIDER_METADATA_KEY = 'inventory_provider_type' as const;

export class InventoryRequirementProviderNotSupportedError extends Error {
  provider: string;
  constructor(provider: string) {
    super(
      'O provider informado ainda não possui contrato de persistência para requisitos de produto.',
    );
    this.name = 'InventoryRequirementProviderNotSupportedError';
    this.provider = provider;
  }
}

export class InventoryRequirementMetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRequirementMetadataError';
  }
}
