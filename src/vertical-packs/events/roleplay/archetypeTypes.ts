/**
 * Events Vertical Pack — canonical Roleplay archetype types.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.4A.
 *
 * These four values represent the EVENTS market (feiras, congressos, ativações).
 * They are NOT universal Core concepts. Any consumer that needs the "events
 * archetype types" list MUST import from here — never redeclare the union.
 *
 * Physical storage note: the Postgres enum `public.client_type` currently
 * enumerates these same four values. Aligning the runtime code with this Pack
 * boundary is prerequisite work for eventually converting the DB constraint
 * into a Pack-seeded lookup (VERT-01.4B and beyond).
 */

/** Canonical, ordered list of Events archetype types. Do not mutate. */
export const EVENTS_ARCHETYPE_TYPES = [
  'Organizador',
  'Expositor',
  'Agência',
  'Empresa Contratante',
] as const;

/** Derived union type. Never duplicate this union manually. */
export type EventsArchetypeType = typeof EVENTS_ARCHETYPE_TYPES[number];

export const EVENTS_ARCHETYPE_TYPE_LABELS: Record<EventsArchetypeType, string> = {
  Organizador: 'Organizador',
  Expositor: 'Expositor',
  Agência: 'Agência',
  'Empresa Contratante': 'Empresa Contratante',
};

export const EVENTS_ARCHETYPE_TYPE_OPTIONS: ReadonlyArray<{
  value: EventsArchetypeType;
  label: string;
}> = EVENTS_ARCHETYPE_TYPES.map((value) => ({
  value,
  label: EVENTS_ARCHETYPE_TYPE_LABELS[value],
}));

export function isEventsArchetypeType(value: unknown): value is EventsArchetypeType {
  return typeof value === 'string' && (EVENTS_ARCHETYPE_TYPES as readonly string[]).includes(value);
}
