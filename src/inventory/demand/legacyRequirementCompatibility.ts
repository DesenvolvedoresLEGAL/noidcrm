// NOID-VERTICAL-1.0-VERT-01.2E-B2B
// Bridge de compatibilidade para consumers históricos que ainda
// chamam `normalizeProductInventoryRequirement(<row legado>)`.
// Recebe a row física (colunas `eventrix_*`), passa pelo
// `storageMapper` (única fronteira física autorizada) e delega
// ao normalizer genérico. Sem duplicar mapeamento nem validação.
//
// Não criar novos consumers desta API — o Core deve consumir
// diretamente `normalizeInventoryProductRequirement(s)`.

import {
  mapProductInventoryRequirementFromStorage,
  type LegacyProductInventoryRequirementStorageRow,
} from '@/inventory/requirements/storageMapper';
import type { InventoryProviderType } from '@/inventory/providers/types';
import {
  normalizeInventoryProductRequirement,
  normalizeInventoryProductRequirements,
  type NormalizeInventoryRequirementOptions,
} from './normalizeRequirement';
import {
  InventoryDemandNormalizationError,
  type NormalizedProductInventoryRequirement,
} from './types';

/**
 * @deprecated legado — use `normalizeInventoryProductRequirement`.
 * Mantido para compatibilidade com testes/bridges históricos.
 */
export interface LegacyNormalizeRequirementOptions
  extends Omit<NormalizeInventoryRequirementOptions, 'expectedProviderType'> {
  /**
   * Compat: antigo `providerType` sobrescrevia o provider do resultado.
   * Aqui é usado APENAS como `expectedProviderType` (validação);
   * o provider real vem do storageMapper (via metadata / fallback histórico).
   */
  providerType?: InventoryProviderType;
}

export function normalizeProductInventoryRequirement(
  legacyRow: LegacyProductInventoryRequirementStorageRow,
  opts: LegacyNormalizeRequirementOptions = {},
): NormalizedProductInventoryRequirement | null {
  if (!legacyRow || typeof legacyRow !== 'object') {
    if (opts.strict === false) return null;
    throw new InventoryDemandNormalizationError(
      'missing_category',
      'Requisito ausente ou inválido.',
    );
  }
  const domain = mapProductInventoryRequirementFromStorage(legacyRow);
  return normalizeInventoryProductRequirement(domain, {
    strict: opts.strict,
    // Compat histórico: o antigo default `providerType='eventrix'` é
    // equivalente ao provider real da row (todas as rows legadas mapeiam
    // para eventrix), então usar como expectedProviderType não introduz
    // regressão.
    expectedProviderType: opts.providerType,
  });
}

export function normalizeProductInventoryRequirements(
  legacyRows: LegacyProductInventoryRequirementStorageRow[],
  opts: Omit<LegacyNormalizeRequirementOptions, 'strict'> = {},
) {
  const domainRows = (legacyRows ?? []).map((r) => {
    try {
      return { ok: true as const, row: mapProductInventoryRequirementFromStorage(r) };
    } catch (err) {
      return { ok: false as const, id: r?.id ?? '(sem id)', err: err as Error };
    }
  });

  const okRows = domainRows.flatMap((x) => (x.ok ? [x.row] : []));
  const mapperSkipped = domainRows.flatMap((x) =>
    x.ok ? [] : [{ requirement_id: x.id, reason: x.err.message }],
  );
  const res = normalizeInventoryProductRequirements(okRows, {
    expectedProviderType: opts.providerType,
  });
  return {
    normalized: res.normalized,
    skipped: [...mapperSkipped, ...res.skipped],
  };
}
