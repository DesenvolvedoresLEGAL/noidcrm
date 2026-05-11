import { z } from 'zod';

export type EquipmentProfile = 'generic' | 'router' | 'sim_card';

export const EQUIPMENT_PROFILE_LABELS: Record<EquipmentProfile, string> = {
  generic: 'Genérico',
  router: 'Roteador',
  sim_card: 'Chip (SIM)',
};

export const EQUIPMENT_PROFILE_OPTIONS: { value: EquipmentProfile; label: string }[] = [
  { value: 'generic', label: 'Genérico' },
  { value: 'router', label: 'Roteador' },
  { value: 'sim_card', label: 'Chip (SIM)' },
];

export const SIM_CARRIERS = ['Vivo', 'Claro', 'TIM', 'Algar', 'Outra'] as const;

// ----- Factory data (saved in inventory_items.metadata) -----

export interface RouterFactory {
  ssid_factory: string;
  wifi_password_factory: string;
  admin_user: string;
  admin_password: string;
  imei: string;
}

export interface SimCardFactory {
  iccid: string;
  line_number: string;
  carrier: string;
  apn: string;
  pin?: string | null;
}

export const routerFactorySchema = z.object({
  ssid_factory: z.string().trim().min(1, 'SSID de fábrica obrigatório.').max(80),
  wifi_password_factory: z.string().trim().min(1, 'Senha Wi-Fi obrigatória.').max(120),
  admin_user: z.string().trim().min(1, 'Usuário admin obrigatório.').max(80),
  admin_password: z.string().trim().min(1, 'Senha admin obrigatória.').max(120),
  imei: z.string().trim().min(1, 'IMEI obrigatório.').max(40),
});

export const simCardFactorySchema = z.object({
  iccid: z.string().trim().min(1, 'ICCID obrigatório.').max(40),
  line_number: z.string().trim().min(1, 'Número da linha obrigatório.').max(40),
  carrier: z.string().trim().min(1, 'Operadora obrigatória.').max(40),
  apn: z.string().trim().min(1, 'APN obrigatório.').max(80),
  pin: z.string().trim().max(20).optional().nullable().or(z.literal('')),
});

// ----- Custom config (saved in allocation.custom_config) -----

export interface RouterCustom {
  ssid_custom: string;
  wifi_password_custom: string;
  notes?: string | null;
}

export interface SimCardCustom {
  apn_operational: string;
  notes?: string | null;
}

export const routerCustomSchema = z.object({
  ssid_custom: z.string().trim().min(1, 'SSID personalizado obrigatório.').max(80),
  wifi_password_custom: z
    .string()
    .trim()
    .min(8, 'Senha personalizada deve ter no mínimo 8 caracteres.')
    .max(120),
  notes: z.string().trim().max(500).optional().nullable().or(z.literal('')),
});

export const simCardCustomSchema = z.object({
  apn_operational: z.string().trim().min(1, 'APN operacional obrigatório.').max(80),
  notes: z.string().trim().max(500).optional().nullable().or(z.literal('')),
});

// ----- Helpers -----

export function getEquipmentProfile(value: unknown): EquipmentProfile {
  return value === 'router' || value === 'sim_card' ? value : 'generic';
}

export function getRouterFactory(metadata: unknown): RouterFactory | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const r = (metadata as any).router;
  if (!r || typeof r !== 'object') return null;
  return {
    ssid_factory: r.ssid_factory ?? '',
    wifi_password_factory: r.wifi_password_factory ?? '',
    admin_user: r.admin_user ?? '',
    admin_password: r.admin_password ?? '',
    imei: r.imei ?? '',
  };
}

export function getSimCardFactory(metadata: unknown): SimCardFactory | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const s = (metadata as any).sim_card;
  if (!s || typeof s !== 'object') return null;
  return {
    iccid: s.iccid ?? '',
    line_number: s.line_number ?? '',
    carrier: s.carrier ?? '',
    apn: s.apn ?? '',
    pin: s.pin ?? '',
  };
}

export function getRouterCustom(customConfig: unknown): RouterCustom | null {
  if (!customConfig || typeof customConfig !== 'object') return null;
  const r = (customConfig as any).router;
  if (!r || typeof r !== 'object') return null;
  return {
    ssid_custom: r.ssid_custom ?? '',
    wifi_password_custom: r.wifi_password_custom ?? '',
    notes: r.notes ?? '',
  };
}

export function getSimCardCustom(customConfig: unknown): SimCardCustom | null {
  if (!customConfig || typeof customConfig !== 'object') return null;
  const s = (customConfig as any).sim_card;
  if (!s || typeof s !== 'object') return null;
  return {
    apn_operational: s.apn_operational ?? '',
    notes: s.notes ?? '',
  };
}

export function hasRouterCustom(customConfig: unknown): boolean {
  const r = getRouterCustom(customConfig);
  return !!r && r.ssid_custom.length > 0 && r.wifi_password_custom.length > 0;
}

export function hasSimCustom(customConfig: unknown): boolean {
  const s = getSimCardCustom(customConfig);
  return !!s && s.apn_operational.length > 0;
}

export function isAllocationConfigured(
  profile: EquipmentProfile,
  customConfig: unknown,
): boolean {
  if (profile === 'router') return hasRouterCustom(customConfig);
  if (profile === 'sim_card') return hasSimCustom(customConfig);
  return true;
}

export function mergeFactoryRouter(
  existingMetadata: unknown,
  router: RouterFactory | null,
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === 'object'
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  if (router) {
    base.router = router;
  } else {
    delete (base as any).router;
  }
  return base;
}

export function mergeFactorySim(
  existingMetadata: unknown,
  sim: SimCardFactory | null,
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === 'object'
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  if (sim) {
    base.sim_card = sim;
  } else {
    delete (base as any).sim_card;
  }
  return base;
}
