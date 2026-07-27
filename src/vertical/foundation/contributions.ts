// NOID-VERTICAL-1.0-VERT-02.3
// Contribution Model Foundation.
//
// Turns a raw contribution payload into a governed, provenance-tagged,
// runtime-validated declaration. Adds NOTHING about installation, tenant,
// context, priority, resolver, registry or lifecycle — those belong to
// later sprints (VERT-02.4 / VERT-02.5 / VERT-04 / VERT-05 / VERT-06).
//
// Rules (frozen by VERT-02.0 / VERT-02.1 / VERT-02.2):
// - Foundation is industry-neutral (ADR-10). No concrete Pack, provider,
//   vendor or industry concept is referenced here.
// - Foundation must not import from vertical-packs (ADR-01).
// - packVersion is an opaque string in this sprint. No SemVer, no ordering.
// - Diagnostics must never carry raw payloads or raw input.

import { z, type ZodIssue } from 'zod';
import type { CapabilityId, PackId } from './ids';
import { packIdSchema } from './ids';
import type {
  ExtensionSurfaceDescriptor,
  ExtensionContributionDeclaration,
} from './surfaces';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * Where a contribution comes from. Opaque metadata only:
 * - packId: identity of the contributing Pack (branded).
 * - packVersion: opaque version reference. No SemVer semantics in v1.
 * - sourcePath: opaque textual pointer used strictly for diagnostics.
 *
 * Deliberately excludes: verticalId, tenantId, organizationId, userId,
 * priority, installedAt, feature flags, entitlements.
 */
export interface ContributionProvenance {
  readonly packId: PackId;
  readonly packVersion: string;
  readonly sourcePath: string;
}

const OPAQUE_STRING_MAX = 512;

const opaqueRefString = (field: string) =>
  z
    .string({
      required_error: `${field} must be a non-empty string`,
      invalid_type_error: `${field} must be a string`,
    })
    .min(1, `${field} must not be empty`)
    .max(OPAQUE_STRING_MAX, `${field} exceeds maximum length`)
    .refine(
      (v) => v.trim().length > 0,
      `${field} must not be whitespace-only`,
    )
    .refine(
      (v) => v === v.trim(),
      `${field} must not have surrounding whitespace`,
    );

export const contributionProvenanceSchema = z
  .object({
    packId: packIdSchema,
    packVersion: opaqueRefString('packVersion'),
    sourcePath: opaqueRefString('sourcePath'),
  })
  .strict();

export function parseContributionProvenance(
  input: unknown,
): ContributionProvenance {
  const parsed = contributionProvenanceSchema.parse(input);
  return Object.freeze({
    packId: parsed.packId,
    packVersion: parsed.packVersion,
    sourcePath: parsed.sourcePath,
  });
}

export function safeParseContributionProvenance(input: unknown) {
  return contributionProvenanceSchema.safeParse(input);
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type ContributionValidationCode =
  | 'invalid_provenance'
  | 'invalid_contribution';

export interface ContributionValidationIssue {
  readonly path: readonly (string | number)[];
  readonly code: string;
  readonly message: string;
}

export interface ContributionValidationDiagnostic {
  readonly code: ContributionValidationCode;
  readonly capabilityId: CapabilityId;
  /** Present only when provenance parsed successfully. */
  readonly packId?: PackId;
  /** Present only when provenance parsed successfully. */
  readonly packVersion?: string;
  /** Present only when provenance parsed successfully. */
  readonly sourcePath?: string;
  readonly issues: readonly ContributionValidationIssue[];
}

const MESSAGE_MAX = 240;

function sanitizeMessage(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  return collapsed.length > MESSAGE_MAX
    ? `${collapsed.slice(0, MESSAGE_MAX - 1)}…`
    : collapsed;
}

function toIssues(
  zodIssues: readonly ZodIssue[],
): readonly ContributionValidationIssue[] {
  return Object.freeze(
    zodIssues.map((issue) =>
      Object.freeze({
        path: Object.freeze([...issue.path]),
        code: issue.code,
        message: sanitizeMessage(issue.message),
      }),
    ),
  );
}

function freezeDiagnostic(
  d: ContributionValidationDiagnostic,
): ContributionValidationDiagnostic {
  return Object.freeze(d);
}

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class ExtensionContributionValidationError extends Error {
  readonly diagnostic: ContributionValidationDiagnostic;

  constructor(diagnostic: ContributionValidationDiagnostic) {
    super(
      `Extension contribution rejected for capability "${diagnostic.capabilityId}" (${diagnostic.code}).`,
    );
    this.name = 'ExtensionContributionValidationError';
    this.diagnostic = diagnostic;
  }
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type ExtensionContributionValidationResult<TContribution> =
  | {
      readonly ok: true;
      readonly declaration: ExtensionContributionDeclaration<TContribution>;
    }
  | {
      readonly ok: false;
      readonly diagnostic: ContributionValidationDiagnostic;
    };

/**
 * Type predicate — narrows a validation result to its failure variant.
 * Provided because TypeScript generic discriminated-union narrowing on
 * `!result.ok` is unreliable for this shape.
 */
export function isContributionValidationFailure<TContribution>(
  result: ExtensionContributionValidationResult<TContribution>,
): result is { readonly ok: false; readonly diagnostic: ContributionValidationDiagnostic } {
  return result.ok === false;
}

// ---------------------------------------------------------------------------
// Core pipeline (shared by safe + throwing APIs)
// ---------------------------------------------------------------------------

interface RawInput {
  readonly provenance: unknown;
  readonly contribution: unknown;
}

function coerceRawInput(
  surface: ExtensionSurfaceDescriptor<unknown>,
  input: unknown,
): RawInput | ContributionValidationDiagnostic {
  if (typeof input !== 'object' || input === null) {
    return freezeDiagnostic({
      code: 'invalid_provenance',
      capabilityId: surface.capabilityId,
      issues: Object.freeze([
        Object.freeze({
          path: Object.freeze([]),
          code: 'invalid_type',
          message: 'contribution declaration input must be an object',
        }),
      ]),
    });
  }
  const record = input as Record<string, unknown>;
  return { provenance: record.provenance, contribution: record.contribution };
}

function runValidation<TContribution>(
  surface: ExtensionSurfaceDescriptor<TContribution>,
  provenanceInput: unknown,
  contributionInput: unknown,
): ExtensionContributionValidationResult<TContribution> {
  const provenanceParsed =
    contributionProvenanceSchema.safeParse(provenanceInput);
  if (!provenanceParsed.success) {
    return {
      ok: false,
      diagnostic: freezeDiagnostic({
        code: 'invalid_provenance',
        capabilityId: surface.capabilityId,
        issues: toIssues(provenanceParsed.error.issues),
      }),
    };
  }

  const provenance: ContributionProvenance = Object.freeze({
    packId: provenanceParsed.data.packId,
    packVersion: provenanceParsed.data.packVersion,
    sourcePath: provenanceParsed.data.sourcePath,
  });

  const contributionParsed =
    surface.contributionSchema.safeParse(contributionInput);
  if (!contributionParsed.success) {
    return {
      ok: false,
      diagnostic: freezeDiagnostic({
        code: 'invalid_contribution',
        capabilityId: surface.capabilityId,
        packId: provenance.packId,
        packVersion: provenance.packVersion,
        sourcePath: provenance.sourcePath,
        issues: toIssues(contributionParsed.error.issues),
      }),
    };
  }

  const declaration: ExtensionContributionDeclaration<TContribution> =
    Object.freeze({
      surface,
      provenance,
      contribution: contributionParsed.data as TContribution,
    });

  return { ok: true, declaration };
}

// ---------------------------------------------------------------------------
// Public APIs
// ---------------------------------------------------------------------------

/**
 * Boundary / dynamic-input API. Never throws for invalid input.
 * Expected input shape: `{ provenance, contribution }`.
 */
export function validateExtensionContribution<TContribution>(
  surface: ExtensionSurfaceDescriptor<TContribution>,
  input: unknown,
): ExtensionContributionValidationResult<TContribution> {
  const coerced = coerceRawInput(surface, input);
  if ('code' in coerced) {
    return { ok: false, diagnostic: coerced };
  }
  return runValidation(surface, coerced.provenance, coerced.contribution);
}

/**
 * Alias exposing the safe API under the declaration-oriented name.
 */
export const safeDeclareExtensionContribution = validateExtensionContribution;
