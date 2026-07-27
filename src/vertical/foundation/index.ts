// NOID-VERTICAL-1.0-VERT-02.1 (evolved by VERT-02.2, VERT-02.3)
// Public API of the Vertical Foundation.

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

// VERT-02.3 — Contribution Model Foundation.
export {
  contributionProvenanceSchema,
  parseContributionProvenance,
  safeParseContributionProvenance,
  validateExtensionContribution,
  safeDeclareExtensionContribution,
  ExtensionContributionValidationError,
  type ContributionProvenance,
  type ContributionValidationCode,
  type ContributionValidationIssue,
  type ContributionValidationDiagnostic,
  type ExtensionContributionValidationResult,
} from './contributions';
