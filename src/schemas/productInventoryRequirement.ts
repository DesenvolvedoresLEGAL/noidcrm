/**
 * @deprecated compatibility schema (VERT-01.2E-B1 → B2B).
 * Substituto genérico: `@/inventory/requirements/schema`
 * (`inventoryProductRequirementSchema`).
 *
 * Estado após VERT-01.2E-B2B:
 * - ProductInventoryRequirementsEditor já migrado para a façade genérica (B2A).
 * - Proposal Inventory Demand já migrado para a façade genérica (B2B).
 * - Este arquivo permanece EXCLUSIVAMENTE como compatibility bridge, enquanto
 *   as colunas físicas `eventrix_*` continuarem existindo em
 *   `product_inventory_requirements`. NÃO criar novos consumers.
 *
 * UnitBasis / UNIT_BASIS_* / ITEM_KIND_LABELS canônicos vivem em
 * `@/inventory/requirements/unitBasis`; este módulo apenas re-exporta.
 */

import { z } from 'zod';
import {
  UNIT_BASIS_LABELS,
  UNIT_BASIS_VALUES,
  type UnitBasis,
} from '@/inventory/requirements/unitBasis';

export { UNIT_BASIS_VALUES, UNIT_BASIS_LABELS };
export type { UnitBasis };

export { ITEM_KIND_LABELS } from '@/inventory/requirements/unitBasis';


export const productInventoryRequirementSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Informe um rótulo com pelo menos 2 caracteres.')
    .max(100, 'Rótulo deve ter no máximo 100 caracteres.'),
  eventrix_category_id: z.string().min(1, 'Selecione uma categoria.'),
  eventrix_category_name: z.string().min(1),
  eventrix_family_id: z.string().min(1, 'Selecione uma família.'),
  eventrix_family_name: z.string().min(1),
  eventrix_item_kind: z.string().optional().nullable(),
  quantity: z.coerce.number().positive('Informe uma quantidade maior que zero.'),
  unit_basis: z.enum(UNIT_BASIS_VALUES),
  is_required: z.boolean().default(true),
  notes: z.string().max(300, 'Máximo 300 caracteres.').optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
});

export type ProductInventoryRequirementInput = z.infer<
  typeof productInventoryRequirementSchema
>;
