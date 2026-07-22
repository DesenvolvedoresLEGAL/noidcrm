// NOID-VERTICAL-1.0-VERT-01.2A
import type { InventoryProviderAdapter } from './InventoryProviderAdapter';
import { NativeInventoryProvider } from './NativeInventoryProvider';
import { EventrixInventoryProvider } from './EventrixInventoryProvider';
import type { InventoryProviderType } from './types';

export class InventoryProviderRegistry {
  private providers = new Map<InventoryProviderType, InventoryProviderAdapter>();

  register(adapter: InventoryProviderAdapter) {
    const type = adapter.getType();
    if (this.providers.has(type)) {
      throw new Error(`Inventory provider já registrado: ${type}`);
    }
    this.providers.set(type, adapter);
  }

  has(type: InventoryProviderType) {
    return this.providers.has(type);
  }

  /**
   * Retorna adapter para o tipo pedido.
   * Se o tipo pedido não estiver registrado, retorna null.
   * NUNCA cai silenciosamente para Eventrix — cabe ao chamador tratar o estado.
   */
  get(type: InventoryProviderType): InventoryProviderAdapter | null {
    return this.providers.get(type) ?? null;
  }

  /**
   * Default seguro: `native`. Nunca Eventrix.
   */
  getDefault(): InventoryProviderAdapter {
    const n = this.providers.get('native');
    if (!n) throw new Error('NativeInventoryProvider não registrado.');
    return n;
  }

  listRegistered(): InventoryProviderType[] {
    return Array.from(this.providers.keys());
  }
}

let singleton: InventoryProviderRegistry | null = null;

export function getDefaultInventoryProviderRegistry(): InventoryProviderRegistry {
  if (singleton) return singleton;
  const reg = new InventoryProviderRegistry();
  reg.register(new NativeInventoryProvider());
  reg.register(new EventrixInventoryProvider());
  singleton = reg;
  return reg;
}

export function __resetInventoryProviderRegistryForTests() {
  singleton = null;
}
