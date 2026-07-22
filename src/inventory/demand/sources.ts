// NOID-VERTICAL-1.0-VERT-01.2D-B
// Extrai source products e source requirements a partir de um preview
// genérico. Ambas as funções são puras e não conhecem detalhes Eventrix.
import type { InventoryProviderType } from '@/inventory/providers/types';
import type {
  InventoryDemandInputItem,
} from './buildInventoryDemandPreview';
import type {
  InventoryDemandPreview,
  NormalizedProductInventoryRequirement,
} from './types';

export interface InventoryDemandSourceProduct {
  product_id: string;
  product_name: string;
  proposal_item_id: string | null;
  quantity: number;
}

export interface InventoryDemandSourceRequirement {
  requirement_id: string;
  product_id: string;
  label: string;
  provider_type: InventoryProviderType;
  category_ref: string;
  category_name: string;
  family_ref: string;
  family_name: string;
  item_kind: string | null;
  quantity: number;
  unit_basis: string;
  is_required: boolean;
}

function itemQty(it: InventoryDemandInputItem): number {
  const v =
    Number(it.quantity ?? it.product_quantity ?? it.item_quantity ?? 1) || 1;
  return v > 0 ? v : 1;
}

export function buildInventoryDemandSourceProducts(
  preview: InventoryDemandPreview,
  proposalItems: InventoryDemandInputItem[],
): InventoryDemandSourceProduct[] {
  const productIds = new Set<string>();
  for (const line of preview.lines ?? []) {
    for (const s of line.source_products ?? []) {
      if (s.product_id) productIds.add(s.product_id);
    }
  }
  const byId = new Map<string, InventoryDemandInputItem>();
  for (const it of proposalItems ?? []) {
    if (it.product_id && productIds.has(it.product_id) && !byId.has(it.product_id)) {
      byId.set(it.product_id, it);
    }
  }
  return Array.from(productIds).map((pid) => {
    const it = byId.get(pid);
    return {
      product_id: pid,
      product_name: it?.name ?? 'Produto',
      proposal_item_id: it?.id ?? null,
      quantity: it ? itemQty(it) : 1,
    };
  });
}

export function buildInventoryDemandSourceRequirements(
  preview: InventoryDemandPreview,
  requirements: NormalizedProductInventoryRequirement[],
): InventoryDemandSourceRequirement[] {
  const usedProductIds = new Set<string>();
  const usedKeys = new Set<string>();
  for (const line of preview.lines ?? []) {
    for (const s of line.source_products ?? []) {
      if (s.product_id) usedProductIds.add(s.product_id);
    }
    usedKeys.add(
      `${line.provider_type}|${line.category_ref}|${line.family_ref}|${line.unit_basis}`,
    );
  }
  return (requirements ?? [])
    .filter(
      (r) =>
        r.is_active &&
        usedProductIds.has(r.product_id) &&
        usedKeys.has(
          `${r.provider_type}|${r.category_ref}|${r.family_ref}|${r.unit_basis}`,
        ),
    )
    .map((r) => ({
      requirement_id: r.requirement_id,
      product_id: r.product_id,
      label: r.label,
      provider_type: r.provider_type,
      category_ref: r.category_ref,
      category_name: r.category_name,
      family_ref: r.family_ref,
      family_name: r.family_name,
      item_kind: r.item_kind,
      quantity: Number(r.quantity),
      unit_basis: r.unit_basis,
      is_required: r.is_required,
    }));
}
