// NOID-VERTICAL-1.0-VERT-01.2B
import { describe, it, expect, vi } from 'vitest';
import { InventoryProviderRegistry } from '../InventoryProviderRegistry';
import { NativeInventoryProvider } from '../NativeInventoryProvider';
import { EventrixInventoryProvider } from '../EventrixInventoryProvider';
import { resolveInventoryProvider } from '../resolveInventoryProvider';

function buildRegistry() {
  const r = new InventoryProviderRegistry();
  r.register(new NativeInventoryProvider());
  r.register(
    new EventrixInventoryProvider({
      fetchSettings: async () => ({ status: 'connected', is_enabled: true }),
    }),
  );
  return r;
}

const ctx = { organizationId: 'org-1' };

describe('resolveInventoryProvider — canonical precedence', () => {
  it('1. canonical eventrix wins over any legacy state', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => ({
        provider_type: 'eventrix',
        is_enabled: true,
      }),
      fetchEventrixSettings: async () => null,
    });
    expect(res.providerType).toBe('eventrix');
    expect(res.source).toBe('canonical_provider_settings');
  });

  it('2. canonical native wins over active legacy eventrix', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => ({
        provider_type: 'native',
        is_enabled: true,
      }),
      fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }),
    });
    expect(res.providerType).toBe('native');
    expect(res.source).toBe('canonical_provider_settings');
  });

  it('3. canonical disabled resolves native', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => ({
        provider_type: 'eventrix',
        is_enabled: false,
      }),
      fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }),
    });
    expect(res.providerType).toBe('native');
    expect(res.source).toBe('canonical_provider_settings');
  });

  it('4. no canonical + legacy eventrix active resolves eventrix', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => null,
      fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }),
    });
    expect(res.providerType).toBe('eventrix');
    expect(res.source).toBe('legacy_eventrix_settings');
  });

  it('5. no canonical + legacy inactive resolves native', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => null,
      fetchEventrixSettings: async () => null,
    });
    expect(res.providerType).toBe('native');
    expect(res.source).toBe('native_default');
  });

  it('6. canonical fetch error + legacy active falls back through legacy path', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => {
        throw new Error('boom');
      },
      fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }),
    });
    expect(res.providerType).toBe('eventrix');
    expect(res.source).toBe('legacy_eventrix_settings');
  });

  it('7. invalid canonical provider_type does NOT silently fall to eventrix', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: async () => ({
        provider_type: 'ghost_provider',
        is_enabled: true,
      }),
      fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }),
    });
    expect(res.providerType).toBe('native');
    expect(res.status.code).toBe('error');
  });

  it('8. source values are stable', async () => {
    const registry = buildRegistry();
    const fetchCanonical = vi.fn(async () => null);
    const fetchEventrix = vi.fn(async () => null);
    const res = await resolveInventoryProvider(ctx, {
      registry,
      fetchCanonicalSettings: fetchCanonical,
      fetchEventrixSettings: fetchEventrix,
    });
    expect(['canonical_provider_settings', 'legacy_eventrix_settings', 'native_default']).toContain(
      res.source,
    );
  });
});
