// NOID-VERTICAL-1.0-VERT-01.2E-B1
// Schema Zod genérico. Nunca expõe chaves `eventrix_*`.
import { z } from 'zod';
import { UNIT_BASIS_VALUES } from '@/schemas/productInventoryRequirement';

const PROVIDER_TYPES = ['native', 'eventrix'] as const;

export const inventoryProductRequirementSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'Informe um rótulo com pelo menos 2 caracteres.')
    .max(100, 'Rótulo deve ter no máximo 100 caracteres.'),
  provider_type: z.enum(PROVIDER_TYPES),
  category_ref: z.string().min(1, 'Selecione uma categoria.'),
  category_name: z.string().min(1),
  family_ref: z.string().min(1, 'Selecione uma família.'),
  family_name: z.string().min(1),
  item_kind: z.string().optional().nullable(),
  quantity: z.coerce.number().positive('Informe uma quantidade maior que zero.'),
  unit_basis: z.enum(UNIT_BASIS_VALUES),
  is_required: z.boolean().default(true),
  notes: z.string().max(300, 'Máximo 300 caracteres.').optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export type InventoryProductRequirementSchemaInput = z.infer<
  typeof inventoryProductRequirementSchema
>;
