export const ITEM_KIND_LABEL: Record<string, string> = {
  serialized: 'Serializado',
  quantity: 'Por quantidade',
};

export const ITEM_KIND_OPTIONS = [
  { value: 'serialized', label: 'Serializado' },
  { value: 'quantity', label: 'Por quantidade' },
] as const;

export const LOCATION_TYPE_LABEL: Record<string, string> = {
  internal: 'Interno',
  external: 'Externo',
  maintenance: 'Manutenção',
  event: 'Evento',
  technician: 'Técnico',
  lost: 'Perdido',
  retired: 'Baixado',
  other: 'Outro',
};

export const LOCATION_TYPE_OPTIONS = [
  { value: 'internal', label: 'Interno' },
  { value: 'external', label: 'Externo' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'event', label: 'Evento' },
  { value: 'technician', label: 'Técnico' },
  { value: 'lost', label: 'Perdido' },
  { value: 'retired', label: 'Baixado' },
  { value: 'other', label: 'Outro' },
] as const;
