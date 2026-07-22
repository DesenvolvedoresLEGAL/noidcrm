import { describe, it, expect } from 'vitest';
import { InventoryProviderRegistry } from '../InventoryProviderRegistry';
import { NativeInventoryProvider } from '../NativeInventoryProvider';
import { EventrixInventoryProvider } from '../EventrixInventoryProvider';
import { resolveInventoryProvider } from '../resolveInventoryProvider';

function buildRegistry() {
  const r = new InventoryProviderRegistry();
  r.register(new NativeInventoryProvider());
  r.register(new EventrixInventoryProvider({ fetchSettings: async () => ({ status: 'connected', is_enabled: true }) }));
  return r;
}

describe('resolveInventoryProvider', () => {
  it('tenant sem settings Eventrix -> native', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(
      { organizationId: 'org-1' },
      { registry, fetchEventrixSettings: async () => null },
    );
    expect(res.providerType).toBe('native');
    expect(res.source).toBe('native_default');
  });

  it('tenant com Eventrix habilitado -> eventrix', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(
      { organizationId: 'org-2' },
      { registry, fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: true }) },
    );
    expect(res.providerType).toBe('eventrix');
    expect(res.source).toBe('legacy_eventrix_settings');
  });

  it('tenant com Eventrix desabilitado -> native', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(
      { organizationId: 'org-3' },
      { registry, fetchEventrixSettings: async () => ({ status: 'connected', is_enabled: false }) },
    );
    expect(res.providerType).toBe('native');
  });

  it('erro ao consultar settings -> fallback native, não quebra', async () => {
    const registry = buildRegistry();
    const res = await resolveInventoryProvider(
      { organizationId: 'org-4' },
      { registry, fetchEventrixSettings: async () => { throw new Error('boom'); } },
    );
    expect(res.providerType).toBe('native');
  });

  it('Eventrix ativo com status "error" propaga status normalizado', async () => {
    const registry = new InventoryProviderRegistry();
    registry.register(new NativeInventoryProvider());
    registry.register(new EventrixInventoryProvider({ fetchSettings: async () => ({ status: 'error', is_enabled: true }) }));
    const res = await resolveInventoryProvider(
      { organizationId: 'org-5' },
      { registry, fetchEventrixSettings: async () => ({ status: 'error', is_enabled: true }) },
    );
    expect(res.providerType).toBe('eventrix');
    expect(res.status.code).toBe('error');
  });
});
