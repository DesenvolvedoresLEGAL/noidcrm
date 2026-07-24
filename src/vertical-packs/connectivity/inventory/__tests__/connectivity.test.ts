import { describe, it, expect } from 'vitest';
import {
  CONNECTIVITY_EQUIPMENT_PROFILE_LABELS,
  CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS,
  CONNECTIVITY_INVENTORY_FIELD_LABELS,
  SIM_CARRIERS,
  isConnectivityEquipmentProfile,
  isConnectivityProfileConfigured,
  routerFactorySchema,
  simCardFactorySchema,
  routerCustomSchema,
  simCardCustomSchema,
  getRouterFactory,
  getSimCardFactory,
  getRouterCustom,
  getSimCardCustom,
  hasRouterCustom,
  hasSimCustom,
  mergeFactoryRouter,
  mergeFactorySim,
} from './index';

describe('Connectivity Pack — profile surface', () => {
  it('contains router', () => {
    expect(isConnectivityEquipmentProfile('router')).toBe(true);
    expect(CONNECTIVITY_EQUIPMENT_PROFILE_LABELS.router).toBe('Roteador');
  });
  it('contains sim_card', () => {
    expect(isConnectivityEquipmentProfile('sim_card')).toBe(true);
    expect(CONNECTIVITY_EQUIPMENT_PROFILE_LABELS.sim_card).toBe('Chip (SIM)');
  });
  it('does NOT contain generic', () => {
    expect(isConnectivityEquipmentProfile('generic')).toBe(false);
    expect((CONNECTIVITY_EQUIPMENT_PROFILE_LABELS as any).generic).toBeUndefined();
    expect(CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS.some((o) => (o.value as any) === 'generic')).toBe(false);
  });
  it('preserves SIM carriers verbatim', () => {
    expect([...SIM_CARRIERS]).toEqual(['Vivo', 'Claro', 'TIM', 'Algar', 'Outra']);
  });
});

describe('Connectivity Pack — schemas', () => {
  it('routerFactorySchema requires all fields', () => {
    expect(routerFactorySchema.safeParse({ ssid_factory: '', wifi_password_factory: '', admin_user: '', admin_password: '', imei: '' }).success).toBe(false);
    expect(routerFactorySchema.safeParse({ ssid_factory: 'A', wifi_password_factory: 'B', admin_user: 'C', admin_password: 'D', imei: 'E' }).success).toBe(true);
  });
  it('simCardFactorySchema requires iccid/line/carrier/apn (pin optional)', () => {
    expect(simCardFactorySchema.safeParse({ iccid: '', line_number: '', carrier: '', apn: '' }).success).toBe(false);
    expect(simCardFactorySchema.safeParse({ iccid: '1', line_number: '2', carrier: 'Vivo', apn: 'apn' }).success).toBe(true);
  });
  it('routerCustomSchema keeps 8-char min on wifi password', () => {
    expect(routerCustomSchema.safeParse({ ssid_custom: 'X', wifi_password_custom: 'short' }).success).toBe(false);
    expect(routerCustomSchema.safeParse({ ssid_custom: 'X', wifi_password_custom: 'longenough' }).success).toBe(true);
  });
  it('simCardCustomSchema keeps APN required', () => {
    expect(simCardCustomSchema.safeParse({ apn_operational: '' }).success).toBe(false);
    expect(simCardCustomSchema.safeParse({ apn_operational: 'iot' }).success).toBe(true);
  });
});

describe('Connectivity Pack — metadata & allocation helpers', () => {
  it('getRouterFactory/getSimCardFactory read metadata', () => {
    expect(getRouterFactory({ router: { ssid_factory: 'S' } })?.ssid_factory).toBe('S');
    expect(getSimCardFactory({ sim_card: { iccid: 'I' } })?.iccid).toBe('I');
  });
  it('merge helpers preserve unknown metadata siblings', () => {
    const merged = mergeFactoryRouter({ foo: 'bar' }, { ssid_factory: 'A', wifi_password_factory: 'B', admin_user: 'C', admin_password: 'D', imei: 'E' });
    expect(merged.foo).toBe('bar');
    expect((merged as any).router.ssid_factory).toBe('A');
    const mergedSim = mergeFactorySim({ foo: 'bar' }, { iccid: '1', line_number: '2', carrier: 'Vivo', apn: 'apn' });
    expect(mergedSim.foo).toBe('bar');
    expect((mergedSim as any).sim_card.iccid).toBe('1');
  });
  it('getRouterCustom / getSimCardCustom read allocation config', () => {
    expect(getRouterCustom({ router: { ssid_custom: 'X', wifi_password_custom: 'longenough' } })?.ssid_custom).toBe('X');
    expect(getSimCardCustom({ sim_card: { apn_operational: 'apn' } })?.apn_operational).toBe('apn');
  });
  it('hasRouterCustom / hasSimCustom semantics preserved', () => {
    expect(hasRouterCustom({ router: { ssid_custom: 'X', wifi_password_custom: 'longenough' } })).toBe(true);
    expect(hasRouterCustom({ router: { ssid_custom: '', wifi_password_custom: '' } })).toBe(false);
    expect(hasSimCustom({ sim_card: { apn_operational: 'apn' } })).toBe(true);
    expect(hasSimCustom({ sim_card: {} })).toBe(false);
  });
  it('isConnectivityProfileConfigured handles only router/sim', () => {
    expect(isConnectivityProfileConfigured('router', { router: { ssid_custom: 'X', wifi_password_custom: 'longenough' } })).toBe(true);
    expect(isConnectivityProfileConfigured('sim_card', { sim_card: { apn_operational: 'apn' } })).toBe(true);
    expect(isConnectivityProfileConfigured('router', null)).toBe(false);
    // generic is NOT a connectivity concept — the function never returns true for it.
    expect(isConnectivityProfileConfigured('generic' as any, {})).toBe(false);
  });
});

describe('Connectivity Pack — field labels', () => {
  it('exposes router/SIM labels', () => {
    expect(CONNECTIVITY_INVENTORY_FIELD_LABELS['router_factory.imei']).toBe('IMEI');
    expect(CONNECTIVITY_INVENTORY_FIELD_LABELS['sim_card_factory.iccid']).toBe('ICCID');
    expect(CONNECTIVITY_INVENTORY_FIELD_LABELS['sim_card_factory.apn']).toBe('APN');
  });
});
