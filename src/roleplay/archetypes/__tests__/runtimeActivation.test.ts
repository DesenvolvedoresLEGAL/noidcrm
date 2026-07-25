/**
 * VERT-01.4B2 — runtime activation proofs.
 *
 * Confirms that the generic ClientArchetypeType is active in the runtime
 * schema and that the Events Vertical Pack strict schema is preserved.
 */
import { describe, it, expect } from 'vitest';
import { archetypeSchema } from '@/schemas/roleplay';
import {
  EVENTS_ARCHETYPE_TYPES,
  eventsArchetypeSchema,
} from '@/vertical-packs/events/roleplay';

const validBase = {
  name: 'Comprador Estratégico',
  type: 'Diretor de TI',
  level: 'Avançado' as const,
  tone_style: 'técnico' as const,
  decision_role: 'Decisor' as const,
  complexity_score: 4,
  min_message_exchanges: 20,
  objection_set: ['preço'],
};

describe('Runtime archetypeSchema — generic type', () => {
  it('accepts synthetic non-Events type (Diretor de TI)', () => {
    expect(archetypeSchema.safeParse(validBase).success).toBe(true);
  });

  it('accepts synthetic non-Events type (Comprador Técnico)', () => {
    expect(archetypeSchema.safeParse({ ...validBase, type: 'Comprador Técnico' }).success).toBe(true);
  });

  it.each([...EVENTS_ARCHETYPE_TYPES])('still accepts Events type %s', (t) => {
    expect(archetypeSchema.safeParse({ ...validBase, type: t }).success).toBe(true);
  });

  it('trims type', () => {
    const r = archetypeSchema.safeParse({ ...validBase, type: '  CFO  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe('CFO');
  });

  it('rejects empty type', () => {
    expect(archetypeSchema.safeParse({ ...validBase, type: '' }).success).toBe(false);
  });

  it('rejects single-char type', () => {
    expect(archetypeSchema.safeParse({ ...validBase, type: 'X' }).success).toBe(false);
  });

  it('rejects >60 char type', () => {
    expect(archetypeSchema.safeParse({ ...validBase, type: 'x'.repeat(61) }).success).toBe(false);
  });

  it('preserves level enum', () => {
    expect(archetypeSchema.safeParse({ ...validBase, level: 'Custom' as any }).success).toBe(false);
  });

  it('preserves tone_style enum', () => {
    expect(archetypeSchema.safeParse({ ...validBase, tone_style: 'zen' as any }).success).toBe(false);
  });

  it('preserves decision_role enum', () => {
    expect(archetypeSchema.safeParse({ ...validBase, decision_role: 'Observador' as any }).success).toBe(false);
  });

  it('preserves complexity bounds', () => {
    expect(archetypeSchema.safeParse({ ...validBase, complexity_score: 6 }).success).toBe(false);
  });

  it('preserves min_message_exchanges bounds', () => {
    expect(archetypeSchema.safeParse({ ...validBase, min_message_exchanges: 5 }).success).toBe(false);
    expect(archetypeSchema.safeParse({ ...validBase, min_message_exchanges: 500 }).success).toBe(false);
  });
});

describe('Events strict schema isolation', () => {
  it('rejects non-Events type (Diretor de TI)', () => {
    expect(eventsArchetypeSchema.safeParse(validBase).success).toBe(false);
  });
  it.each([...EVENTS_ARCHETYPE_TYPES])('accepts Events type %s', (t) => {
    expect(eventsArchetypeSchema.safeParse({ ...validBase, type: t }).success).toBe(true);
  });
});
