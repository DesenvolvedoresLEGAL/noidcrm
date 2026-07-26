// NOID-VERTICAL-1.0-VERT-02.1
// Core Vertical Foundation identifiers.
//
// Branded string types for VerticalId, PackId, CapabilityId.
// Runtime values are plain strings; TypeScript prevents accidental mixing.
//
// Rules (frozen by VERT-02.0):
// - Foundation is industry-neutral. This file must not mention any concrete
//   Pack, provider, vendor, or industry concept (see ADR-10).
// - Foundation must not import from vertical-packs (see ADR-01).
// - Machine identifier format for VerticalId/PackId (single segment):
//     non-empty, lowercase ASCII, [a-z0-9_], no dot / space / hyphen / slash.
// - CapabilityId format (v1): exactly two segments separated by a single dot,
//     each segment matching [a-z0-9_]+. Uppercase / whitespace / hyphen /
//     slash / extra segments are all rejected.
// - Parsers do not normalise input. Invalid input is rejected, never coerced.

import { z } from 'zod';

declare const __verticalIdBrand: unique symbol;
declare const __packIdBrand: unique symbol;
declare const __capabilityIdBrand: unique symbol;

export type VerticalId = string & { readonly [__verticalIdBrand]: 'VerticalId' };
export type PackId = string & { readonly [__packIdBrand]: 'PackId' };
export type CapabilityId = string & { readonly [__capabilityIdBrand]: 'CapabilityId' };

/** Single machine-identifier segment: `[a-z0-9_]+`. */
const MACHINE_SEGMENT_RE = /^[a-z0-9_]+$/;

/** Capability id v1: exactly two machine segments joined by a single dot. */
const CAPABILITY_ID_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;

const machineIdentifierSchema = z
  .string()
  .min(1, 'identifier must not be empty')
  .regex(
    MACHINE_SEGMENT_RE,
    'identifier must be lowercase ASCII [a-z0-9_], single segment, no dot / space / hyphen / slash',
  );

export const verticalIdSchema = machineIdentifierSchema.transform(
  (v) => v as VerticalId,
);

export const packIdSchema = machineIdentifierSchema.transform(
  (v) => v as PackId,
);

export const capabilityIdSchema = z
  .string()
  .min(1, 'capability id must not be empty')
  .regex(
    CAPABILITY_ID_RE,
    'capability id must be `<domain>.<capability>` with exactly two lowercase segments matching [a-z0-9_]+',
  )
  .transform((v) => v as CapabilityId);

export function parseVerticalId(input: unknown): VerticalId {
  return verticalIdSchema.parse(input);
}

export function parsePackId(input: unknown): PackId {
  return packIdSchema.parse(input);
}

export function parseCapabilityId(input: unknown): CapabilityId {
  return capabilityIdSchema.parse(input);
}

export function safeParseVerticalId(input: unknown) {
  return verticalIdSchema.safeParse(input);
}

export function safeParsePackId(input: unknown) {
  return packIdSchema.safeParse(input);
}

export function safeParseCapabilityId(input: unknown) {
  return capabilityIdSchema.safeParse(input);
}

export function isVerticalId(input: unknown): input is VerticalId {
  return typeof input === 'string' && MACHINE_SEGMENT_RE.test(input);
}

export function isPackId(input: unknown): input is PackId {
  return typeof input === 'string' && MACHINE_SEGMENT_RE.test(input);
}

export function isCapabilityId(input: unknown): input is CapabilityId {
  return typeof input === 'string' && CAPABILITY_ID_RE.test(input);
}
