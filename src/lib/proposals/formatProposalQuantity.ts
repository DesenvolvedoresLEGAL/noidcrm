/**
 * Helper centralizado para formatar a quantidade exibida em propostas.
 *
 * Regras:
 *  - Se houver unidade, exibir "quantity unit" (ex: "4 h", "3 dias", "10 conexões").
 *  - Se a unidade for vazia/null/undefined, exibir apenas a quantidade.
 *  - Nunca altera cálculo: é estritamente apresentação.
 *
 * Aceita várias formas em que a unidade pode aparecer (já normaliza):
 *   - item.measurement_unit?.abbreviation
 *   - item.measurement_unit?.name
 *   - item.unit (string solta — fallback legado)
 */
export type ProposalQuantityUnitInput =
  | string
  | null
  | undefined
  | {
      abbreviation?: string | null;
      name?: string | null;
    };

export function resolveUnitLabel(unit: ProposalQuantityUnitInput): string {
  if (!unit) return '';
  if (typeof unit === 'string') return unit.trim();
  const abbr = (unit.abbreviation || '').trim();
  if (abbr) return abbr;
  const name = (unit.name || '').trim();
  return name;
}

export function formatProposalQuantity(
  quantity: number | string | null | undefined,
  unit: ProposalQuantityUnitInput,
): string {
  const qty = quantity == null || quantity === '' ? '' : String(quantity);
  const label = resolveUnitLabel(unit);
  if (!qty) return label;
  if (!label) return qty;
  return `${qty} ${label}`;
}
