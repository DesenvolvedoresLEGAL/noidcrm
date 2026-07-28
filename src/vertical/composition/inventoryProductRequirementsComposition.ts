// NOID-VERTICAL-1.0-VERT-02.6
// Application composition boundary for `inventory.product_requirements`.
//
// Rules:
// - MAY import Foundation Registry/Context and concrete Pack contributions.
// - MUST NOT be imported by Foundation, Inventory generic domain, or the
//   Core editor view (ADR-01).
// - Creates a fresh Registry per call (no singleton, no import side-effect
//   registration).
// - Exposes a neutral policy consumable by the Core view (never leaks
//   Registry / ResolutionResult / provenance / PackId).
// - Rejects >1 applicable contribution explicitly. Never picks a Pack
//   silently by PackId order.

import {
  createCompositionContext,
  createExtensionRegistry,
  type PackId,
} from '@/vertical/foundation';
import {
  inventoryProductRequirementsSurface,
  type InventoryProductRequirementsContribution,
} from '@/vertical/hosts/inventoryProductRequirementsSurface';
import { connectivityInventoryProductRequirementsContribution } from '@/vertical-packs/connectivity/inventory/productRequirementsContribution';
import type { InventoryProviderType } from '@/inventory/providers/types';
import type { UnitBasis } from '@/inventory/requirements/unitBasis';
import type { ExtensionContributionDeclaration } from '@/vertical/foundation';

// ---------------------------------------------------------------------------
// Policy shape returned to the Core view
// ---------------------------------------------------------------------------

export interface ResolvedInventoryProductRequirementsPresentation {
  readonly consumptionExample: string;
  readonly requirementLabelPlaceholder: string;
  readonly notesPlaceholder: string;
}

export interface ResolvedInventoryProductRequirementsPolicy {
  /** True iff exactly one registered contribution supports the active provider. */
  readonly providerSupportedByPack: boolean;
  /** Default UnitBasis used only for NEW requirement creation. */
  readonly defaultUnitBasis: UnitBasis;
  /** Vertical UI strings (consumption example + placeholders). */
  readonly presentation: ResolvedInventoryProductRequirementsPresentation;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type InventoryProductRequirementsCompositionErrorCode =
  | 'multiple_applicable_product_requirement_contributions';

export interface InventoryProductRequirementsCompositionErrorDetails {
  readonly code: InventoryProductRequirementsCompositionErrorCode;
  readonly packIds: readonly PackId[];
}

export class InventoryProductRequirementsCompositionError extends Error {
  readonly code: InventoryProductRequirementsCompositionErrorCode;
  readonly packIds: readonly PackId[];
  constructor(details: InventoryProductRequirementsCompositionErrorDetails) {
    super(
      `Inventory product requirements composition rejected (${details.code}): ${details.packIds.length} applicable Pack contributions.`,
    );
    this.name = 'InventoryProductRequirementsCompositionError';
    this.code = details.code;
    this.packIds = Object.freeze([...details.packIds]);
  }
}

// ---------------------------------------------------------------------------
// Factory input / output
// ---------------------------------------------------------------------------

export interface ResolveInventoryProductRequirementsInput {
  readonly organizationId: string;
  readonly userId?: string | null;
  readonly activeProviderType?: InventoryProviderType | null;
  /**
   * Test-only escape hatch: additional contributions to register alongside
   * the canonical Connectivity Pack. Never used by application code.
   */
  readonly _extraContributions?: readonly ExtensionContributionDeclaration<InventoryProductRequirementsContribution>[];
}

// Neutral fallback strings when there is no registered contribution at all
// (defensive — never occurs while Connectivity registers unconditionally).
const NEUTRAL_PRESENTATION: ResolvedInventoryProductRequirementsPresentation =
  Object.freeze({
    consumptionExample: '',
    requirementLabelPlaceholder: '',
    notesPlaceholder: '',
  });

const NEUTRAL_DEFAULT_BASIS: UnitBasis = 'per_unit';

/**
 * Explicit composition resolver. Builds a fresh Registry, registers the
 * canonical surface and the Connectivity contribution, resolves against a
 * fresh Context, and reduces the ResolutionResult to a neutral host policy.
 *
 * Does NOT read tenant config or shared domain. Does NOT invoke contribution
 * payloads. Does NOT persist any state.
 */
export function resolveInventoryProductRequirementsComposition(
  input: ResolveInventoryProductRequirementsInput,
): ResolvedInventoryProductRequirementsPolicy {
  const registry = createExtensionRegistry();
  registry.registerSurface(inventoryProductRequirementsSurface);
  registry.registerContribution(
    connectivityInventoryProductRequirementsContribution,
  );
  if (input._extraContributions) {
    for (const extra of input._extraContributions) {
      registry.registerContribution(extra);
    }
  }

  const context = createCompositionContext({
    organizationId: input.organizationId,
    userId: input.userId ?? null,
    surface: inventoryProductRequirementsSurface,
  });

  const result = registry.resolve(context);
  const active = input.activeProviderType ?? null;

  const applicable = active
    ? result.contributions.filter((decl) =>
        decl.contribution.supportedProviderTypes.includes(active),
      )
    : [];

  if (applicable.length > 1) {
    throw new InventoryProductRequirementsCompositionError({
      code: 'multiple_applicable_product_requirement_contributions',
      packIds: applicable.map((d) => d.provenance.packId),
    });
  }

  const applied = applicable[0] ?? null;

  // For layout stability while provider loads or when no contribution is
  // applicable, presentation falls back to the (single) registered
  // contribution deterministically. `providerSupportedByPack` strictly
  // reflects applicability — never coerced.
  const presentationSource = applied ?? result.contributions[0] ?? null;
  const basisSource = applied ?? result.contributions[0] ?? null;

  const policy: ResolvedInventoryProductRequirementsPolicy = {
    providerSupportedByPack: applicable.length === 1,
    defaultUnitBasis:
      basisSource?.contribution.defaultUnitBasis ?? NEUTRAL_DEFAULT_BASIS,
    presentation: presentationSource
      ? Object.freeze({
          consumptionExample:
            presentationSource.contribution.presentation.consumptionExample,
          requirementLabelPlaceholder:
            presentationSource.contribution.presentation
              .requirementLabelPlaceholder,
          notesPlaceholder:
            presentationSource.contribution.presentation.notesPlaceholder,
        })
      : NEUTRAL_PRESENTATION,
  };
  return Object.freeze(policy);
}
