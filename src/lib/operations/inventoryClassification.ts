// Sprint INV 0.8 — Classificação operacional dos itens

export type OperationalType =
  | 'equipment'
  | 'accessory'
  | 'part'
  | 'consumable'
  | 'logical_kit'
  | 'infrastructure'
  | 'tool'
  | 'other';

export type Criticality = 'low' | 'medium' | 'high' | 'critical';

export const OPERATIONAL_TYPE_LABELS: Record<OperationalType, string> = {
  equipment: 'Equipamento',
  accessory: 'Acessório',
  part: 'Peça',
  consumable: 'Material de consumo',
  logical_kit: 'Kit lógico',
  infrastructure: 'Infraestrutura',
  tool: 'Ferramenta',
  other: 'Outro',
};

export const OPERATIONAL_TYPE_OPTIONS: { value: OperationalType; label: string }[] = (
  Object.keys(OPERATIONAL_TYPE_LABELS) as OperationalType[]
).map((value) => ({ value, label: OPERATIONAL_TYPE_LABELS[value] }));

export const CRITICALITY_LABELS: Record<Criticality, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const CRITICALITY_OPTIONS: { value: Criticality; label: string }[] = (
  Object.keys(CRITICALITY_LABELS) as Criticality[]
).map((value) => ({ value, label: CRITICALITY_LABELS[value] }));

export function criticalityBadgeVariant(
  c: Criticality,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (c) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    case 'low':
    default:
      return 'outline';
  }
}

export function normalizeSlug(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
