import { describe, it, expect } from 'vitest';
import { NativeInventoryProvider } from '../NativeInventoryProvider';
import { EventrixInventoryProvider } from '../EventrixInventoryProvider';

const ctx = { organizationId: 'org-x' };

describe('NativeInventoryProvider', () => {
  const p = new NativeInventoryProvider();

  it('nunca presume disponibilidade', async () => {
    const r = await p.checkAvailability(ctx, { items: [{ quantity: 1 }] });
    expect(r.code).toBe('not_supported');
  });

  it('não expõe capacidades falsas', () => {
    expect(p.getCapabilities()).toEqual([]);
  });

  it('retorna listas vazias sem erro', async () => {
    expect(await p.listCategories(ctx)).toEqual([]);
    expect(await p.listFamilies(ctx)).toEqual([]);
    expect(await p.listItems(ctx)).toEqual([]);
  });
});

describe('EventrixInventoryProvider', () => {
  const rows = [
    { id: '1', organization_id: 'o', eventrix_entity_id: 'c1', entity_type: 'category', name: 'Conectividade', description: null, parent_eventrix_entity_id: null, control_mode: 'quantity', item_kind: null, is_active: true, payload: null, synced_at: null },
    { id: '2', organization_id: 'o', eventrix_entity_id: 'f1', entity_type: 'family', name: 'Roteador 5G', description: null, parent_eventrix_entity_id: 'c1', control_mode: null, item_kind: 'serialized', is_active: true, payload: null, synced_at: null },
    { id: '3', organization_id: 'o', eventrix_entity_id: 'f2', entity_type: 'family', name: 'Chip', description: null, parent_eventrix_entity_id: 'c1', control_mode: null, item_kind: 'serialized', is_active: true, payload: null, synced_at: null },
  ];
  const provider = new EventrixInventoryProvider({
    fetchSettings: async () => ({ status: 'connected', is_enabled: true }),
    fetchCache: async () => rows as any,
  });

  it('normaliza categoria removendo prefixo eventrix_', async () => {
    const cats = await provider.listCategories(ctx);
    expect(cats[0]).toMatchObject({ id: 'c1', name: 'Conectividade', active: true });
    expect((cats[0] as any).eventrix_entity_id).toBeUndefined();
  });

  it('normaliza família e associa categoryId', async () => {
    const fams = await provider.listFamilies(ctx, 'c1');
    expect(fams).toHaveLength(2);
    expect(fams[0]).toMatchObject({ id: 'f1', categoryId: 'c1', itemKind: 'serialized' });
  });

  it('valida requisitos contra o cache', async () => {
    const v = await provider.validateProductRequirements(ctx, [
      { label: 'ok', categoryId: 'c1', familyId: 'f1', quantity: 1 },
      { label: 'ruim', categoryId: 'zzz', familyId: 'yyy', quantity: 1 },
    ]);
    expect(v.valid).toBe(false);
    expect(v.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('status connected+enabled = available', async () => {
    const s = await provider.getStatus(ctx);
    expect(s.code).toBe('available');
  });
});
