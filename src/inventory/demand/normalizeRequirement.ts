// NOID-VERTICAL-1.0-VERT-01.2E-B2B
// Normalizer principal do domínio genérico.
// Entrada CANÔNICA: `InventoryProductRequirement` (domínio genérico).
// NUNCA lê colunas físicas `eventrix_*` — para isso existe o bridge
// legado em `./legacyRequirementCompatibility.ts` que passa a row
// pelo `storageMapper` antes de chamar este normalizer.
//
// Regras:
// - `provider_type` vem SEMPRE do requirement de entrada.
// - `expectedProviderType` é opcional e apenas VALIDAÇÃO. Nunca
//   reescreve `provider_type` do requirement.
// - Nunca inventa IMEI/ICCID/SSID/WiFi ou metadados de conectividade.

import type { InventoryProductRequirement } from '@/inventory/requirements/types';
import { UNIT_BASIS_VALUES } from '@/inventory/requirements/unitBasis';
import type { InventoryProviderType } from '@/inventory/providers/types';
import {
  InventoryDemandNormalizationError,
  type NormalizedProductInventoryRequirement,
} from './types';

export interface NormalizeInventoryRequirementOptions {
  /** Se presente e divergente de `requirement.provider_type`, gera `provider_mismatch`. */
  expectedProviderType?: InventoryProviderType;
  /** Default `true`. `false` retorna `null` no lugar de lançar. */
  strict?: boolean;
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function normalizeInventoryProductRequirement(
  req: InventoryProductRequirement,
  opts: NormalizeInventoryRequirementOptions = {},
): NormalizedProductInventoryRequirement | null {
  const { expectedProviderType, strict = true } = opts;

  const fail = (
    code: InventoryDemandNormalizationError['code'],
    msg: string,
  ): null => {
    if (strict) throw new InventoryDemandNormalizationError(code, msg);
    return null;
  };

  if (!req || typeof req !== 'object') {
    return fail('missing_category', 'Requisito ausente ou inválido.');
  }

  const category_ref = trimOrNull(req.category_ref);
  const family_ref = trimOrNull(req.family_ref);
  const category_name = trimOrNull(req.category_name) ?? category_ref ?? '';
  const family_name = trimOrNull(req.family_name) ?? family_ref ?? '';

  if (!category_ref) return fail('missing_category', 'Referência de categoria ausente.');
  if (!family_ref) return fail('missing_family', 'Referência de família ausente.');
  if (!req.product_id) return fail('missing_product', 'Produto de origem ausente.');

  const quantity = Number(req.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fail('invalid_quantity', `Quantidade inválida (${String(req.quantity)}).`);
  }

  if (!UNIT_BASIS_VALUES.includes(req.unit_basis)) {
    return fail(
      'invalid_unit_basis',
      `Unit basis desconhecido: ${String(req.unit_basis)}.`,
    );
  }

  if (expectedProviderType && req.provider_type !== expectedProviderType) {
    return fail(
      'provider_mismatch',
      `Provider do requisito (${req.provider_type}) diverge do esperado (${expectedProviderType}).`,
    );
  }

  return {
    provider_type: req.provider_type,
    category_ref,
    category_name,
    family_ref,
    family_name,
    item_kind: trimOrNull(req.item_kind),
    requirement_id: req.id,
    product_id: req.product_id,
    label: trimOrNull(req.label) ?? family_name,
    quantity,
    unit_basis: req.unit_basis,
    is_required: !!req.is_required,
    notes: trimOrNull(req.notes),
    sort_order: typeof req.sort_order === 'number' ? req.sort_order : 0,
    is_active: req.is_active !== false,
    metadata: undefined,
  };
}

export function normalizeInventoryProductRequirements(
  reqs: InventoryProductRequirement[],
  opts: Omit<NormalizeInventoryRequirementOptions, 'strict'> = {},
): {
  normalized: NormalizedProductInventoryRequirement[];
  skipped: Array<{ requirement_id: string; reason: string }>;
} {
  const normalized: NormalizedProductInventoryRequirement[] = [];
  const skipped: Array<{ requirement_id: string; reason: string }> = [];
  for (const r of reqs ?? []) {
    try {
      const n = normalizeInventoryProductRequirement(r, { ...opts, strict: true });
      if (n) normalized.push(n);
    } catch (err) {
      skipped.push({
        requirement_id: r?.id ?? '(sem id)',
        reason:
          err instanceof InventoryDemandNormalizationError
            ? `${err.code}: ${err.message}`
            : (err as Error).message,
      });
    }
  }
  return { normalized, skipped };
}
