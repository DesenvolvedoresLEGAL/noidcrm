// NOID-VERTICAL-1.0-VERT-01.2D-A
import { describe, expect, it } from 'vitest';
import {
  EventrixInventoryProvider,
  NativeInventoryProvider,
} from '@/inventory/providers';
import {
  InventoryDemandNormalizationError,
  normalizeProductInventoryRequirement,
  normalizeProductInventoryRequirements,
} from '@/inventory/demand';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';

function makeReq(
  overrides: Partial<ProductInventoryRequirement> = {},
): ProductInventoryRequirement {
  return {
    id: 'req-1',
    organization_id: 'org-1',
    product_id: 'prod-1',
    label: 'Ponto de venda',
    eventrix_category_id: 'cat-1',
    eventrix_category_name: 'Categoria 1',
    eventrix_family_id: 'fam-1',
    eventrix_family_name: 'Família 1',
    eventrix_item_kind: 'serialized',
    quantity: 2,
    unit_basis: 'per_point',
    is_required: true,
    notes: null,
    sort_order: 0,
    is_active: true,
    metadata: {},
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as ProductInventoryRequirement;
}

describe('VERT-01.2D-A · normalizeProductInventoryRequirement', () => {
  it('1. normaliza requisito Eventrix legado para referência genérica', () => {
    const n = normalizeProductInventoryRequirement(makeReq());
    expect(n).not.toBeNull();
    expect(n!.category_ref).toBe('cat-1');
    expect(n!.family_ref).toBe('fam-1');
    expect(n!.unit_basis).toBe('per_point');
  });

  it('2. preserva category id e nome', () => {
    const n = normalizeProductInventoryRequirement(
      makeReq({
        eventrix_category_id: 'cat-x',
        eventrix_category_name: 'Categoria X',
      }),
    );
    expect(n!.category_ref).toBe('cat-x');
    expect(n!.category_name).toBe('Categoria X');
  });

  it('3. preserva family id e nome', () => {
    const n = normalizeProductInventoryRequirement(
      makeReq({
        eventrix_family_id: 'fam-x',
        eventrix_family_name: 'Família X',
      }),
    );
    expect(n!.family_ref).toBe('fam-x');
    expect(n!.family_name).toBe('Família X');
  });

  it('4. preserva item_kind', () => {
    const a = normalizeProductInventoryRequirement(
      makeReq({ eventrix_item_kind: 'quantity' }),
    );
    expect(a!.item_kind).toBe('quantity');
    const b = normalizeProductInventoryRequirement(
      makeReq({ eventrix_item_kind: null }),
    );
    expect(b!.item_kind).toBeNull();
  });

  it('5. provider_type default é eventrix', () => {
    const n = normalizeProductInventoryRequirement(makeReq());
    expect(n!.provider_type).toBe('eventrix');
  });

  it('6. não cria IMEI/ICCID/SSID/WiFi', () => {
    const n = normalizeProductInventoryRequirement(makeReq());
    const serialized = JSON.stringify(n);
    expect(serialized.toLowerCase()).not.toMatch(/imei|iccid|ssid|wifi/);
  });

  it('7. requisito inválido retorna resultado controlado (strict=false)', () => {
    const invalid = normalizeProductInventoryRequirement(
      makeReq({ eventrix_family_id: '' as any }),
      { strict: false },
    );
    expect(invalid).toBeNull();
  });

  it('7b. requisito inválido em modo strict lança erro tipado', () => {
    expect(() =>
      normalizeProductInventoryRequirement(
        makeReq({ eventrix_category_id: '' as any }),
      ),
    ).toThrow(InventoryDemandNormalizationError);
  });

  it('7c. quantity inválida também é capturada', () => {
    const res = normalizeProductInventoryRequirements([
      makeReq({ id: 'r-ok' }),
      makeReq({ id: 'r-bad', quantity: 0 as any }),
    ]);
    expect(res.normalized).toHaveLength(1);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].requirement_id).toBe('r-bad');
  });
});

describe('VERT-01.2D-A · adapter capabilities', () => {
  it('8. Eventrix declara proposal_demand', () => {
    const p = new EventrixInventoryProvider();
    expect(p.hasCapability('proposal_demand')).toBe(true);
    expect(p.getCapabilities()).toEqual(
      expect.arrayContaining([
        'categories',
        'families',
        'product_requirements',
        'proposal_demand',
      ]),
    );
  });

  it('9. Native NÃO declara proposal_demand (nem outras capabilities)', () => {
    const p = new NativeInventoryProvider();
    expect(p.hasCapability('proposal_demand')).toBe(false);
    expect(p.hasCapability('categories')).toBe(false);
    expect(p.hasCapability('families')).toBe(false);
    expect(p.hasCapability('product_requirements')).toBe(false);
    expect(p.getCapabilities()).toEqual([]);
  });
});

describe('VERT-01.2D-A · universal types shape', () => {
  it('10. o objeto normalizado NÃO expõe propriedades com prefixo eventrix_', () => {
    const n = normalizeProductInventoryRequirement(makeReq());
    const keys = Object.keys(n!);
    expect(keys.some((k) => k.startsWith('eventrix_'))).toBe(false);
    // Sanity: campos genéricos obrigatórios estão presentes.
    expect(keys).toEqual(
      expect.arrayContaining([
        'provider_type',
        'category_ref',
        'category_name',
        'family_ref',
        'family_name',
        'item_kind',
        'unit_basis',
        'quantity',
      ]),
    );
  });
});
