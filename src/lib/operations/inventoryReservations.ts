import { z } from 'zod';

export const RESERVATION_STATUSES = [
  'confirmed',
  'in_preparation',
  'dispatched',
  'in_operation',
  'returned',
  'closed',
  'cancelled',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type ReservationRiskLevel = (typeof RESERVATION_RISK_LEVELS)[number];

export const RESERVATION_SOURCES = [
  'pre_reservation',
  'proposal',
  'manual',
  'agent',
  'import',
] as const;
export type ReservationSource = (typeof RESERVATION_SOURCES)[number];

export const RESERVATION_CONFIRMATION_TRIGGERS = [
  'proposal_approved',
  'payment_confirmed',
  'manual',
  'agent',
] as const;
export type ReservationConfirmationTrigger =
  (typeof RESERVATION_CONFIRMATION_TRIGGERS)[number];

export const RESERVATION_ITEM_TYPES = [
  'serialized',
  'quantity',
  'category_family_demand',
  'service_no_stock',
] as const;
export type ReservationItemType = (typeof RESERVATION_ITEM_TYPES)[number];

export const RESERVATION_ITEM_STATUSES = [
  'reserved',
  'partial',
  'unavailable',
  'no_stock_control',
  'cancelled',
] as const;
export type ReservationItemStatus = (typeof RESERVATION_ITEM_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  confirmed: 'Confirmada',
  in_preparation: 'Em preparação',
  dispatched: 'Despachada',
  in_operation: 'Em operação',
  returned: 'Retornada',
  closed: 'Encerrada',
  cancelled: 'Cancelada',
};

export const RESERVATION_RISK_LABELS: Record<ReservationRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

export const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  pre_reservation: 'Pré reserva',
  proposal: 'Proposta',
  manual: 'Manual',
  agent: 'Agente IA',
  import: 'Importação',
};

export const RESERVATION_ITEM_TYPE_LABELS: Record<ReservationItemType, string> = {
  serialized: 'Serializado',
  quantity: 'Quantidade',
  category_family_demand: 'Demanda',
  service_no_stock: 'Serviço',
};

export const RESERVATION_ITEM_STATUS_LABELS: Record<ReservationItemStatus, string> = {
  reserved: 'Reservado',
  partial: 'Parcial',
  unavailable: 'Indisponível',
  no_stock_control: 'Sem controle',
  cancelled: 'Cancelado',
};

export function reservationStatusBadgeVariant(
  s: ReservationStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'confirmed':
      return 'default';
    case 'in_preparation':
    case 'dispatched':
    case 'in_operation':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    case 'returned':
    case 'closed':
      return 'outline';
    default:
      return 'outline';
  }
}

export function reservationRiskBadgeVariant(
  r: ReservationRiskLevel,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (r) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function reservationItemStatusBadgeVariant(
  s: ReservationItemStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'reserved':
      return 'default';
    case 'partial':
      return 'secondary';
    case 'unavailable':
    case 'cancelled':
      return 'destructive';
    case 'no_stock_control':
      return 'outline';
    default:
      return 'outline';
  }
}

// Allowed status transitions
export const RESERVATION_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  confirmed: ['in_preparation', 'cancelled'],
  in_preparation: ['dispatched', 'cancelled'],
  dispatched: ['in_operation'],
  in_operation: ['returned'],
  returned: ['closed'],
  closed: [],
  cancelled: [],
};

export function canTransitionReservation(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return RESERVATION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const inventoryReservationSchema = z
  .object({
    pre_reservation_id: z.string().uuid().optional().nullable(),
    proposal_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    account_id: z.string().uuid().optional().nullable(),
    contact_id: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2, 'Título obrigatório'),
    source: z.enum(RESERVATION_SOURCES).default('pre_reservation'),
    operational_start_date: z.string().min(1),
    operational_end_date: z.string().min(1),
    event_start_date: z.string().optional().nullable(),
    event_end_date: z.string().optional().nullable(),
    status: z.enum(RESERVATION_STATUSES).default('confirmed'),
    risk_level: z.enum(RESERVATION_RISK_LEVELS).default('low'),
    confirmation_trigger: z.enum(RESERVATION_CONFIRMATION_TRIGGERS).default('manual'),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      new Date(data.operational_end_date) >= new Date(data.operational_start_date),
    {
      message: 'Fim operacional não pode ser anterior ao início.',
      path: ['operational_end_date'],
    },
  );

export const inventoryReservationStatusUpdateSchema = z.object({
  status: z.enum(RESERVATION_STATUSES),
});

// ---------- INV 1.2: Operational flow ----------

export const ALLOCATION_OPERATIONAL_STATUSES = [
  'pending',
  'prepared',
  'dispatched',
  'in_operation',
  'returned',
  'released',
  'damaged',
  'lost',
  'maintenance',
  'cancelled',
] as const;
export type AllocationOperationalStatus =
  (typeof ALLOCATION_OPERATIONAL_STATUSES)[number];

export const ALLOCATION_OPERATIONAL_STATUS_LABELS: Record<
  AllocationOperationalStatus,
  string
> = {
  pending: 'Pendente',
  prepared: 'Preparado',
  dispatched: 'Despachado',
  in_operation: 'Em operação',
  returned: 'Retornado',
  released: 'Liberado',
  damaged: 'Avariado',
  lost: 'Perdido',
  maintenance: 'Manutenção',
  cancelled: 'Cancelado',
};

export function allocationOperationalStatusBadgeVariant(
  s: AllocationOperationalStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'released':
      return 'default';
    case 'prepared':
    case 'dispatched':
    case 'in_operation':
      return 'secondary';
    case 'damaged':
    case 'lost':
      return 'destructive';
    default:
      return 'outline';
  }
}

export const RETURN_CONDITIONS = [
  'ok',
  'damaged',
  'lost',
  'maintenance_required',
] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  ok: 'OK',
  damaged: 'Avariado',
  lost: 'Perdido',
  maintenance_required: 'Manutenção',
};

export const OPERATION_EVENT_LABELS: Record<string, string> = {
  reservation_status_changed: 'Mudança de status da reserva',
  item_prepared: 'Item preparado',
  item_dispatched: 'Item despachado',
  item_in_operation: 'Item em operação',
  item_returned: 'Item retornado',
  item_released: 'Item liberado',
  item_damaged: 'Item marcado como avariado',
  item_lost: 'Item marcado como perdido',
  item_sent_to_maintenance: 'Item enviado para manutenção',
  manual_adjustment: 'Ajuste manual',
};

export const inventoryReservationOperationalStatusSchema = z.object({
  status: z.enum([
    'in_preparation',
    'dispatched',
    'in_operation',
    'returned',
    'closed',
    'cancelled',
  ] as const),
  notes: z.string().optional().nullable(),
});

export const inventoryReturnConditionSchema = z.object({
  reservation_allocation_id: z.string().uuid(),
  return_condition: z.enum(RETURN_CONDITIONS),
  return_notes: z.string().optional().nullable(),
});
