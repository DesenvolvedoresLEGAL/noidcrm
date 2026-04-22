// Centralizes segment normalization to avoid UI duplicates from legacy data.
// Mirrors the DB trigger `normalize_account_segmento`.

const ALIAS_MAP: Record<string, string> = {
  'servicos': 'Serviços',
  'serviços': 'Serviços',
  'servico': 'Serviços',
  'serviço': 'Serviços',
  'tecnologia': 'Tecnologia',
  'tech': 'Tecnologia',
  'ti': 'Tecnologia',
  'industria': 'Indústria',
  'indústria': 'Indústria',
  'industrias': 'Indústria',
  'indústrias': 'Indústria',
  'outro': 'Outro',
  'outros': 'Outro',
  'saude': 'Saúde',
  'saúde': 'Saúde',
  'comercio': 'Comércio',
  'comércio': 'Comércio',
  'educacao': 'Educação',
  'educação': 'Educação',
  'construcao': 'Construção',
  'construção': 'Construção',
  'varejo': 'Varejo',
  'eventos': 'Eventos',
  'evento': 'Eventos',
  'marketing': 'Marketing',
  'mkt': 'Marketing',
  'financeiro': 'Financeiro',
  'finance': 'Financeiro',
  'financas': 'Financeiro',
  'finanças': 'Financeiro',
};

function initcap(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function normalizeSegmento(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return ALIAS_MAP[key] ?? initcap(trimmed);
}

export function uniqueNormalizedSegments(
  values: (string | null | undefined)[]
): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const norm = normalizeSegmento(v);
    if (norm) set.add(norm);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
