// NOID-VERTICAL-1.0-VERT-02.5
// Static Registry / Resolver Foundation.
//
// In-memory, instance-based, deterministic resolution of extension
// contributions declared against extension surfaces. Adds NOTHING about
// Pack installation, tenant configuration, entitlements, feature flags,
// priority, merging, contribution execution, persistence, or lifecycle —
// those belong to later sprints (VERT-04 / VERT-05 / VERT-06).
//
// Rules (frozen by VERT-02.0 / VERT-02.1 / VERT-02.2 / VERT-02.3 / VERT-02.4):
// - Foundation is industry-neutral (ADR-10). This file must not name any
//   concrete Pack, provider, vendor or industry concept.
// - Foundation must not import from vertical-packs (ADR-01).
// - `static` means in-memory + first-party + no persistence + no dynamic
//   remote loading. It does NOT mean "module-level singleton". This file
//   deliberately exports NO default/global registry instance.
// - Resolution order is deterministic and independent of registration
//   order: ascending lexicographic `PackId`. This is Foundation v1
//   determinism only — not a commercial precedence rule.
// - The Registry never invokes accessors (`tenantConfig`, `sharedDomain`)
//   nor any contribution payload.
// - Errors are sanitized: they carry only identifiers, never payloads.

import type { CapabilityId, PackId } from './ids';
import type { ExtensionSurfaceDescriptor } from './surfaces';
import type {
  ExtensionContributionDeclaration,
} from './surfaces';
import type { ContributionProvenance } from './contributions';
import {
  ExtensionContributionValidationError,
  validateExtensionContribution,
  isContributionValidationFailure,
} from './contributions';
import type { CompositionContext } from './context';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ExtensionRegistryErrorCode =
  | 'surface_already_registered'
  | 'surface_not_registered'
  | 'surface_descriptor_mismatch'
  | 'duplicate_pack_contribution'
  | 'context_surface_mismatch';

export interface ExtensionRegistryErrorDetails {
  readonly code: ExtensionRegistryErrorCode;
  readonly capabilityId?: CapabilityId;
  readonly packId?: PackId;
  readonly message: string;
}

export class ExtensionRegistryError extends Error {
  readonly code: ExtensionRegistryErrorCode;
  readonly capabilityId?: CapabilityId;
  readonly packId?: PackId;

  constructor(details: ExtensionRegistryErrorDetails) {
    super(details.message);
    this.name = 'ExtensionRegistryError';
    this.code = details.code;
    this.capabilityId = details.capabilityId;
    this.packId = details.packId;
  }
}

function raise(details: ExtensionRegistryErrorDetails): never {
  throw new ExtensionRegistryError(details);
}

// ---------------------------------------------------------------------------
// Resolution result
// ---------------------------------------------------------------------------

export interface ExtensionResolutionResult<TContribution> {
  readonly capabilityId: CapabilityId;
  readonly surface: ExtensionSurfaceDescriptor<TContribution>;
  readonly context: CompositionContext<TContribution>;
  readonly contributions: readonly ExtensionContributionDeclaration<TContribution>[];
}

// ---------------------------------------------------------------------------
// Internal storage entry
// ---------------------------------------------------------------------------

interface SurfaceEntry {
  readonly surface: ExtensionSurfaceDescriptor<unknown>;
  // Keyed by PackId. Enforces v1 uniqueness: one contribution per Pack per
  // Surface. Resolution never depends on insertion order of this Map — the
  // resolver sorts keys lexicographically at resolve time.
  readonly byPack: Map<PackId, ExtensionContributionDeclaration<unknown>>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface ExtensionRegistry {
  registerSurface<TContribution>(
    surface: ExtensionSurfaceDescriptor<TContribution>,
  ): void;

  hasSurface(capabilityId: CapabilityId): boolean;

  /**
   * Returns the registered descriptor for `capabilityId`, or `null`.
   *
   * Generic parameter is deliberately `unknown` — a runtime `CapabilityId`
   * cannot safely reproduce the compile-time generic. Callers that already
   * hold a typed surface should prefer `resolve(context)`.
   */
  getSurface(
    capabilityId: CapabilityId,
  ): ExtensionSurfaceDescriptor<unknown> | null;

  registerContribution<TContribution>(
    declaration: ExtensionContributionDeclaration<TContribution>,
  ): void;

  resolve<TContribution>(
    context: CompositionContext<TContribution>,
  ): ExtensionResolutionResult<TContribution>;
}

/**
 * Build a fresh, isolated registry. Foundation exports NO default instance.
 */
export function createExtensionRegistry(): ExtensionRegistry {
  const surfaces = new Map<CapabilityId, SurfaceEntry>();

  function requireEntry(capabilityId: CapabilityId): SurfaceEntry {
    const entry = surfaces.get(capabilityId);
    if (!entry) {
      raise({
        code: 'surface_not_registered',
        capabilityId,
        message: `Surface "${capabilityId}" is not registered.`,
      });
    }
    return entry;
  }

  const registry: ExtensionRegistry = {
    registerSurface(surface) {
      if (
        !surface ||
        typeof surface !== 'object' ||
        typeof (surface as { capabilityId?: unknown }).capabilityId !==
          'string'
      ) {
        raise({
          code: 'surface_descriptor_mismatch',
          message:
            'registerSurface: input must be a valid ExtensionSurfaceDescriptor.',
        });
      }
      const capabilityId = surface.capabilityId;
      if (surfaces.has(capabilityId)) {
        raise({
          code: 'surface_already_registered',
          capabilityId,
          message: `Surface "${capabilityId}" is already registered.`,
        });
      }
      surfaces.set(capabilityId, {
        surface: surface as ExtensionSurfaceDescriptor<unknown>,
        byPack: new Map(),
      });
    },

    hasSurface(capabilityId) {
      return surfaces.has(capabilityId);
    },

    getSurface(capabilityId) {
      const entry = surfaces.get(capabilityId);
      return entry ? entry.surface : null;
    },

    registerContribution(declaration) {
      if (
        !declaration ||
        typeof declaration !== 'object' ||
        !declaration.surface ||
        typeof (declaration.surface as { capabilityId?: unknown })
          .capabilityId !== 'string'
      ) {
        raise({
          code: 'surface_descriptor_mismatch',
          message:
            'registerContribution: declaration.surface must be an ExtensionSurfaceDescriptor.',
        });
      }

      const capabilityId = declaration.surface.capabilityId;
      const entry = requireEntry(capabilityId);

      // Descriptor identity guard: capabilityId equality is not enough —
      // a differently-constructed descriptor may carry a different runtime
      // schema. Registration requires the exact registered descriptor.
      if (entry.surface !== (declaration.surface as unknown)) {
        raise({
          code: 'surface_descriptor_mismatch',
          capabilityId,
          message: `Contribution surface descriptor for "${capabilityId}" does not match the registered descriptor.`,
        });
      }

      // Revalidate provenance + contribution against the surface schema.
      // Never trust the caller's TypeScript view; boundary re-check.
      const result = validateExtensionContribution(entry.surface, {
        provenance: declaration.provenance,
        contribution: declaration.contribution,
      });
      if (isContributionValidationFailure(result)) {
        throw new ExtensionContributionValidationError(result.diagnostic);
      }

      const canonical = result.declaration;
      const packId = canonical.provenance.packId;

      if (entry.byPack.has(packId)) {
        raise({
          code: 'duplicate_pack_contribution',
          capabilityId,
          packId,
          message: `Pack "${packId}" already contributes to surface "${capabilityId}".`,
        });
      }

      entry.byPack.set(packId, canonical);
    },

    resolve<TContribution>(context: CompositionContext<TContribution>) {
      if (
        !context ||
        typeof context !== 'object' ||
        !context.surface ||
        typeof (context.surface as { capabilityId?: unknown }).capabilityId !==
          'string'
      ) {
        raise({
          code: 'context_surface_mismatch',
          message: 'resolve: context.surface must be an ExtensionSurfaceDescriptor.',
        });
      }

      const capabilityId = context.surface.capabilityId;

      if (context.capabilityId !== capabilityId) {
        raise({
          code: 'context_surface_mismatch',
          capabilityId,
          message: `Context capabilityId "${context.capabilityId}" does not match surface capabilityId "${capabilityId}".`,
        });
      }

      const entry = requireEntry(capabilityId);

      if (entry.surface !== (context.surface as unknown)) {
        raise({
          code: 'surface_descriptor_mismatch',
          capabilityId,
          message: `Context surface descriptor for "${capabilityId}" does not match the registered descriptor.`,
        });
      }

      // Deterministic order: ascending lexicographic PackId. Independent of
      // registration order. No priority, no version, no timing.
      const sortedPackIds = [...entry.byPack.keys()].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      const contributions = sortedPackIds.map(
        (packId) =>
          entry.byPack.get(packId) as ExtensionContributionDeclaration<TContribution>,
      );

      const result: ExtensionResolutionResult<TContribution> = {
        capabilityId,
        surface: context.surface,
        context,
        contributions: Object.freeze(contributions),
      };
      return Object.freeze(result);
    },
  };

  return registry;
}

// Re-export provenance type for callers that build declarations against the
// registry, keeping this module's surface self-contained at the type level.
export type { ContributionProvenance };
