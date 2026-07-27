// NOID-VERTICAL-1.0-VERT-02.1
// Governance test — MUST live OUTSIDE src/vertical/foundation/** so the
// forbidden tokens it searches for do not appear inside Foundation source.
//
// Protects:
//   ADR-01 — Core (Foundation) cannot import concrete Packs.
//   ADR-10 — Foundation must remain industry-neutral.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FOUNDATION_DIR = join(process.cwd(), 'src', 'vertical', 'foundation');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = collectSourceFiles(FOUNDATION_DIR);
const BODIES = FILES.map((f) => ({ file: f, body: readFileSync(f, 'utf8') }));

/**
 * Tokens broken up so they do not appear as a single searchable literal in
 * this file's own bytes. Reconstructed at runtime.
 */
const forbid = (parts: string[]) => parts.join('');

const FORBIDDEN_IMPORT_PATTERNS = [
  forbid(['@/vertical-', 'packs/']),
  forbid(['src/vertical-', 'packs/']),
  forbid(['../vertical-', 'packs']),
  forbid(['../../vertical-', 'packs']),
];

const FORBIDDEN_CONCEPT_TOKENS = [
  // vendor / provider identities
  forbid(['event', 'rix']),
  forbid(['ex', 'pofp']),
  forbid(['apo', 'llo']),
  forbid(['um', 'ma']),
  // connectivity concepts
  'router',
  forbid(['sim_', 'card']),
  'iccid',
  'imei',
  'ssid',
  // event-industry structural concepts
  'venue',
  'pavilion',
  'exhibitor',
  'organizer',
  // VERT-02.4 — Foundation must not name Event Core (ADR-10 refinement).
  forbid(['event', 'Core']).toLowerCase(),
];

describe('Foundation industry neutrality (ADR-01 + ADR-10)', () => {
  it('discovers foundation source files', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it('does not import from any concrete Pack namespace', () => {
    for (const { file, body } of BODIES) {
      for (const pat of FORBIDDEN_IMPORT_PATTERNS) {
        expect(
          body.includes(pat),
          `Foundation file ${file} imports forbidden Pack path "${pat}"`,
        ).toBe(false);
      }
    }
  });

  it('does not reference vendor/provider/industry concepts', () => {
    for (const { file, body } of BODIES) {
      const lowered = body.toLowerCase();
      for (const token of FORBIDDEN_CONCEPT_TOKENS) {
        expect(
          lowered.includes(token),
          `Foundation file ${file} references forbidden concept token "${token}"`,
        ).toBe(false);
      }
    }
  });
});
