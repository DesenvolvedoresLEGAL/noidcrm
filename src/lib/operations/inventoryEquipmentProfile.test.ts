import { describe, it, expect } from 'vitest';
import {
  getEquipmentProfile,
  getRouterFactory,
  getSimCardFactory,
  getRouterCustom,
  getSimCardCustom,
  hasRouterCustom,
  hasSimCustom,
  isAllocationConfigured,
  mergeFactoryRouter,
  mergeFactorySim,
  routerFactorySchema,
  simCardFactorySchema,
  routerCustomSchema,
  simCardCustomSchema,
} from './inventoryEquipmentProfile';

describe('getEquipmentProfile', () => {
  it('normalizes unknown to generic', () => {
    expect(getEquipmentProfile(null)).toBe('generic');
    expect(getEquipmentProfile('foo')).toBe('generic');
    expect(getEquipmentProfile(undefined)).toBe('generic');
  });
  it('preserves valid profiles', () => {
    expect(getEquipmentProfile('router')).toBe('router');
    expect(getEquipmentProfile('sim_card')).toBe('sim_card');
    expect(getEquipmentProfile('generic')).toBe('generic');
  });
});

describe('factory schemas', () => {
  it('rejects empty router fields', () => {
    const r = routerFactorySchema.safeParse({
      ssid_factory: '',
      wifi_password_factory: '',
      admin_user: '',
      admin_password: '',
      imei: '',
    });
    expect(r.success).toBe(false);
  });

  it('accepts complete router payload', () => {
    const r = routerFactorySchema.safeParse({
      ssid_factory: 'NOID-WIFI',
      wifi_password_factory: 'changeme',
      admin_user: 'admin',
      admin_password: 'admin',
      imei: '356938035643809',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty sim card payload', () => {
    const r = simCardFactorySchema.safeParse({
      iccid: '',
      line_number: '',
      carrier: '',
      apn: '',
    });
    expect(r.success).toBe(false);
  });

  it('accepts complete sim card payload (pin optional)', () => {
    const r = simCardFactorySchema.safeParse({
      iccid: '8955010012345678901',
      line_number: '11999998888',
      carrier: 'Vivo',
      apn: 'zap.vivo.com.br',
    });
    expect(r.success).toBe(true);
  });
});

describe('custom schemas', () => {
  it('requires min 8 chars on wifi password', () => {
    const r = routerCustomSchema.safeParse({
      ssid_custom: 'CLIENT-WIFI',
      wifi_password_custom: 'short',
    });
    expect(r.success).toBe(false);
  });

  it('accepts valid router custom', () => {
    const r = routerCustomSchema.safeParse({
      ssid_custom: 'CLIENT-WIFI',
      wifi_password_custom: 'StrongPass1',
      notes: '',
    });
    expect(r.success).toBe(true);
  });

  it('accepts valid sim custom', () => {
    const r = simCardCustomSchema.safeParse({ apn_operational: 'iot.vivo' });
    expect(r.success).toBe(true);
  });
});

describe('metadata extractors', () => {
  it('returns null when missing', () => {
    expect(getRouterFactory(null)).toBeNull();
    expect(getRouterFactory({})).toBeNull();
    expect(getSimCardFactory({ router: {} })).toBeNull();
  });

  it('reads router factory data', () => {
    const meta = {
      router: {
        ssid_factory: 'NOID',
        wifi_password_factory: 'pwd',
        admin_user: 'admin',
        admin_password: 'admin',
        imei: '123',
      },
    };
    expect(getRouterFactory(meta)).toEqual(meta.router);
  });
});

describe('custom extractors & helpers', () => {
  it('detects when router custom is configured', () => {
    expect(hasRouterCustom(null)).toBe(false);
    expect(hasRouterCustom({ router: { ssid_custom: '', wifi_password_custom: '' } })).toBe(false);
    expect(
      hasRouterCustom({
        router: { ssid_custom: 'X', wifi_password_custom: 'StrongPass1' },
      }),
    ).toBe(true);
  });

  it('detects when sim custom is configured', () => {
    expect(hasSimCustom(null)).toBe(false);
    expect(hasSimCustom({ sim_card: { apn_operational: '' } })).toBe(false);
    expect(hasSimCustom({ sim_card: { apn_operational: 'iot.vivo' } })).toBe(true);
  });

  it('isAllocationConfigured behaves per profile', () => {
    expect(isAllocationConfigured('generic', null)).toBe(true);
    expect(isAllocationConfigured('router', null)).toBe(false);
    expect(
      isAllocationConfigured('router', {
        router: { ssid_custom: 'X', wifi_password_custom: 'StrongPass1' },
      }),
    ).toBe(true);
    expect(isAllocationConfigured('sim_card', null)).toBe(false);
    expect(
      isAllocationConfigured('sim_card', { sim_card: { apn_operational: 'apn.x' } }),
    ).toBe(true);
  });

  it('reads router/sim custom with defaults', () => {
    expect(getRouterCustom({ router: {} })).toEqual({
      ssid_custom: '',
      wifi_password_custom: '',
      notes: '',
    });
    expect(getSimCardCustom({ sim_card: {} })).toEqual({
      apn_operational: '',
      notes: '',
    });
  });
});

describe('merge helpers', () => {
  it('merges router into existing metadata, preserving siblings', () => {
    const existing = { foo: 'bar', router: { stale: true } };
    const merged = mergeFactoryRouter(existing, {
      ssid_factory: 'A',
      wifi_password_factory: 'B',
      admin_user: 'C',
      admin_password: 'D',
      imei: 'E',
    });
    expect(merged.foo).toBe('bar');
    expect((merged as any).router.ssid_factory).toBe('A');
    expect((merged as any).router.stale).toBeUndefined();
  });

  it('removes router key when null', () => {
    const merged = mergeFactoryRouter({ foo: 1, router: { x: 1 } }, null);
    expect((merged as any).router).toBeUndefined();
    expect(merged.foo).toBe(1);
  });

  it('merges sim into existing metadata', () => {
    const merged = mergeFactorySim(
      { foo: 1 },
      { iccid: '1', line_number: '2', carrier: 'Vivo', apn: 'apn' },
    );
    expect((merged as any).sim_card.iccid).toBe('1');
    expect(merged.foo).toBe(1);
  });

  it('handles non-object existing metadata', () => {
    const merged = mergeFactoryRouter(null, {
      ssid_factory: 'A',
      wifi_password_factory: 'B',
      admin_user: 'C',
      admin_password: 'D',
      imei: 'E',
    });
    expect((merged as any).router.ssid_factory).toBe('A');
  });
});
