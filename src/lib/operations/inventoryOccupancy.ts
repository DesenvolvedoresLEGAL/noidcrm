import { z } from 'zod';

export const inventoryOccupancyFiltersSchema = z
  .object({
    start_date: z.string().min(1, 'Data inicial obrigatória'),
    end_date: z.string().min(1, 'Data final obrigatória'),
    category_id: z.string().uuid().nullable().optional(),
    family_id: z.string().uuid().nullable().optional(),
    status: z.string().nullable().optional(),
    view_mode: z.enum(['item', 'category', 'reservation']).default('item'),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'Data final não pode ser menor que a inicial',
    path: ['end_date'],
  });

export type InventoryOccupancyFilters = z.infer<typeof inventoryOccupancyFiltersSchema>;

export const inventoryAvailabilitySnapshotSchema = z
  .object({
    start_date: z.string().min(1, 'Data inicial obrigatória'),
    end_date: z.string().min(1, 'Data final obrigatória'),
    category_id: z.string().uuid().nullable().optional(),
    family_id: z.string().uuid().nullable().optional(),
    requested_quantity: z.number().positive('Quantidade deve ser maior que zero'),
  })
  .refine((d) => d.end_date >= d.start_date, {
    message: 'Data final não pode ser menor que a inicial',
    path: ['end_date'],
  });

export type InventoryAvailabilitySnapshotPayload = z.infer<
  typeof inventoryAvailabilitySnapshotSchema
>;

export type OccupancyType =
  | 'free'
  | 'pre_reserved'
  | 'reserved'
  | 'in_preparation'
  | 'dispatched'
  | 'in_operation'
  | 'returned'
  | 'maintenance'
  | 'damaged'
  | 'lost';

export const OCCUPANCY_TYPE_LABELS: Record<string, string> = {
  free: 'Livre',
  pre_reserved: 'Pré reservado',
  reserved: 'Reservado',
  in_preparation: 'Em preparação',
  dispatched: 'Despachado',
  in_operation: 'Em operação',
  returned: 'Retorno',
  maintenance: 'Manutenção',
  damaged: 'Avariado',
  lost: 'Perdido',
};

export const OCCUPANCY_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  free: 'outline',
  pre_reserved: 'secondary',
  reserved: 'default',
  in_preparation: 'secondary',
  dispatched: 'default',
  in_operation: 'default',
  returned: 'secondary',
  maintenance: 'outline',
  damaged: 'destructive',
  lost: 'destructive',
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

export const RISK_LEVEL_BADGE: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  baixo: 'outline',
  medio: 'secondary',
  alto: 'default',
  critico: 'destructive',
};

export function computeRiskLevel(rate: number): 'baixo' | 'medio' | 'alto' | 'critico' {
  if (rate >= 0.9) return 'critico';
  if (rate >= 0.75) return 'alto';
  if (rate >= 0.5) return 'medio';
  return 'baixo';
}

export interface OccupancyRow {
  occupancy_type: string;
  source_type: string;
  source_id: string | null;
  item_type: string | null;
  item_id: string | null;
  item_name: string | null;
  item_code: string | null;
  category_id: string | null;
  category_name: string | null;
  family_id: string | null;
  family_name: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  quantity: number;
  client_name: string | null;
  proposal_id: string | null;
  reservation_code: string | null;
  risk_level: string | null;
}

export interface CapacityRow {
  category_id: string | null;
  category_name: string | null;
  family_id: string | null;
  family_name: string | null;
  total_units: number;
  available_units: number;
  pre_reserved_units: number;
  reserved_units: number;
  in_preparation_units: number;
  dispatched_units: number;
  in_operation_units: number;
  returned_units: number;
  maintenance_units: number;
  damaged_units: number;
  lost_units: number;
  occupancy_rate: number;
  risk_level: string;
}

export interface AvailabilitySnapshot {
  available_quantity: number;
  pre_reserved_quantity: number;
  reserved_quantity: number;
  operational_quantity: number;
  maintenance_quantity: number;
  can_fulfill: boolean;
  risk_level: string;
  message: string;
}
