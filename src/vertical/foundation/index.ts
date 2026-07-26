// NOID-VERTICAL-1.0-VERT-02.1
// Public API of the Vertical Foundation.
//
// Extension surface contracts added in VERT-02.2. Registry, resolver,
// contribution provenance/validation, and composition context remain
// intentionally absent — they belong to VERT-02.3+.

export type {
  VerticalId,
  PackId,
  CapabilityId,
} from './ids';

export {
  verticalIdSchema,
  packIdSchema,
  capabilityIdSchema,
  parseVerticalId,
  parsePackId,
  parseCapabilityId,
  safeParseVerticalId,
  safeParsePackId,
  safeParseCapabilityId,
  isVerticalId,
  isPackId,
  isCapabilityId,
} from './ids';

export {
  CAPABILITY_IDS,
  CANONICAL_CAPABILITY_IDS,
  isCanonicalCapabilityId,
  type CanonicalCapabilityId,
} from './capabilities';

// VERT-02.2 — Extension Surface contracts.
export {
  defineExtensionSurface,
  declareExtensionContribution,
  type ExtensionSurfaceDescriptor,
  type ExtensionContributionDeclaration,
  type ContributionOf,
  type DefineExtensionSurfaceInput,
} from './surfaces';
