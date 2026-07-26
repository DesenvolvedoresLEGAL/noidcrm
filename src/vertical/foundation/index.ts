// NOID-VERTICAL-1.0-VERT-02.1
// Public API of the Vertical Foundation.
//
// This barrel exposes only identity + capability contracts. Extension
// surfaces, contribution model, composition context, registry and resolver
// belong to later sprints and are intentionally absent.

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
