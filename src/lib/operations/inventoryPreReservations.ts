import { z } from 'zod';

export const PRE_RESERVATION_STATUSES = [
  'draft',
  'active',
  'expired',
  'cancelled',
  'converted',
] as const;
export type PreReservationStatus = (typeof PRE_RESERVATION_STATUSES)[number];

export const PRE_RESERVATION_RISK_LEVELS = [
  'low',
  'medium',
  'high',
  'critical',
] as const;
export type PreReservationRiskLevel = (typeof PRE_RESERVATION_RISK_LEVELS)[number];

export const PRE_RESERVATION_SOURCES = ['proposal', 'manual', 'import', 'agent'] as const;
export type PreReservationSource = (typeof PRE_RESERVATION_SOURCES)[number];

export const PRE_RESERVATION_ITEM_TYPES = [
  'serialized',
  'quantity',
  'sku',
  'service_no_stock',
  'category_family_demand',
] as const;
export type PreReservationItemType = (typeof PRE_RESERVATION_ITEM_TYPES)[number];

export const PRE_RESERVATION_ALLOCATION_STATUSES = [
  'unallocated',
  'partially_allocated',
  'allocated',
  'over_allocated',
  'not_required',
] as const;
export type PreReservationAllocationStatus =
  (typeof PRE_RESERVATION_ALLOCATION_STATUSES)[number];

export const ALLOCATION_ITEM_TYPES = ['serialized', 'quantity'] as const;
export type AllocationItemType = (typeof ALLOCATION_ITEM_TYPES)[number];

export const ALLOCATION_STATUSES = ['active', 'cancelled', 'replaced'] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const DEMAND_SOURCES = [
  'proposal_item',
  'product_rule',
  'manual',
  'agent',
] as const;
export type DemandSource = (typeof DEMAND_SOURCES)[number];

export const ALLOCATION_STATUS_LABELS: Record<PreReservationAllocationStatus, string> = {
  unallocated: 'Não alocado',
  partially_allocated: 'Parcial',
  allocated: 'Alocado',
  over_allocated: 'Excedente',
  not_required: 'Sem controle',
};

export function allocationStatusBadgeVariant(
  s: PreReservationAllocationStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'allocated':
      return 'default';
    case 'partially_allocated':
      return 'secondary';
    case 'over_allocated':
      return 'destructive';
    case 'not_required':
      return 'outline';
    default:
      return 'outline';
  }
}

export const PRE_RESERVATION_AVAILABILITIES = [
  'pending',
  'available',
  'partial',
  'unavailable',
  'no_stock_control',
] as const;
export type PreReservationAvailability = (typeof PRE_RESERVATION_AVAILABILITIES)[number];

export const STATUS_LABELS: Record<PreReservationStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  expired: 'Expirada',
  cancelled: 'Cancelada',
  converted: 'Convertida',
};

export const RISK_LABELS: Record<PreReservationRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

export const AVAILABILITY_LABELS: Record<PreReservationAvailability, string> = {
  pending: 'Pendente',
  available: 'Disponível',
  partial: 'Parcial',
  unavailable: 'Indisponível',
  no_stock_control: 'Sem controle de estoque',
};

export const ITEM_TYPE_LABELS: Record<PreReservationItemType, string> = {
  serialized: 'Serializado',
  quantity: 'Por quantidade',
  sku: 'Demanda (SKU)',
  service_no_stock: 'Serviço sem estoque',
  category_family_demand: 'Demanda por categoria/família',
};

export function statusBadgeVariant(
  s: PreReservationStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (s) {
    case 'active':
      return 'default';
    case 'cancelled':
    case 'expired':
      return 'destructive';
    case 'converted':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function riskBadgeVariant(
  r: PreReservationRiskLevel,
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

export function availabilityBadgeVariant(
  a: PreReservationAvailability,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (a) {
    case 'available':
      return 'default';
    case 'partial':
      return 'secondary';
    case 'unavailable':
      return 'destructive';
    case 'no_stock_control':
      return 'outline';
    default:
      return 'outline';
  }
}

export const inventoryPreReservationSchema = z
  .object({
    proposal_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    account_id: z.string().uuid().optional().nullable(),
    contact_id: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(2, 'Título obrigatório'),
    source: z.enum(PRE_RESERVATION_SOURCES).default('proposal'),
    operational_start_date: z.string().min(1, 'Início operacional obrigatório'),
    operational_end_date: z.string().min(1, 'Fim operacional obrigatório'),
    event_start_date: z.string().optional().nullable(),
    event_end_date: z.string().optional().nullable(),
    status: z.enum(PRE_RESERVATION_STATUSES).default('active'),
    risk_level: z.enum(PRE_RESERVATION_RISK_LEVELS).default('low'),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (d) => new Date(d.operational_end_date) >= new Date(d.operational_start_date),
    { message: 'Fim operacional não pode ser anterior ao início.', path: ['operational_end_date'] },
  );

export const inventoryPreReservationItemSchema = z
  .object({
    inventory_item_type: z.enum(PRE_RESERVATION_ITEM_TYPES),
    serialized_item_id: z.string().uuid().optional().nullable(),
    quantity_item_id: z.string().uuid().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    family_id: z.string().uuid().optional().nullable(),
    requested_quantity: z.number().min(0),
    pre_reserved_quantity: z.number().min(0).default(0),
    availability_status: z.enum(PRE_RESERVATION_AVAILABILITIES).default('pending'),
    conflict_reason: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.inventory_item_type === 'serialized' && !data.serialized_item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serialized_item_id'],
        message: 'Item serializado obrigatório.',
      });
    }
    if (data.inventory_item_type === 'quantity' && !data.quantity_item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity_item_id'],
        message: 'Item por quantidade obrigatório.',
      });
    }
  });

export type InventoryPreReservationInput = z.infer<typeof inventoryPreReservationSchema>;
export type InventoryPreReservationItemInput = z.infer<typeof inventoryPreReservationItemSchema>;

/** Calcula período operacional padrão: evento - padBefore / + padAfter dias. */
export function computeOperationalPeriod(
  eventStart: string,
  eventEnd: string,
  opts: { padDaysBefore?: number; padDaysAfter?: number } = {},
): { operational_start_date: string; operational_end_date: string } {
  const padBefore = opts.padDaysBefore ?? 1;
  const padAfter = opts.padDaysAfter ?? 1;
  const start = new Date(eventStart + 'T00:00:00');
  const end = new Date(eventEnd + 'T00:00:00');
  start.setDate(start.getDate() - padBefore);
  end.setDate(end.getDate() + padAfter);
  return {
    operational_start_date: start.toISOString().slice(0, 10),
    operational_end_date: end.toISOString().slice(0, 10),
  };
}
