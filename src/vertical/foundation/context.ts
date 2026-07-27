// NOID-VERTICAL-1.0-VERT-02.4
// Composition Context Foundation.
//
// Read-only value passed (in future sprints) to contributions at resolution
// time. Adds NOTHING about registry, resolver, contribution execution, tenant
// configuration persistence, shared-domain persistence, installed Packs,
// entitlements, feature flags, or permissions.
//
// Rules (frozen by VERT-02.0 / VERT-02.1 / VERT-02.2 / VERT-02.3):
// - Foundation is industry-neutral (ADR-10). This file must not name any
//   concrete Pack, provider, vendor, or industry concept — including the
//   term used by the shared-domain contract of any specific vertical.
// - Foundation must not import from vertical-packs (ADR-01).
// - Accessors are read-only, synchronous, and side-effect free.
// - Foundation does NOT deep-freeze caller-supplied accessors — it does not
//   own their implementations. It only guards its own wrapper.

import type { CapabilityId } from './ids';
import type { ExtensionSurfaceDescriptor } from './surfaces';

// ---------------------------------------------------------------------------
// Read-only accessor contract
// ---------------------------------------------------------------------------

/**
 * A read-only, synchronous key -> value accessor.
 *
 * The generic `TValue` is set by the implementation/contract that produces
 * the accessor — NOT by the caller of `get` at each call site. This
 * intentionally avoids fake type-safety of the form `get<T>(key): T`.
 */
export interface ReadonlyCompositionAccessor<TValue = unknown> {
  get(key: string): TValue | null;
}

/**
 * A frozen singleton accessor whose `get` always returns `null`. Reusable as
 * the default for any accessor slot that has no live backing yet.
 */
export const EMPTY_COMPOSITION_ACCESSOR: ReadonlyCompositionAccessor =
  Object.freeze({
    get(_key: string): unknown | null {
      return null;
    },
  });

// ---------------------------------------------------------------------------
// CompositionContext
// ---------------------------------------------------------------------------

/**
 * Read-only context describing WHAT a future resolver will know about a
 * composition request. It does not describe what is installed, what is
 * enabled, which Pack wins, or which contribution was selected.
 *
 * `TContribution` is preserved from the bound surface.
 */
export interface CompositionContext<TContribution> {
  readonly organizationId: string;
  readonly userId: string | null;
  readonly capabilityId: CapabilityId;
  readonly surface: ExtensionSurfaceDescriptor<TContribution>;
  readonly tenantConfig: ReadonlyCompositionAccessor;
  readonly sharedDomain: ReadonlyCompositionAccessor;
}

/**
 * Extracts the contribution type of a composition context.
 */
export type ContributionOfContext<TContext> =
  TContext extends CompositionContext<infer TContribution>
    ? TContribution
    : never;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateCompositionContextInput<TContribution> {
  readonly organizationId: string;
  readonly userId?: string | null;
  readonly surface: ExtensionSurfaceDescriptor<TContribution>;
  readonly tenantConfig?: ReadonlyCompositionAccessor;
  readonly sharedDomain?: ReadonlyCompositionAccessor;
}

function validateIdentityString(field: string, value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error(`createCompositionContext: ${field} must be a string`);
  }
  if (value.length === 0) {
    throw new Error(`createCompositionContext: ${field} must not be empty`);
  }
  if (value.trim().length === 0) {
    throw new Error(
      `createCompositionContext: ${field} must not be whitespace-only`,
    );
  }
  if (value !== value.trim()) {
    throw new Error(
      `createCompositionContext: ${field} must not have surrounding whitespace`,
    );
  }
  return value;
}

function validateAccessor(
  field: string,
  value: ReadonlyCompositionAccessor | undefined,
): ReadonlyCompositionAccessor {
  if (value === undefined) return EMPTY_COMPOSITION_ACCESSOR;
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof (value as { get?: unknown }).get !== 'function'
  ) {
    throw new Error(
      `createCompositionContext: ${field} must implement ReadonlyCompositionAccessor.get`,
    );
  }
  return value;
}

/**
 * Build a frozen CompositionContext. The factory:
 * - validates `organizationId`;
 * - validates `userId` when provided (missing/undefined -> `null`);
 * - derives `capabilityId` from `surface.capabilityId` (caller CANNOT supply);
 * - defaults `tenantConfig` and `sharedDomain` to `EMPTY_COMPOSITION_ACCESSOR`;
 * - freezes the wrapper. Caller-supplied accessors are NOT mutated or frozen.
 * - never invokes the accessors.
 */
export function createCompositionContext<TContribution>(
  input: CreateCompositionContextInput<TContribution>,
): CompositionContext<TContribution> {
  if (!input || typeof input !== 'object') {
    throw new Error('createCompositionContext: input must be an object');
  }
  const organizationId = validateIdentityString(
    'organizationId',
    input.organizationId,
  );

  let userId: string | null;
  if (input.userId === undefined || input.userId === null) {
    userId = null;
  } else {
    userId = validateIdentityString('userId', input.userId);
  }

  const surface = input.surface;
  if (
    !surface ||
    typeof surface !== 'object' ||
    typeof (surface as { capabilityId?: unknown }).capabilityId !== 'string'
  ) {
    throw new Error(
      'createCompositionContext: surface must be an ExtensionSurfaceDescriptor',
    );
  }

  const tenantConfig = validateAccessor('tenantConfig', input.tenantConfig);
  const sharedDomain = validateAccessor('sharedDomain', input.sharedDomain);

  const ctx: CompositionContext<TContribution> = {
    organizationId,
    userId,
    capabilityId: surface.capabilityId,
    surface,
    tenantConfig,
    sharedDomain,
  };
  return Object.freeze(ctx);
}
