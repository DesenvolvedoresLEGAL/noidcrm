/**
 * @deprecated compatibility schema (VERT-01.2E-B1 / hardened em B1.1).
 * Substituto genérico: `@/inventory/requirements/schema`
 * (`inventoryProductRequirementSchema`). Mantido enquanto o
 * ProductInventoryRequirementsEditor ainda opera com chaves `eventrix_*`.
 *
 * UnitBasis canônico vive em `@/inventory/requirements/unitBasis`; este
 * arquivo apenas re-exporta para preservar consumers legados.
 */
import { z } from 'zod';
import {
  UNIT_BASIS_LABELS,
  UNIT_BASIS_VALUES,
  type UnitBasis,
} from '@/inventory/requirements/unitBasis';

export { UNIT_BASIS_VALUES, UNIT_BASIS_LABELS };
export type { UnitBasis };

export const ITEM_KIND_LABELS: Record<string, string> = {
  serialized: 'Serializado',
  quantity: 'Por quantidade',
};

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
