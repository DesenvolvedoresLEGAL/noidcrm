/**
 * Core Universal — generic Roleplay Archetype validation.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.4A.
 *
 * This module owns the generic contract. It has ZERO knowledge of Events
 * literals (Organizador / Expositor / Agência / Empresa Contratante). Vertical
 * Packs compose a strict schema by passing `allowedTypes` to the factory.
 *
 * Core MUST NEVER import from `@/vertical-packs/**`.
 */
import { z } from 'zod';

/** Reasonable length bounds for a free-form archetype type identifier. */
export const CLIENT_ARCHETYPE_TYPE_MIN = 2;
export const CLIENT_ARCHETYPE_TYPE_MAX = 60;

/**
 * Generic archetype-type validator. Accepts any non-empty, trimmed string
 * inside the reasonable bounds — the allowed value set is a Pack/tenant
 * concern, not a Core concern.
 */
export const clientArchetypeTypeSchema = z
  .string()
  .trim()
  .min(CLIENT_ARCHETYPE_TYPE_MIN, 'Tipo deve ter no mínimo 2 caracteres')
  .max(CLIENT_ARCHETYPE_TYPE_MAX, 'Tipo excede o tamanho máximo permitido');

/**
 * Base archetype schema — the universal shape. `type` is the generic
 * `clientArchetypeTypeSchema` here; use `createArchetypeSchema` to constrain
 * it to a Pack-owned value set.
 */
export const baseArchetypeSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  type: clientArchetypeTypeSchema,
  // Kept as generic strings at Core level. The legacy schema layer applies
  // stricter enums for backwards runtime compatibility (see docs).
  level: z.string().min(1, 'Nível é obrigatório'),
  tone_style: z.string().min(1, 'Tom é obrigatório'),
  decision_role: z.string().min(1, 'Papel de decisão é obrigatório'),
  complexity_score: z.number().min(1).max(5),
  min_message_exchanges: z.number().min(10).max(200),
  objection_set: z.array(z.string()).min(1, 'Adicione pelo menos 1 objeção'),
});

export interface CreateArchetypeSchemaOptions {
  /**
   * When provided, `type` is restricted to exactly this list. When omitted,
   * the generic Core contract applies and any well-formed string is valid.
   */
  allowedTypes?: readonly string[];
  /** Custom error message when `allowedTypes` rejects a value. */
  invalidTypeMessage?: string;
}

/**
 * Compose an archetype schema. Vertical Packs pass their canonical types to
 * lock the `type` field down; the Core never hardcodes any Pack literals.
 */
export function createArchetypeSchema(options: CreateArchetypeSchemaOptions = {}) {
  const { allowedTypes, invalidTypeMessage } = options;
  if (!allowedTypes || allowedTypes.length === 0) {
    return baseArchetypeSchema;
  }
  const allowSet = new Set(allowedTypes);
  return baseArchetypeSchema.extend({
    type: clientArchetypeTypeSchema.refine(
      (value) => allowSet.has(value),
      { message: invalidTypeMessage ?? 'Tipo não permitido para este contexto' },
    ),
  });
}

export type BaseArchetypeFormData = z.infer<typeof baseArchetypeSchema>;
