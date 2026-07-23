// NOID-VERTICAL-1.0-VERT-01.2E-B1
import { describe, expect, it } from 'vitest';
import {
  mapInventoryRequirementCreateToStorage,
  mapInventoryRequirementUpdateToStorage,
  mapProductInventoryRequirementFromStorage,
  type LegacyProductInventoryRequirementStorageRow,
} from '../storageMapper';
import {
  INVENTORY_PROVIDER_METADATA_KEY,
  InventoryRequirementMetadataError,
  InventoryRequirementProviderNotSupportedError,
  type InventoryProductRequirementInput,
} from '../types';
import { inventoryProductRequirementSchema } from '../schema';

function baseRow(
  overrides: Partial<LegacyProductInventoryRequirementStorageRow> = {},
): LegacyProductInventoryRequirementStorageRow {
  return {
    id: 'req-1',
    organization_id: 'org-1',
    product_id: 'prod-1',
    label: 'Rádio HT',
    eventrix_category_id: 'cat-1',
    eventrix_category_name: 'Rádios',
    eventrix_family_id: 'fam-1',
    eventrix_family_name: 'HT UHF',
    eventrix_item_kind: 'serialized',
    quantity: 2,
    unit_basis: 'per_day',
    is_required: true,
    notes: null,
    sort_order: 0,
    is_active: true,
    metadata: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<InventoryProductRequirementInput> = {},
): InventoryProductRequirementInput {
  return {
    label: 'Rádio HT',
    provider_type: 'eventrix',
    category_ref: 'cat-1',
    category_name: 'Rádios',
    family_ref: 'fam-1',
    family_name: 'HT UHF',
    item_kind: 'serialized',
    quantity: 2,
    unit_basis: 'per_day',
    is_required: true,
    ...overrides,
  };
}

describe('storage → domain', () => {
  it('preserva ids/nomes/item_kind e mapeia para campos genéricos', () => {
    const d = mapProductInventoryRequirementFromStorage(baseRow());
    expect(d.category_ref).toBe('cat-1');
    expect(d.category_name).toBe('Rádios');
    expect(d.family_ref).toBe('fam-1');
    expect(d.family_name).toBe('HT UHF');
    expect(d.item_kind).toBe('serialized');
  });

  it('metadata ausente → provider eventrix (fallback histórico)', () => {
    const d = mapProductInventoryRequirementFromStorage(baseRow({ metadata: null }));
    expect(d.provider_type).toBe('eventrix');
  });

  it('metadata eventrix explícita retorna eventrix', () => {
    const d = mapProductInventoryRequirementFromStorage(
      baseRow({ metadata: { [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix' } }),
    );
    expect(d.provider_type).toBe('eventrix');
  });

  it('metadata explícita inválida lança InventoryRequirementMetadataError', () => {
    expect(() =>
      mapProductInventoryRequirementFromStorage(
        baseRow({ metadata: { [INVENTORY_PROVIDER_METADATA_KEY]: 'zabbix' } }),
      ),
    ).toThrow(InventoryRequirementMetadataError);
  });

  it.each([
    ['number', 123],
    ['boolean', true],
    ['object', { nested: true }],
    ['array', ['eventrix']],
  ])('metadata provider tipo %s lança erro', (_label, value) => {
    expect(() =>
      mapProductInventoryRequirementFromStorage(
        baseRow({ metadata: { [INVENTORY_PROVIDER_METADATA_KEY]: value as unknown } }),
      ),
    ).toThrow(InventoryRequirementMetadataError);
  });

  it('metadata {} (sem chave provider) → fallback histórico eventrix', () => {
    const d = mapProductInventoryRequirementFromStorage(baseRow({ metadata: {} }));
    expect(d.provider_type).toBe('eventrix');
  });

  it('campos universais não contêm chaves eventrix_*', () => {
    const d = mapProductInventoryRequirementFromStorage(baseRow());
    for (const key of Object.keys(d)) {
      expect(key.startsWith('eventrix_')).toBe(false);
    }
  });

  it('mapper não muta input', () => {
    const row = baseRow();
    const snap = JSON.stringify(row);
    mapProductInventoryRequirementFromStorage(row);
    expect(JSON.stringify(row)).toBe(snap);
  });
});

describe('domain → storage (create)', () => {
  it('grava eventrix_* e item_kind', () => {
    const s = mapInventoryRequirementCreateToStorage(baseInput());
    expect(s.eventrix_category_id).toBe('cat-1');
    expect(s.eventrix_family_id).toBe('fam-1');
    expect(s.eventrix_category_name).toBe('Rádios');
    expect(s.eventrix_family_name).toBe('HT UHF');
    expect(s.eventrix_item_kind).toBe('serialized');
  });

  it('metadata recebe inventory_provider_type', () => {
    const s = mapInventoryRequirementCreateToStorage(baseInput());
    expect(s.metadata?.[INVENTORY_PROVIDER_METADATA_KEY]).toBe('eventrix');
  });

  it('metadata existente do input é mesclada, provider prevalece', () => {
    const s = mapInventoryRequirementCreateToStorage(
      baseInput({ metadata: { foo: 'bar' } }),
    );
    expect(s.metadata?.foo).toBe('bar');
    expect(s.metadata?.[INVENTORY_PROVIDER_METADATA_KEY]).toBe('eventrix');
  });

  it('provider native é rejeitado', () => {
    expect(() =>
      mapInventoryRequirementCreateToStorage(baseInput({ provider_type: 'native' })),
    ).toThrow(InventoryRequirementProviderNotSupportedError);
  });

  it('provider desconhecido é rejeitado', () => {
    expect(() =>
      mapInventoryRequirementCreateToStorage(
        baseInput({ provider_type: 'unknown' as any }),
      ),
    ).toThrow(InventoryRequirementProviderNotSupportedError);
  });

  it('nenhum secret/base_url é persistido', () => {
    const s = mapInventoryRequirementCreateToStorage(baseInput()) as any;
    expect(s.secret).toBeUndefined();
    expect(s.base_url).toBeUndefined();
    expect(s.api_key).toBeUndefined();
  });

  it('mapper não muta input', () => {
    const input = baseInput();
    const snap = JSON.stringify(input);
    mapInventoryRequirementCreateToStorage(input);
    expect(JSON.stringify(input)).toBe(snap);
  });
});

describe('domain → storage (update)', () => {
  it('update parcial preserva metadata existente', () => {
    const existing = { foo: 'bar', [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix' };
    const patch = mapInventoryRequirementUpdateToStorage(
      { metadata: { extra: 1 } },
      existing,
    );
    expect(patch.metadata?.foo).toBe('bar');
    expect(patch.metadata?.extra).toBe(1);
    expect(patch.metadata?.[INVENTORY_PROVIDER_METADATA_KEY]).toBe('eventrix');
  });

  it('update sem metadata não toca metadata do storage', () => {
    const patch = mapInventoryRequirementUpdateToStorage({ label: 'novo' });
    expect(patch.metadata).toBeUndefined();
    expect(patch.label).toBe('novo');
  });

  it('provider native é rejeitado em update', () => {
    expect(() =>
      mapInventoryRequirementUpdateToStorage({ provider_type: 'native' }),
    ).toThrow(InventoryRequirementProviderNotSupportedError);
  });

  it('update com provider_type preserva chaves existentes de metadata', () => {
    const existing = {
      foo: 'bar',
      custom: 123,
      [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix',
    };
    const patch = mapInventoryRequirementUpdateToStorage(
      { provider_type: 'eventrix', label: 'Atualizado' },
      existing,
    );
    expect(patch.label).toBe('Atualizado');
    expect(patch.metadata?.foo).toBe('bar');
    expect(patch.metadata?.custom).toBe(123);
    expect(patch.metadata?.[INVENTORY_PROVIDER_METADATA_KEY]).toBe('eventrix');
  });
});

describe('schema', () => {
  it('input genérico válido passa', () => {
    expect(inventoryProductRequirementSchema.safeParse(baseInput()).success).toBe(true);
  });

  it('category_ref ausente falha', () => {
    const r = inventoryProductRequirementSchema.safeParse({
      ...baseInput(),
      category_ref: '',
    });
    expect(r.success).toBe(false);
  });

  it('family_ref ausente falha', () => {
    const r = inventoryProductRequirementSchema.safeParse({
      ...baseInput(),
      family_ref: '',
    });
    expect(r.success).toBe(false);
  });

  it('quantity <= 0 falha', () => {
    const r = inventoryProductRequirementSchema.safeParse({
      ...baseInput(),
      quantity: 0,
    });
    expect(r.success).toBe(false);
  });

  it('unit_basis inválido falha', () => {
    const r = inventoryProductRequirementSchema.safeParse({
      ...baseInput(),
      unit_basis: 'per_year' as any,
    });
    expect(r.success).toBe(false);
  });

  it('notes acima do limite falha', () => {
    const r = inventoryProductRequirementSchema.safeParse({
      ...baseInput(),
      notes: 'x'.repeat(400),
    });
    expect(r.success).toBe(false);
  });

  it('schema não possui keys eventrix_*', () => {
    const shape = (inventoryProductRequirementSchema as any).shape;
    for (const key of Object.keys(shape)) {
      expect(key.startsWith('eventrix_')).toBe(false);
    }
  });
});
