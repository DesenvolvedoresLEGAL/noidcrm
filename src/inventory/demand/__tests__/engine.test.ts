// NOID-VERTICAL-1.0-VERT-01.2D-B
import { describe, expect, it } from 'vitest';
import {
  buildInventoryDemandPreview,
  buildInventoryDemandSourceProducts,
  buildInventoryDemandSourceRequirements,
  compareInventoryDemand,
  computeInventoryDemandHash,
  INVENTORY_DEMAND_ALGORITHM_VERSION,
  INVENTORY_DEMAND_SCHEMA_VERSION,
  normalizeInventoryDemandSnapshot,
  normalizeProductInventoryRequirements,
  resolveInventoryDemandCommercialContext,
  serializeInventoryDemandSnapshotV2,
  type NormalizedProductInventoryRequirement,
} from '@/inventory/demand';
import {
  buildProposalInventoryDemandPreview,
  type ProposalInventoryDemandInputItem,
  type ProposalInventoryDemandInputProposal,
} from '@/lib/proposals/inventoryDemandPreview';
import {
  buildSourceProducts,
  buildSourceRequirements,
  comparePreviewToSnapshot,
  computePreviewHash,
} from '@/lib/proposals/inventoryDemandSnapshot';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';

function makeReq(o: Partial<NormalizedProductInventoryRequirement> = {}): NormalizedProductInventoryRequirement {
  return {
    provider_type: 'eventrix',
    category_ref: 'cat-1',
    category_name: 'Categoria 1',
    family_ref: 'fam-1',
    family_name: 'Família 1',
    item_kind: 'serialized',
    requirement_id: 'req-1',
    product_id: 'prod-1',
    label: 'Ponto',
    quantity: 2,
    unit_basis: 'per_point',
    is_required: true,
    notes: null,
    sort_order: 0,
    is_active: true,
    ...o,
  };
}

function makeLegacyReq(o: Partial<ProductInventoryRequirement> = {}): ProductInventoryRequirement {
  return {
    id: 'req-1',
    organization_id: 'org-1',
    product_id: 'prod-1',
    label: 'Ponto',
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
    created_at: 't',
    updated_at: 't',
    ...o,
  } as ProductInventoryRequirement;
}

const proposal: ProposalInventoryDemandInputProposal = {
  id: 'p-1',
  organization_id: 'org-1',
  points: 10,
  days: 3,
};
const item = (o: Partial<ProposalInventoryDemandInputItem> = {}): ProposalInventoryDemandInputItem => ({
  id: 'it-1',
  product_id: 'prod-1',
  name: 'Produto',
  quantity: 1,
  ...o,
});

describe('VERT-01.2D-B · builder genérico — regras de cálculo', () => {
  it('1. per_point mantém resultado legado', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_point', quantity: 2 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.status).toBe('ready');
    expect(g.lines[0].required_quantity).toBe(20);
    expect(g.lines[0].calculation_label).toBe('2 × 10 pontos');
  });

  it('2. per_event mantém resultado legado', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_event', quantity: 4 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines[0].required_quantity).toBe(4);
  });

  it('3. per_day mantém resultado legado', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_day', quantity: 5 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines[0].required_quantity).toBe(15);
  });

  it('4-5. per_participant: presente calcula / ausente incompleto', () => {
    const withP = buildInventoryDemandPreview({
      proposal: { ...proposal, participant_count: 100 },
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_participant', quantity: 1 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(withP.status).toBe('ready');
    expect(withP.lines[0].required_quantity).toBe(100);

    const noP = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_participant', quantity: 1 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(noP.status).toBe('incomplete');
    expect(noP.lines[0].status).toBe('incomplete');
    expect(noP.warnings.join(' ')).toMatch(/participante/);
  });

  it('6. per_unit mantém resultado legado', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item({ quantity: 3 })],
      requirements: [makeReq({ unit_basis: 'per_unit', quantity: 2 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines[0].required_quantity).toBe(6);
  });

  it('7. manual mantém status manual', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'manual', quantity: 1 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines[0].status).toBe('manual');
    expect(g.lines[0].required_quantity).toBeNull();
  });

  it('8-11. inferência de pontos e dias', () => {
    const ctx = resolveInventoryDemandCommercialContext(
      { points: 5, point_count: 99 },
      [],
    );
    expect(ctx.points).toBe(5);
    const inferred = resolveInventoryDemandCommercialContext(
      {},
      [{ product_id: 'x', billing_type: 'point_day', quantity_points: 7, billing_days: 4 }],
    );
    expect(inferred.points).toBe(7);
    expect(inferred.days).toBe(4);
  });

  it('12. dias calculados por datas quando ausentes', () => {
    const ctx = resolveInventoryDemandCommercialContext(
      { event_start_date: '2026-01-01', event_end_date: '2026-01-03' },
      [],
    );
    expect(ctx.days).toBe(3);
  });

  it('13. quantidade padrão do produto é 1', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [{ product_id: 'prod-1' }],
      requirements: [makeReq({ unit_basis: 'per_unit', quantity: 4 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines[0].required_quantity).toBe(4);
  });

  it('14. required e optional permanecem separados', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [
        makeReq({ unit_basis: 'per_event', quantity: 1, is_required: true, family_ref: 'f-a', family_name: 'A' }),
        makeReq({ requirement_id: 'r2', unit_basis: 'per_event', quantity: 1, is_required: false, family_ref: 'f-b', family_name: 'B' }),
      ],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.totals.requiredFamilies).toBe(1);
    expect(g.totals.optionalFamilies).toBe(1);
    expect(g.lines[0].is_required).toBe(true);
  });

  it('15-16. warnings e totais preservados', () => {
    const g = buildInventoryDemandPreview({
      proposal: {},
      proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_point', quantity: 2 })],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.totals.totalRequiredUnits).toBe(2); // effective=1
  });

  it('17. agrupamento por provider|category|family|unit|required', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item(), item({ id: 'it-2', product_id: 'prod-2' })],
      requirements: [
        makeReq({ unit_basis: 'per_event', quantity: 1 }),
        makeReq({ requirement_id: 'r2', product_id: 'prod-2', unit_basis: 'per_event', quantity: 3 }),
      ],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines).toHaveLength(1);
    expect(g.lines[0].required_quantity).toBe(4);
    expect(g.lines[0].source_products).toHaveLength(2);
  });

  it('18. providers diferentes não agrupam', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [
        makeReq({ unit_basis: 'per_event', quantity: 1 }),
        makeReq({ requirement_id: 'r2', provider_type: 'native', unit_basis: 'per_event', quantity: 1 }),
      ],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    // Requisito native é filtrado (não pertence ao provider ativo)
    expect(g.lines).toHaveLength(1);
  });

  it('19. ordenação usa family_name', () => {
    const g = buildInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      requirements: [
        makeReq({ requirement_id: 'z', family_ref: 'z', family_name: 'Zeta', unit_basis: 'per_event', quantity: 1 }),
        makeReq({ requirement_id: 'a', family_ref: 'a', family_name: 'Alpha', unit_basis: 'per_event', quantity: 1 }),
      ],
      providerType: 'eventrix',
      supportsProposalDemand: true,
    });
    expect(g.lines.map((l) => l.family_name)).toEqual(['Alpha', 'Zeta']);
  });

  it('20-21. Eventrix suportado / Native unsupported', () => {
    const ev = buildInventoryDemandPreview({
      proposal, proposalItems: [item()],
      requirements: [makeReq()],
      providerType: 'eventrix', supportsProposalDemand: true,
    });
    expect(ev.status).toBe('ready');
    const na = buildInventoryDemandPreview({
      proposal, proposalItems: [item()],
      requirements: [],
      providerType: 'native', supportsProposalDemand: false,
    });
    expect(na.status).toBe('unsupported');
    expect(na.lines).toHaveLength(0);
    expect(na.warnings.length).toBeGreaterThan(0);
  });

  it('22. empty difere de unsupported', () => {
    const empty = buildInventoryDemandPreview({
      proposal, proposalItems: [], requirements: [],
      providerType: 'eventrix', supportsProposalDemand: true,
    });
    expect(empty.status).toBe('empty');
  });

  it('23. wrapper legado retorna equivalente ao builder genérico', () => {
    const legacy = buildProposalInventoryDemandPreview({
      proposal,
      proposalItems: [item()],
      productRequirements: [makeLegacyReq()],
    });
    expect(legacy.status).toBe('ready');
    expect(legacy.lines[0].eventrix_category_id).toBe('cat-1');
    expect(legacy.lines[0].required_quantity).toBe(20);
    expect(legacy.payload.requirements[0].eventrix_family_id).toBe('fam-1');
  });
});

describe('VERT-01.2D-B · snapshot v2 serializer', () => {
  const preview = buildInventoryDemandPreview({
    proposal,
    proposalItems: [item()],
    requirements: [makeReq({ unit_basis: 'per_event', quantity: 3 })],
    providerType: 'eventrix',
    supportsProposalDemand: true,
  });
  const sp = buildInventoryDemandSourceProducts(preview, [item()]);
  const sr = buildInventoryDemandSourceRequirements(preview, [makeReq({ unit_basis: 'per_event', quantity: 3 })]);
  const snap = serializeInventoryDemandSnapshotV2({
    preview, sourceProducts: sp, sourceRequirements: sr,
    hash: computeInventoryDemandHash(preview),
  });

  it('24-25. schema_version=2 e algorithm_version', () => {
    expect(snap.schema_version).toBe(INVENTORY_DEMAND_SCHEMA_VERSION);
    expect(snap.algorithm_version).toBe(INVENTORY_DEMAND_ALGORITHM_VERSION);
  });

  it('26. linhas usam campos genéricos', () => {
    expect(snap.lines[0].category_ref).toBe('cat-1');
    expect(snap.lines[0].family_ref).toBe('fam-1');
  });

  it('27. Eventrix recebe aliases legados', () => {
    expect(snap.lines[0].eventrix_category_id).toBe('cat-1');
    expect(snap.lines[0].eventrix_family_id).toBe('fam-1');
    expect(snap.source_requirements[0].eventrix_family_id).toBe('fam-1');
  });

  it('28. Native não recebe aliases Eventrix', () => {
    const nativePreview = buildInventoryDemandPreview({
      proposal, proposalItems: [item()],
      requirements: [makeReq({ provider_type: 'native', unit_basis: 'per_event', quantity: 1 })],
      providerType: 'native', supportsProposalDemand: true,
    });
    const nsnap = serializeInventoryDemandSnapshotV2({
      preview: nativePreview,
      sourceProducts: [], sourceRequirements: [],
      hash: 'h0',
    });
    for (const l of nsnap.lines) {
      expect(l.eventrix_category_id).toBeUndefined();
      expect(l.eventrix_family_id).toBeUndefined();
    }
  });

  it('29. aliases refletem campos genéricos', () => {
    expect(snap.lines[0].eventrix_category_id).toBe(snap.lines[0].category_ref);
    expect(snap.lines[0].eventrix_family_id).toBe(snap.lines[0].family_ref);
  });

  it('30-31. source requirements v2 genéricos + aliases Eventrix', () => {
    expect(snap.source_requirements[0].category_ref).toBe('cat-1');
    expect(snap.source_requirements[0].eventrix_category_id).toBe('cat-1');
  });

  it('32. snapshot unsupported não é calculated', () => {
    const un = buildInventoryDemandPreview({
      proposal, proposalItems: [item()], requirements: [],
      providerType: 'native', supportsProposalDemand: false,
    });
    const snapUn = serializeInventoryDemandSnapshotV2({
      preview: un, sourceProducts: [], sourceRequirements: [], hash: 'h',
    });
    expect(snapUn.status).toBe('unsupported');
    expect(snapUn.lines).toHaveLength(0);
  });

  it('33. serializer não muta preview original', () => {
    const before = JSON.stringify(preview);
    serializeInventoryDemandSnapshotV2({
      preview, sourceProducts: sp, sourceRequirements: sr, hash: 'x',
    });
    expect(JSON.stringify(preview)).toBe(before);
  });
});

describe('VERT-01.2D-B · reader v1/v2', () => {
  const v1 = {
    summary: { required_families: 1, total_required_units: 3 },
    payload: { commercial_context: { points: 10, days: 3, participants: null } },
    lines: [
      {
        key: 'k',
        eventrix_category_id: 'cat-1',
        eventrix_category_name: 'Cat',
        eventrix_family_id: 'fam-1',
        eventrix_family_name: 'Fam',
        eventrix_item_kind: 'serialized',
        unit_basis: 'per_event',
        is_required: true,
        required_quantity: 3,
        requirement_quantity: 3,
        calculation_label: '3 fixo',
        status: 'calculated',
        source_products: [],
      },
    ],
    warnings: [],
    commercial_context: { points: 10, days: 3, participants: null },
    source_products: [],
    source_requirements: [
      {
        eventrix_category_id: 'cat-1',
        eventrix_category_name: 'Cat',
        eventrix_family_id: 'fam-1',
        eventrix_family_name: 'Fam',
        eventrix_item_kind: 'serialized',
        unit_basis: 'per_event',
        is_required: true,
        quantity: 3,
      },
    ],
    hash: 'hxxx',
  };

  it('34-35. snapshot v1 normalizado + provider Eventrix', () => {
    const n = normalizeInventoryDemandSnapshot(v1);
    expect(n.schema_version).toBe(1);
    expect(n.provider_type).toBe('eventrix');
    expect(n.lines[0].category_ref).toBe('cat-1');
    expect(n.lines[0].family_ref).toBe('fam-1');
  });

  it('36. snapshot v2 normalizado', () => {
    const v2 = {
      ...v1,
      payload: { ...v1.payload, schema_version: 2, provider_type: 'eventrix' },
      lines: [
        {
          key: 'k',
          provider_type: 'eventrix',
          category_ref: 'cat-1',
          category_name: 'Cat',
          family_ref: 'fam-1',
          family_name: 'Fam',
          item_kind: 'serialized',
          unit_basis: 'per_event',
          is_required: true,
          required_quantity: 3,
          requirement_quantity: 3,
          calculation_label: '3 fixo',
          status: 'calculated',
          source_products: [],
        },
      ],
    };
    const n = normalizeInventoryDemandSnapshot(v2);
    expect(n.schema_version).toBe(2);
    expect(n.lines[0].category_ref).toBe('cat-1');
  });

  it('37. híbrido prefere genérico', () => {
    const hybrid = JSON.parse(JSON.stringify(v1));
    hybrid.payload.schema_version = 2;
    hybrid.lines[0].category_ref = 'cat-GEN';
    hybrid.lines[0].family_ref = 'fam-GEN';
    const n = normalizeInventoryDemandSnapshot(hybrid);
    expect(n.lines[0].category_ref).toBe('cat-GEN');
    expect(n.lines[0].family_ref).toBe('fam-GEN');
  });

  it('38. malformado retorna controlado', () => {
    const n = normalizeInventoryDemandSnapshot(null);
    expect(n.valid).toBe(false);
    expect(n.error_code).toBe('malformed');
    expect(n.lines).toEqual([]);
  });

  it('39. reader não altera objeto original', () => {
    const before = JSON.stringify(v1);
    normalizeInventoryDemandSnapshot(v1);
    expect(JSON.stringify(v1)).toBe(before);
  });
});

describe('VERT-01.2D-B · compare + hash', () => {
  const preview = buildInventoryDemandPreview({
    proposal,
    proposalItems: [item()],
    requirements: [makeReq({ unit_basis: 'per_event', quantity: 3 })],
    providerType: 'eventrix',
    supportsProposalDemand: true,
  });

  it('41-42. preview v2 e snapshot v1 equivalente = aligned', () => {
    const snap = serializeInventoryDemandSnapshotV2({
      preview,
      sourceProducts: [],
      sourceRequirements: buildInventoryDemandSourceRequirements(preview, [makeReq({ unit_basis: 'per_event', quantity: 3 })]),
      hash: computeInventoryDemandHash(preview),
    });
    expect(compareInventoryDemand(preview, snap)).toBe('aligned');
  });

  it('43-44. aliases Eventrix não alteram compare/hash', () => {
    const hashA = computeInventoryDemandHash(preview);
    // clonando via serializer que adiciona aliases
    const snap = serializeInventoryDemandSnapshotV2({
      preview,
      sourceProducts: [],
      sourceRequirements: [],
      hash: hashA,
    });
    expect(compareInventoryDemand(preview, snap)).toBe('aligned');
  });

  it('48-52. mudanças materiais retornam changed', () => {
    const diffProvider = buildInventoryDemandPreview({
      proposal, proposalItems: [item()],
      requirements: [makeReq({ provider_type: 'native', unit_basis: 'per_event', quantity: 3 })],
      providerType: 'native', supportsProposalDemand: true,
    });
    expect(compareInventoryDemand(diffProvider, preview.payload)).toBe('changed');

    const diffQty = buildInventoryDemandPreview({
      proposal, proposalItems: [item()],
      requirements: [makeReq({ unit_basis: 'per_event', quantity: 99 })],
      providerType: 'eventrix', supportsProposalDemand: true,
    });
    expect(compareInventoryDemand(diffQty, preview)).toBe('changed');
  });

  it('54-55. hash determinístico e explícito não-criptográfico', () => {
    const h1 = computeInventoryDemandHash(preview);
    const h2 = computeInventoryDemandHash(preview);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^h[0-9a-f]+$/);
  });
});

describe('VERT-01.2D-B · source products/requirements', () => {
  it('56-60. matching genérico + preservação de proposal_item/quantidade', () => {
    const preview = buildInventoryDemandPreview({
      proposal, proposalItems: [item({ quantity: 5 })],
      requirements: [makeReq({ unit_basis: 'per_event', quantity: 1 })],
      providerType: 'eventrix', supportsProposalDemand: true,
    });
    const sp = buildInventoryDemandSourceProducts(preview, [item({ quantity: 5 })]);
    expect(sp[0].quantity).toBe(5);
    expect(sp[0].proposal_item_id).toBe('it-1');

    const sr = buildInventoryDemandSourceRequirements(preview, [
      makeReq({ unit_basis: 'per_event', quantity: 1 }),
      makeReq({ requirement_id: 'r-other', unit_basis: 'per_day', quantity: 1 }), // unit_basis diferente
      makeReq({ requirement_id: 'r-native', provider_type: 'native', unit_basis: 'per_event', quantity: 1 }), // provider diferente
    ]);
    expect(sr).toHaveLength(1);
    expect(sr[0].requirement_id).toBe('req-1');
  });
});

describe('VERT-01.2D-B · legacy bridge (snapshot lib)', () => {
  it('legacy comparePreviewToSnapshot/computePreviewHash delegam para genérico', () => {
    const legacy = buildProposalInventoryDemandPreview({
      proposal, proposalItems: [item()],
      productRequirements: [makeLegacyReq()],
    });
    const sp = buildSourceProducts(legacy, [item()]);
    expect(sp[0].product_id).toBe('prod-1');
    const sr = buildSourceRequirements(legacy, [makeLegacyReq()]);
    expect(sr[0].eventrix_category_id).toBe('cat-1');
    expect(computePreviewHash(legacy)).toMatch(/^h/);
    expect(comparePreviewToSnapshot(legacy, null)).toBe('no_snapshot');
  });
});
