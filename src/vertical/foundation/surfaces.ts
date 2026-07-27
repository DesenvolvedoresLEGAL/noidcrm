// NOID-VERTICAL-1.0-VERT-02.2 (evolved by VERT-02.3)
// Extension Surface contracts.
//
// A Surface is a declared extension point. Since VERT-02.3 a Surface also
// owns the runtime schema its contributions must satisfy — the host is the
// single source of truth for the shape of what plugs in.
//
// Rules (frozen by VERT-02.0 / VERT-02.1):
// - Foundation stays industry-neutral (ADR-10). This file must not reference
//   any concrete Pack, provider, vendor, or industry concept.
// - Foundation must not import from vertical-packs (ADR-01).
// - A Surface is identified by its CapabilityId. No separate SurfaceId is
//   introduced in v1; capability = surface semantic identity.
// - Descriptors are frozen. `TContribution` is preserved through generics
//   AND cross-checked at runtime via `contributionSchema`.

import { z } from 'zod';
import type { CapabilityId } from './ids';
import { isCapabilityId } from './ids';
import type { ContributionProvenance } from './contributions';
import {
  ExtensionContributionValidationError,
  validateExtensionContribution,
} from './contributions';

/**
 * A declared extension point.
 *
 * `TContribution` is bound both at the type level (via the generic) AND at
 * the runtime level (via `contributionSchema`). `defineExtensionSurface`
 * refuses to compile if the two disagree.
 */
export interface ExtensionSurfaceDescriptor<TContribution> {
  readonly capabilityId: CapabilityId;
  readonly description?: string;
  readonly contributionSchema: z.ZodType<TContribution>;
}

/**
 * Extracts the contribution type declared by a surface descriptor.
 */
export type ContributionOf<TSurface> =
  TSurface extends ExtensionSurfaceDescriptor<infer TContribution>
    ? TContribution
    : never;

export interface DefineExtensionSurfaceInput<TContribution> {
  readonly capabilityId: CapabilityId;
  readonly contributionSchema: z.ZodType<TContribution>;
  readonly description?: string;
}

/**
 * Host declaration API. Produces a frozen `ExtensionSurfaceDescriptor` bound
 * to a capability id and a runtime contribution schema.
 *
 * Deliberately does NOT:
 * - accept raw strings for `capabilityId`;
 * - register the descriptor anywhere;
 * - carry provenance, PackId, version, priority, or tenant scope.
 */
export function defineExtensionSurface<TContribution>(
  input: DefineExtensionSurfaceInput<TContribution>,
): ExtensionSurfaceDescriptor<TContribution> {
  if (!isCapabilityId(input.capabilityId)) {
    throw new Error(
      'defineExtensionSurface: capabilityId is not a valid CapabilityId',
    );
  }
  if (
    !input.contributionSchema ||
    typeof (input.contributionSchema as { safeParse?: unknown }).safeParse !==
      'function'
  ) {
    throw new Error(
      'defineExtensionSurface: contributionSchema must be a Zod schema',
    );
  }
  const descriptor: ExtensionSurfaceDescriptor<TContribution> = {
    capabilityId: input.capabilityId,
    description: input.description,
    contributionSchema: input.contributionSchema,
  };
  return Object.freeze(descriptor);
}

/**
 * A declared contribution bound to a specific surface. Since VERT-02.3, the
 * declaration also carries ContributionProvenance. `capabilityId` is not
 * duplicated here — the single source is `declaration.surface.capabilityId`.
 */
export interface ExtensionContributionDeclaration<TContribution> {
  readonly surface: ExtensionSurfaceDescriptor<TContribution>;
  readonly provenance: ContributionProvenance;
  readonly contribution: TContribution;
}

/**
 * Strong, first-party declaration API. `TContribution` is inferred from the
 * surface; the runtime pipeline (shared with the safe API) is executed and
 * throws a typed error on failure.
 */
export function declareExtensionContribution<TContribution>(
  surface: ExtensionSurfaceDescriptor<TContribution>,
  provenance: ContributionProvenance,
  contribution: NoInfer<TContribution>,
): ExtensionContributionDeclaration<TContribution> {
  const result = validateExtensionContribution(surface, {
    provenance,
    contribution,
  });
  if (result.ok) {
    return result.declaration;
  }
  throw new ExtensionContributionValidationError(result.diagnostic);
}
