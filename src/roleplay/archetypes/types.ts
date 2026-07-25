/**
 * Core Universal — Roleplay Archetype Type contract.
 *
 * Sprint: NOID-VERTICAL-1.0-VERT-01.4A.
 *
 * The Core knows only that an Archetype has a `type` which is a domain-scoped
 * string. It does NOT know which values are valid — that is a decision owned
 * by the active Vertical Pack (e.g. Events → Organizador/Expositor/...) or by
 * tenant configuration in future sprints.
 *
 * Core MUST NEVER import from `@/vertical-packs/**`.
 */

/**
 * Generic archetype type. Callers/hosts choose the acceptable value set.
 */
export type ClientArchetypeType = string;

/**
 * Generic base archetype shape used by the Core schema factory.
 *
 * NOTE (VERT-01.4A audit): `level`, `tone_style` and `decision_role` are kept
 * on the base shape ONLY to preserve current runtime. They are currently
 * literal unions in the legacy schema and physically enforced by Postgres
 * enums (`archetype_level_type`, `tone_style_type`, `decision_role_type`).
 *
 * Classification for future sprints:
 *   - level         → TENANT_CONFIG_CANDIDATE
 *   - tone_style    → CORE_UNIVERSAL (likely universal across verticals)
 *   - decision_role → CORE_UNIVERSAL (likely universal)
 *
 * These classifications are NOT acted upon in VERT-01.4A.
 */
export interface BaseArchetype {
  name: string;
  type: ClientArchetypeType;
  level: string;
  tone_style: string;
  decision_role: string;
  complexity_score: number;
  min_message_exchanges: number;
  objection_set: string[];
}
