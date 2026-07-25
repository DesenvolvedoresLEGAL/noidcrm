import { describe, it, expect } from 'vitest';
import {
  clientArchetypeTypeSchema,
  baseArchetypeSchema,
  createArchetypeSchema,
} from '@/roleplay/archetypes';
import { archetypeSchema } from '@/schemas/roleplay';
import {
  EVENTS_ARCHETYPE_TYPES,
  EVENTS_ARCHETYPE_TYPE_OPTIONS,
  eventsArchetypeSchema,
  isEventsArchetypeType,
} from '@/vertical-packs/events/roleplay';

const validBase = {
  name: 'Comprador Estratégico',
  type: 'Diretor de TI',
  level: 'Avançado',
  tone_style: 'técnico',
  decision_role: 'Decisor',
  complexity_score: 4,
  min_message_exchanges: 20,
  objection_set: ['preço'],
};

describe('Core generic archetype type', () => {
  it('accepts a well-formed string', () => {
    expect(clientArchetypeTypeSchema.safeParse('CFO').success).toBe(true);
  });
  it('rejects empty', () => {
    expect(clientArchetypeTypeSchema.safeParse('').success).toBe(false);
  });
  it('trims input', () => {
    expect(clientArchetypeTypeSchema.parse('  CFO  ')).toBe('CFO');
  });
  it('rejects excessive length', () => {
    expect(clientArchetypeTypeSchema.safeParse('x'.repeat(200)).success).toBe(false);
  });
  it('base schema accepts a generic type', () => {
    expect(baseArchetypeSchema.safeParse(validBase).success).toBe(true);
  });
  it('base schema does NOT hardcode Events literals', () => {
    // Any well-formed string is acceptable at Core level.
    expect(baseArchetypeSchema.safeParse({ ...validBase, type: 'Head de Operações' }).success).toBe(true);
  });
});

describe('createArchetypeSchema factory', () => {
  it('without allowedTypes accepts external values', () => {
    const s = createArchetypeSchema();
    expect(s.safeParse({ ...validBase, type: 'Procurement' }).success).toBe(true);
  });
  it('with allowedTypes restricts', () => {
    const s = createArchetypeSchema({ allowedTypes: ['A', 'B'] });
    expect(s.safeParse({ ...validBase, type: 'A' }).success).toBe(true);
    expect(s.safeParse({ ...validBase, type: 'C' }).success).toBe(false);
  });
  it('uses controlled error message', () => {
    const s = createArchetypeSchema({ allowedTypes: ['A'], invalidTypeMessage: 'MSG' });
    const r = s.safeParse({ ...validBase, type: 'X' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.message === 'MSG')).toBe(true);
  });
});

describe('Events Vertical Pack', () => {
  it('contains the four canonical values', () => {
    expect([...EVENTS_ARCHETYPE_TYPES]).toEqual(['Organizador', 'Expositor', 'Agência', 'Empresa Contratante']);
  });
  it('has no duplicates', () => {
    expect(new Set(EVENTS_ARCHETYPE_TYPES).size).toBe(EVENTS_ARCHETYPE_TYPES.length);
  });
  it('derives options from canonical source', () => {
    expect(EVENTS_ARCHETYPE_TYPE_OPTIONS.map((o) => o.value)).toEqual([...EVENTS_ARCHETYPE_TYPES]);
  });
  it('type guard works', () => {
    expect(isEventsArchetypeType('Expositor')).toBe(true);
    expect(isEventsArchetypeType('CFO')).toBe(false);
  });
  it('events schema accepts all four', () => {
    for (const t of EVENTS_ARCHETYPE_TYPES) {
      expect(eventsArchetypeSchema.safeParse({ ...validBase, type: t }).success).toBe(true);
    }
  });
  it('events schema rejects external values', () => {
    expect(eventsArchetypeSchema.safeParse({ ...validBase, type: 'CFO' }).success).toBe(false);
  });
});

describe('Legacy archetypeSchema regression', () => {
  it.each(['Organizador', 'Expositor', 'Agência', 'Empresa Contratante'])('accepts %s', (t) => {
    expect(archetypeSchema.safeParse({ ...validBase, type: t }).success).toBe(true);
  });
  it('still rejects values outside the four', () => {
    expect(archetypeSchema.safeParse({ ...validBase, type: 'CFO' }).success).toBe(false);
  });
});
