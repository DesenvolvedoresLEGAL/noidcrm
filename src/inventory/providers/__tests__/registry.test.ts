import { describe, it, expect } from 'vitest';
import { InventoryProviderRegistry, getDefaultInventoryProviderRegistry, __resetInventoryProviderRegistryForTests } from '../InventoryProviderRegistry';
import { NativeInventoryProvider } from '../NativeInventoryProvider';
import { EventrixInventoryProvider } from '../EventrixInventoryProvider';

describe('InventoryProviderRegistry', () => {
  it('registra e resolve native', () => {
    const r = new InventoryProviderRegistry();
    r.register(new NativeInventoryProvider());
    expect(r.get('native')?.getType()).toBe('native');
  });

  it('registra e resolve eventrix', () => {
    const r = new InventoryProviderRegistry();
    r.register(new EventrixInventoryProvider());
    expect(r.get('eventrix')?.getType()).toBe('eventrix');
  });

  it('não cai silenciosamente para Eventrix quando tipo desconhecido', () => {
    const r = new InventoryProviderRegistry();
    r.register(new NativeInventoryProvider());
    r.register(new EventrixInventoryProvider());
    // @ts-expect-error – testando cast defensivo
    expect(r.get('nao_existe')).toBeNull();
  });

  it('default é native, nunca Eventrix', () => {
    __resetInventoryProviderRegistryForTests();
    const r = getDefaultInventoryProviderRegistry();
    expect(r.getDefault().getType()).toBe('native');
  });

  it('proíbe registro duplicado', () => {
    const r = new InventoryProviderRegistry();
    r.register(new NativeInventoryProvider());
    expect(() => r.register(new NativeInventoryProvider())).toThrow();
  });
});
