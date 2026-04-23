// Canonical option lists for account selects.
// Aligned across AccountEditor and AccountModalTabs to avoid casing mismatches
// that make Selects appear empty even when the DB has a saved value.

import { normalizeSegmento } from './segment-normalizer';

// Canonical list for tipo_empresa (matches what is most commonly stored).
export const TIPO_EMPRESA_OPTIONS: string[] = [
  'Lead',
  'Prospect',
  'Cliente',
  'Ex-Cliente',
  'Parceiro',
  'Fornecedor',
];

// Map legacy/lowercase variants to canonical labels.
const TIPO_EMPRESA_ALIAS: Record<string, string> = {
  'lead': 'Lead',
  'prospect': 'Prospect',
  'cliente': 'Cliente',
  'ex-cliente': 'Ex-Cliente',
  'ex cliente': 'Ex-Cliente',
  'parceiro': 'Parceiro',
  'fornecedor': 'Fornecedor',
};

export function normalizeTipoEmpresa(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return TIPO_EMPRESA_ALIAS[key] ?? trimmed;
}

// Canonical list for segmento — values stored as displayed.
export const SEGMENTO_OPTIONS: string[] = [
  'Tecnologia',
  'Varejo',
  'Indústria',
  'Serviços',
  'Saúde',
  'Educação',
  'Financeiro',
  'Construção',
  'Comércio',
  'Marketing',
  'Eventos',
  'Agronegócio',
  'Outro',
];

// Reuse the existing segmento normalizer; just re-export here for convenience.
export { normalizeSegmento };

// Build the union of canonical options + the currently saved value (so the
// Select shows whatever is in the DB even if it's a legacy/custom label).
export function withCurrentValue(options: string[], current: string | null | undefined): string[] {
  if (!current) return options;
  if (options.includes(current)) return options;
  return [current, ...options];
}
