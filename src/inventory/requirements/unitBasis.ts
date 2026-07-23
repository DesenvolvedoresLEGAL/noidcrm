// NOID-VERTICAL-1.0-VERT-01.2E-B1.1
// Fonte canônica genérica de UnitBasis para o domínio de inventário.
// Nunca deve depender de schemas legados (`@/schemas/*`).

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

/**
 * Rótulos neutros por tipo de item de inventário. O conjunto de chaves
 * permanece aberto porque `item_kind` é livremente definido pelo provider
 * ativo (Eventrix hoje: serialized/quantity).
 */
export const ITEM_KIND_LABELS: Record<string, string> = {
  serialized: 'Serializado',
  quantity: 'Por quantidade',
};

