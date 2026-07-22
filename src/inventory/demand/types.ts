// NOID-VERTICAL-1.0-VERT-01.2D-A
// Tipos genéricos do domínio de Proposal Inventory Demand.
// Não devem conhecer detalhes de qualquer provider específico
// (Eventrix, IMEI, ICCID, SSID, WiFi, tokens, cache tables, etc.).
//
// A compatibilidade com o schema legado `eventrix_*` de
// `product_inventory_requirements` fica confinada ao normalizer
// (src/inventory/demand/normalizeRequirement.ts).
//
// Nenhum builder, componente, hook ou snapshot é migrado nesta fase.
// A migração de builder/snapshot/componentes é responsabilidade da
// sub-sprint VERT-01.2D-B / VERT-01.2D-C.

import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from '@/schemas/productInventoryRequirement';

/**
 * Referência genérica a uma família/categoria de inventário,
 * agnóstica ao provider. Substitui, em runtime, as chaves
 * `eventrix_category_id` / `eventrix_family_id` que ainda
 * persistem nas colunas físicas de `product_inventory_requirements`.
 */
export interface InventoryRequirementReference {
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Requisito de produto já normalizado — pronto para o builder
 * de demanda genérico. Preserva o vínculo com o produto de origem
 * e os parâmetros comerciais (quantity/unit_basis/is_required).
 */
export interface NormalizedProductInventoryRequirement
  extends InventoryRequirementReference {
  requirement_id: string;
  product_id: string;
  label: string;
  quantity: number;
  unit_basis: UnitBasis;
  is_required: boolean;
  notes?: string | null;
  sort_order?: number;
  is_active: boolean;
}

/**
 * Contribuição de um produto (item da proposta) para uma linha
 * agrupada de demanda.
 */
export interface InventoryDemandLineSource {
  product_id: string;
  product_name: string;
  proposal_item_id?: string | null;
  quantity: number;
  required_quantity: number | null;
  calculation_label: string;
}

export type InventoryDemandLineStatus =
  | 'calculated'
  | 'manual'
  | 'incomplete';

/**
 * Linha agrupada de demanda de inventário (uma família x unit_basis).
 * Não expõe nenhum nome específico de provider.
 */
export interface InventoryDemandLine {
  key: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  unit_basis: UnitBasis;
  is_required: boolean;
  required_quantity: number | null;
  requirement_quantity: number;
  calculation_label: string;
  status: InventoryDemandLineStatus;
  source_products: InventoryDemandLineSource[];
}

export interface InventoryDemandCommercialContext {
  points: number | null;
  days: number | null;
  participants: number | null;
}

export interface InventoryDemandEventContext {
  name?: string | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  setup_start?: string | null;
  teardown_end?: string | null;
}

export interface InventoryDemandRequirementPayload {
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  quantity: number | null;
  unit_basis: string;
  is_required: boolean;
  source: {
    product_ids: string[];
    product_names: string[];
  };
}

/**
 * Payload genérico de preview/snapshot. Ainda não é serializado
 * na D-A — o serializer v2 e os aliases legados são responsabilidade
 * da VERT-01.2D-B.
 */
export interface InventoryDemandPayload {
  schema_version: 2;
  source: 'noid';
  mode: 'preview' | 'snapshot';
  provider_type: InventoryProviderType;
  organization_id: string;
  proposal_id: string | null;
  opportunity_id?: string | null;
  customer_id?: string | null;
  event: InventoryDemandEventContext;
  commercial_context: InventoryDemandCommercialContext;
  requirements: InventoryDemandRequirementPayload[];
}

export type InventoryDemandStatus =
  | 'ready'
  | 'empty'
  | 'incomplete'
  | 'unsupported';

export interface InventoryDemandPreview {
  status: InventoryDemandStatus;
  provider_type: InventoryProviderType;
  warnings: string[];
  totals: {
    requiredFamilies: number;
    totalRequiredUnits: number;
    optionalFamilies: number;
  };
  lines: InventoryDemandLine[];
  payload: InventoryDemandPayload;
}

export class InventoryDemandNormalizationError extends Error {
  code:
    | 'missing_category'
    | 'missing_family'
    | 'invalid_quantity'
    | 'invalid_unit_basis'
    | 'missing_product';
  constructor(
    code: InventoryDemandNormalizationError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'InventoryDemandNormalizationError';
    this.code = code;
  }
}
