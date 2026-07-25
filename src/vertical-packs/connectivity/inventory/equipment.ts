/**
 * Connectivity Vertical Pack — Inventory / Equipment domain.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.3A
 *
 * This module is the AUTHORITATIVE source for connectivity-specific inventory
 * concepts (router, SIM card). It must NOT know about the Core-generic
 * `generic` profile — that concept belongs to the Core Universal and is
 * expressed by absence of a connectivity profile.
 *
 * No database changes. Field shapes for metadata / custom_config are preserved
 * verbatim so existing rows remain valid.
 */
import { z } from 'zod';

// ----- Connectivity profile -----

export const CONNECTIVITY_EQUIPMENT_PROFILE_VALUES = ['router', 'sim_card'] as const;

export type ConnectivityEquipmentProfile =
  (typeof CONNECTIVITY_EQUIPMENT_PROFILE_VALUES)[number];

export const CONNECTIVITY_EQUIPMENT_PROFILE_LABELS: Record<
  ConnectivityEquipmentProfile,
  string
> = {
  router: 'Roteador',
  sim_card: 'Chip (SIM)',
};

export const CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS: {
  value: ConnectivityEquipmentProfile;
  label: string;
}[] = CONNECTIVITY_EQUIPMENT_PROFILE_VALUES.map((value) => ({
  value,
  label: CONNECTIVITY_EQUIPMENT_PROFILE_LABELS[value],
}));

export function isConnectivityEquipmentProfile(
  value: unknown,
): value is ConnectivityEquipmentProfile {
  return (
    typeof value === 'string' &&
    (CONNECTIVITY_EQUIPMENT_PROFILE_VALUES as readonly string[]).includes(value)
  );
}

// ----- SIM Carriers -----

export const SIM_CARRIERS = ['Vivo', 'Claro', 'TIM', 'Algar', 'Outra'] as const;

// ----- Factory data (inventory_items.metadata) -----

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

// ----- Custom config (allocation.custom_config) -----

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

// ----- Metadata helpers -----

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

// ----- Allocation custom config helpers -----

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

/**
 * Whether an allocation carrying a connectivity profile is fully configured.
 * Only knows router/sim_card — the Core-generic fallback lives outside the Pack.
 */
export function isConnectivityProfileConfigured(
  profile: ConnectivityEquipmentProfile,
  customConfig: unknown,
): boolean {
  if (profile === 'router') return hasRouterCustom(customConfig);
  if (profile === 'sim_card') return hasSimCustom(customConfig);
  return false;
}

/**
 * Merge a router custom config block into an existing allocation custom_config
 * without touching sibling namespaces. Non-mutating.
 */
export function mergeRouterCustomConfig(
  existingConfig: unknown,
  router: RouterCustom,
): Record<string, unknown> {
  const base =
    existingConfig && typeof existingConfig === 'object'
      ? { ...(existingConfig as Record<string, unknown>) }
      : {};
  base.router = {
    ssid_custom: router.ssid_custom,
    wifi_password_custom: router.wifi_password_custom,
    notes: router.notes ?? null,
  };
  return base;
}

/**
 * Merge a SIM-card custom config block into an existing allocation
 * custom_config without touching sibling namespaces. Non-mutating.
 */
export function mergeSimCardCustomConfig(
  existingConfig: unknown,
  sim: SimCardCustom,
): Record<string, unknown> {
  const base =
    existingConfig && typeof existingConfig === 'object'
      ? { ...(existingConfig as Record<string, unknown>) }
      : {};
  base.sim_card = {
    apn_operational: sim.apn_operational,
    notes: sim.notes ?? null,
  };
  return base;
}

