/**
 * Events Vertical Pack — Roleplay archetype schema composition.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.4A.
 *
 * Direction rule: Events → Core factory. The Core never imports this file.
 */
import { createArchetypeSchema } from '@/roleplay/archetypes';
import { EVENTS_ARCHETYPE_TYPES } from './archetypeTypes';

/**
 * Archetype schema constrained to the four canonical Events archetype types.
 * Consumers in the Events composition layer should prefer this over
 * reconstructing the enum inline.
 */
export const eventsArchetypeSchema = createArchetypeSchema({
  allowedTypes: EVENTS_ARCHETYPE_TYPES,
  invalidTypeMessage: 'Tipo de arquétipo não pertence ao Pack de Eventos',
});
