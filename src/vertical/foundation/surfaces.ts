// NOID-VERTICAL-1.0-VERT-02.2
// Extension Surface contracts.
//
// A Surface is a declared extension point where Pack contributions will
// (in a later sprint) be plugged in. This module defines only the CONTRACT:
// no registry, no resolver, no composition context, no runtime wiring.
//
// Rules (frozen by VERT-02.0 / VERT-02.1):
// - Foundation stays industry-neutral (ADR-10). This file must not reference
//   any concrete Pack, provider, vendor, or industry concept.
// - Foundation must not import from vertical-packs (ADR-01).
// - A Surface is identified by its CapabilityId. No separate SurfaceId is
//   introduced in v1; capability = surface semantic identity.
// - Descriptors are frozen. `TContribution` is a phantom type — the runtime
//   payload never carries a fake value for it.

import type { CapabilityId } from './ids';
import { isCapabilityId } from './ids';

/**
 * A declared extension point.
 *
 * `TContribution` is a phantom / compile-time-only generic. It is preserved
 * by TypeScript for downstream inference but never materialised at runtime.
 */
export interface ExtensionSurfaceDescriptor<TContribution> {
  readonly capabilityId: CapabilityId;
  readonly description?: string;
  /**
   * Phantom marker used exclusively by the type system to carry
   * `TContribution` through inference. Always `undefined` at runtime.
   */
  readonly __contributionType?: TContribution;
}

/**
 * Extracts the contribution type declared by a surface descriptor.
 *
 * @example
 *   type X = ContributionOf<typeof someSurface>;
 */
export type ContributionOf<TSurface> =
  TSurface extends ExtensionSurfaceDescriptor<infer TContribution>
    ? TContribution
    : never;

export interface DefineExtensionSurfaceInput {
  readonly capabilityId: CapabilityId;
  readonly description?: string;
}

/**
 * Host declaration API. Produces a frozen `ExtensionSurfaceDescriptor` bound
 * to a capability id. The `TContribution` generic must be supplied by the
 * caller (a host owns the shape of the contributions it accepts).
 *
 * Deliberately does NOT:
 * - accept raw strings for `capabilityId` (must already be a `CapabilityId`);
 * - register the descriptor anywhere (no global registry in this sprint);
 * - carry any provenance, PackId, version, priority, or tenant scope.
 */
export function defineExtensionSurface<TContribution>(
  input: DefineExtensionSurfaceInput,
): ExtensionSurfaceDescriptor<TContribution> {
  if (!isCapabilityId(input.capabilityId)) {
    throw new Error(
      'defineExtensionSurface: capabilityId is not a valid CapabilityId',
    );
  }
  const descriptor: ExtensionSurfaceDescriptor<TContribution> = {
    capabilityId: input.capabilityId,
    description: input.description,
  };
  return Object.freeze(descriptor);
}

/**
 * A declared contribution bound to a specific surface.
 *
 * Intentionally minimal in this sprint: no PackId, no packVersion, no
 * sourcePath, no priority, no provenance, no diagnostics. Those belong to
 * VERT-02.3 (Contribution Model Foundation).
 */
export interface ExtensionContributionDeclaration<TContribution> {
  readonly surface: ExtensionSurfaceDescriptor<TContribution>;
  readonly contribution: TContribution;
}

/**
 * Contribution declaration API. `TContribution` is inferred from the surface,
 * so callers never need to restate the generic. A payload whose shape does
 * not match the surface's contribution type fails at compile time.
 */
export function declareExtensionContribution<TContribution>(
  surface: ExtensionSurfaceDescriptor<TContribution>,
  contribution: TContribution,
): ExtensionContributionDeclaration<TContribution> {
  return Object.freeze({ surface, contribution });
}
