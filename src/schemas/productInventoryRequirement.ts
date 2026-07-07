import { z } from 'zod';

export const UNIT_BASIS_VALUES = [
  'per_point',
  'per_event',
  'per_day',
  'per_participant',
  'per_unit',
  'manual',
] as const;

export type UnitBasis = (typeof UNIT_BASIS_VALUES)[number];

export const UNIT_BASIS_LABELS: Record<UnitBasis, string> = {
  per_point: 'Por ponto',
  per_event: 'Por evento',
  per_day: 'Por diária',
  per_participant: 'Por participante',
  per_unit: 'Por unidade',
  manual: 'Manual',
};

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
