// NOID-VERTICAL-1.0-VERT-01.2D-A
// Única fronteira autorizada a ler as colunas físicas legadas
// `eventrix_*` de `product_inventory_requirements` e transformá-las
// em `NormalizedProductInventoryRequirement` do domínio genérico.
//
// Regras:
// - Nenhum outro arquivo do domínio, hook, componente ou builder
//   deve replicar este mapeamento.
// - O default de provider_type é 'eventrix' porque a tabela atual
//   só carrega referências Eventrix. Quando o provider ativo é
//   Native, o consumidor deve tratar o resultado como
//   `unsupported`/`empty` — NÃO reinterpretar a referência.
// - Não inventa IMEI/ICCID/SSID/WiFi ou qualquer metadado técnico
//   de conectividade.

import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import type { InventoryProviderType } from '@/inventory/providers/types';
import { UNIT_BASIS_VALUES } from '@/schemas/productInventoryRequirement';
import {
  InventoryDemandNormalizationError,
  type NormalizedProductInventoryRequirement,
} from './types';

export interface NormalizeRequirementOptions {
  /**
   * Provider ao qual a referência legada pertence. Default: 'eventrix'.
   * Quando o tenant estiver em Native, o consumidor NÃO deve chamar
   * este normalizer — deve marcar a demanda como `unsupported`.
   */
  providerType?: InventoryProviderType;
  /**
   * Se `true` (padrão), lança `InventoryDemandNormalizationError`
   * para entradas inválidas. Se `false`, retorna `null`.
   */
  strict?: boolean;
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Normaliza um `ProductInventoryRequirement` legado (colunas físicas
 * `eventrix_*`) para o formato genérico do domínio.
 *
 * Retorna `null` em vez de lançar quando `strict === false` e a
 * entrada estiver malformada, para permitir uso defensivo em
 * builders/UI sem quebrar a página inteira.
 */
export function normalizeProductInventoryRequirement(
  req: ProductInventoryRequirement,
  opts: NormalizeRequirementOptions = {},
): NormalizedProductInventoryRequirement | null {
  const { providerType = 'eventrix', strict = true } = opts;

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

  const category_ref = trimOrNull(req.eventrix_category_id);
  const family_ref = trimOrNull(req.eventrix_family_id);
  const category_name =
    trimOrNull(req.eventrix_category_name) ?? category_ref ?? '';
  const family_name = trimOrNull(req.eventrix_family_name) ?? family_ref ?? '';

  if (!category_ref) {
    return fail('missing_category', 'Referência de categoria ausente.');
  }
  if (!family_ref) {
    return fail('missing_family', 'Referência de família ausente.');
  }
  if (!req.product_id) {
    return fail('missing_product', 'Produto de origem ausente.');
  }

  const quantity = Number(req.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fail(
      'invalid_quantity',
      `Quantidade inválida (${String(req.quantity)}).`,
    );
  }

  if (!UNIT_BASIS_VALUES.includes(req.unit_basis)) {
    return fail(
      'invalid_unit_basis',
      `Unit basis desconhecido: ${String(req.unit_basis)}.`,
    );
  }

  return {
    provider_type: providerType,
    category_ref,
    category_name,
    family_ref,
    family_name,
    item_kind: trimOrNull(req.eventrix_item_kind),
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

/**
 * Normaliza uma coleção descartando entradas inválidas silenciosamente.
 * O caller pode inspecionar o segundo elemento para diagnóstico local.
 */
export function normalizeProductInventoryRequirements(
  reqs: ProductInventoryRequirement[],
  opts: Omit<NormalizeRequirementOptions, 'strict'> = {},
): {
  normalized: NormalizedProductInventoryRequirement[];
  skipped: Array<{ requirement_id: string; reason: string }>;
} {
  const normalized: NormalizedProductInventoryRequirement[] = [];
  const skipped: Array<{ requirement_id: string; reason: string }> = [];
  for (const r of reqs ?? []) {
    try {
      const n = normalizeProductInventoryRequirement(r, {
        ...opts,
        strict: true,
      });
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
