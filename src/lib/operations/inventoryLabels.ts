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

export type InventoryItemStatus =
  | 'available'
  | 'blocked'
  | 'maintenance'
  | 'damaged'
  | 'retired'
  | 'lost';

export const ITEM_STATUS_LABEL: Record<InventoryItemStatus, string> = {
  available: 'Disponível',
  blocked: 'Bloqueado',
  maintenance: 'Em manutenção',
  damaged: 'Danificado',
  retired: 'Baixado',
  lost: 'Perdido',
};

export const ITEM_STATUS_OPTIONS: { value: InventoryItemStatus; label: string }[] = [
  { value: 'available', label: 'Disponível' },
  { value: 'blocked', label: 'Bloqueado' },
  { value: 'maintenance', label: 'Em manutenção' },
  { value: 'damaged', label: 'Danificado' },
  { value: 'retired', label: 'Baixado' },
  { value: 'lost', label: 'Perdido' },
];

export const DESTRUCTIVE_STATUSES: InventoryItemStatus[] = ['retired', 'lost', 'damaged'];

export const STATUS_CONFIRM_TEXT: Partial<Record<InventoryItemStatus, string>> = {
  retired:
    'Deseja baixar este item? Ele deixará de contar como disponível para operação.',
  lost:
    'Deseja marcar este item como perdido? Ele deixará de contar como disponível para operação.',
  damaged:
    'Deseja marcar este item como danificado? Ele deixará de contar como disponível até nova atualização.',
};

export function getQuantityAvailableForStatus(status: InventoryItemStatus): 0 | 1 {
  return status === 'available' ? 1 : 0;
}

export function getStatusBadgeVariant(
  status: InventoryItemStatus,
): 'default' | 'secondary' | 'destructive' {
  if (status === 'available') return 'default';
  if (status === 'maintenance' || status === 'blocked') return 'secondary';
  return 'destructive';
}

export function mapDuplicateError(err: any): string | null {
  const msg = String(err?.message ?? '');
  const code = err?.code;
  if (code !== '23505' && !msg.includes('duplicate')) return null;
  if (msg.includes('uq_inventory_items_asset_code')) {
    return 'Já existe um item com este código patrimonial.';
  }
  if (msg.includes('uq_inventory_items_serial_number')) {
    return 'Já existe um item com este número de série.';
  }
  if (code === '23505') {
    return 'Já existe um item com este código patrimonial ou número de série.';
  }
  return null;
}
