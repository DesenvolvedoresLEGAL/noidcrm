// NOID-VERTICAL-1.0-VERT-02.1
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_IDS,
  CANONICAL_CAPABILITY_IDS,
  isCanonicalCapabilityId,
} from '../capabilities';
import { capabilityIdSchema, parseCapabilityId } from '../ids';

const CANONICAL_LIST = [
  'inventory.product_requirements',
  'inventory.proposal_demand',
  'inventory.equipment_profiles',
  'roleplay.archetype_types',
  'proposal.vertical_sections',
  'pricing.vertical_rules',
  'opportunity.handoff_extensions',
  'academy.vertical_content',
  'operations.vertical_workflows',
  'ai.vertical_context',
  'navigation.vertical_entries',
  'forms.vertical_fields',
  'reports.vertical_metrics',
  'automation.vertical_triggers',
  'import_export.vertical_bindings',
] as const;

describe('canonical capability catalog', () => {
  it('contains exactly 15 ids', () => {
    expect(Object.keys(CAPABILITY_IDS)).toHaveLength(15);
    expect(CANONICAL_CAPABILITY_IDS).toHaveLength(15);
  });

  it('every id passes capabilityIdSchema', () => {
    for (const id of CANONICAL_CAPABILITY_IDS) {
      expect(capabilityIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it('has zero duplicates', () => {
    const set = new Set(CANONICAL_CAPABILITY_IDS as readonly string[]);
    expect(set.size).toBe(CANONICAL_CAPABILITY_IDS.length);
  });

  it('every id has exactly two lowercase [a-z0-9_] segments', () => {
    for (const id of CANONICAL_CAPABILITY_IDS) {
      expect(id).toMatch(/^[a-z0-9_]+\.[a-z0-9_]+$/);
      expect(id.split('.')).toHaveLength(2);
    }
  });

  it('matches the frozen v1 list', () => {
    expect([...CANONICAL_CAPABILITY_IDS].sort()).toEqual(
      [...CANONICAL_LIST].sort(),
    );
  });

  it('map and collection are frozen', () => {
    expect(Object.isFrozen(CAPABILITY_IDS)).toBe(true);
    expect(Object.isFrozen(CANONICAL_CAPABILITY_IDS)).toBe(true);
  });

  it('no id encodes version or tenant identity', () => {
    for (const id of CANONICAL_CAPABILITY_IDS) {
      expect(id).not.toMatch(/v\d+/);
      expect(id).not.toMatch(/tenant|org|client/);
    }
  });

  it('CANONICAL_CAPABILITY_IDS is derived from CAPABILITY_IDS (single source)', () => {
    const fromMap = Object.values(CAPABILITY_IDS).sort();
    const fromList = [...CANONICAL_CAPABILITY_IDS].sort();
    expect(fromMap).toEqual(fromList);
  });

  it('isCanonicalCapabilityId reflects membership', () => {
    expect(isCanonicalCapabilityId(CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS)).toBe(true);
    expect(isCanonicalCapabilityId(parseCapabilityId('unknown.capability'))).toBe(false);
  });
});
