// NOID-VERTICAL-1.0-VERT-02.6
// Dependency-direction assertions (ADR-01):
// - Foundation must not import Inventory or Vertical Packs.
// - Inventory generic domain must not import Vertical Packs.
// - Core view (ProductInventoryRequirementsEditor) must not import any
//   concrete Vertical Pack.
// - Only the composition boundary is allowed to import both Foundation and
//   the Connectivity Pack.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const ROOT = process.cwd();

function scan(relDir: string): { file: string; body: string }[] {
  const abs = join(ROOT, relDir);
  return collectFiles(abs).map((f) => ({ file: f, body: readFileSync(f, 'utf8') }));
}

const FOUNDATION = scan('src/vertical/foundation');
const INVENTORY_GENERIC = scan('src/inventory');
const CORE_EDITOR = [
  {
    file: 'src/components/products/ProductInventoryRequirementsEditor.tsx',
    body: readFileSync(
      join(ROOT, 'src/components/products/ProductInventoryRequirementsEditor.tsx'),
      'utf8',
    ),
  },
];

const PACK_IMPORT_PATTERNS = [
  '@/vertical-packs/',
  'src/vertical-packs/',
  '../vertical-packs',
  '../../vertical-packs',
];

const CONNECTIVITY_LITERALS = [
  'Roteador 5G Indoor',
  '1 roteador por ponto',
  'pontos de conectividade indoor',
];

describe('VERT-02.6 dependency direction', () => {
  it('Foundation does not import any Vertical Pack', () => {
    for (const { file, body } of FOUNDATION) {
      for (const pat of PACK_IMPORT_PATTERNS) {
        expect(body.includes(pat), `${file} imports ${pat}`).toBe(false);
      }
    }
  });

  it('Inventory generic domain does not import any Vertical Pack', () => {
    for (const { file, body } of INVENTORY_GENERIC) {
      for (const pat of PACK_IMPORT_PATTERNS) {
        expect(body.includes(pat), `${file} imports ${pat}`).toBe(false);
      }
    }
  });

  it('Core editor does not import any concrete Vertical Pack', () => {
    for (const { file, body } of CORE_EDITOR) {
      for (const pat of PACK_IMPORT_PATTERNS) {
        expect(body.includes(pat), `${file} imports ${pat}`).toBe(false);
      }
    }
  });

  it('Core editor does not contain Connectivity-specific literals', () => {
    for (const { file, body } of CORE_EDITOR) {
      for (const lit of CONNECTIVITY_LITERALS) {
        expect(body.includes(lit), `${file} contains "${lit}"`).toBe(false);
      }
    }
  });
});
