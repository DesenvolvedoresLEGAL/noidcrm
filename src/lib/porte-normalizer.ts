// Centralizes porte (company size) normalization to avoid UI duplicates from legacy data.
// Canonical values: MEI, ME, EPP, Médio Porte, Grande Porte

export type CanonicalPorte = 'MEI' | 'ME' | 'EPP' | 'Médio Porte' | 'Grande Porte';

const ALIAS_MAP: Record<string, CanonicalPorte> = {
  // MEI
  'MEI': 'MEI',
  'MICROEMPREENDEDOR INDIVIDUAL': 'MEI',
  'MICRO EMPREENDEDOR INDIVIDUAL': 'MEI',

  // ME
  'ME': 'ME',
  'MICRO': 'ME',
  'MICROEMPRESA': 'ME',
  'MICRO EMPRESA': 'ME',

  // EPP
  'EPP': 'EPP',
  'PEQUENO': 'EPP',
  'PEQUENO PORTE': 'EPP',
  'PEQUENA': 'EPP',
  'EMPRESA DE PEQUENO PORTE': 'EPP',

  // Médio Porte
  'MEDIO': 'Médio Porte',
  'MÉDIO': 'Médio Porte',
  'MEDIA': 'Médio Porte',
  'MÉDIA': 'Médio Porte',
  'MEDIO PORTE': 'Médio Porte',
  'MÉDIO PORTE': 'Médio Porte',
  'EMPRESA DE MEDIO PORTE': 'Médio Porte',
  'EMPRESA DE MÉDIO PORTE': 'Médio Porte',

  // Grande Porte
  'GRANDE': 'Grande Porte',
  'GRANDE PORTE': 'Grande Porte',
  'EMPRESA DE GRANDE PORTE': 'Grande Porte',
  'DEMAIS': 'Grande Porte',
};

export function normalizePorte(value: string | null | undefined): CanonicalPorte | null {
  if (!value) return null;
  const key = value.trim().toUpperCase();
  if (!key) return null;
  return ALIAS_MAP[key] ?? null;
}

export const CANONICAL_PORTES: CanonicalPorte[] = ['MEI', 'ME', 'EPP', 'Médio Porte', 'Grande Porte'];
