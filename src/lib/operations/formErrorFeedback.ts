import { toast } from 'sonner';
import type { FieldErrors } from 'react-hook-form';

/**
 * Core-generic field labels for inventory forms. This map MUST NOT contain
 * connectivity concepts (router, SIM, IMEI, ICCID, APN, Wi-Fi). Vertical Packs
 * pass their own label maps explicitly via `showFormErrors(errors, options)`.
 */
export const CORE_FIELD_LABELS: Record<string, string> = {
  name: 'Nome do item',
  category_id: 'Categoria',
  family_id: 'Família',
  location_id: 'Local atual',
  status: 'Status',
  unit_of_measure: 'Unidade de medida',
  quantity_total: 'Quantidade total',
  quantity_available: 'Quantidade disponível',
  quantity_minimum: 'Estoque mínimo',
  asset_code: 'Código patrimonial',
  serial_number: 'Número de série',
  brand: 'Marca',
  model: 'Modelo',
  notes: 'Observações',
  description: 'Descrição',
  technical_specs: 'Especificações técnicas',
};

export interface ShowFormErrorsOptions {
  /**
   * Extra label map layered on top of `CORE_FIELD_LABELS`. Consumers pass the
   * relevant Vertical Pack labels (for example
   * `CONNECTIVITY_INVENTORY_FIELD_LABELS`). Takes precedence over Core labels.
   */
  fieldLabels?: Record<string, string>;
}

function firstLeaf(errors: any, path: string[] = []): { path: string[]; message?: string } | null {
  if (!errors || typeof errors !== 'object') return null;
  if (typeof errors.message === 'string') {
    return { path, message: errors.message };
  }
  for (const key of Object.keys(errors)) {
    if (key === 'ref' || key === 'type') continue;
    const child = (errors as any)[key];
    const found = firstLeaf(child, [...path, key]);
    if (found) return found;
  }
  return null;
}

function findFocusTarget(path: string[]): HTMLElement | null {
  if (path.length === 0) return null;
  const ids = [path.join('.'), path[path.length - 1], path[0]];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  const invalid = document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]');
  if (invalid) return invalid;
  return null;
}

function resolveLabel(
  path: string[],
  extraLabels: Record<string, string> | undefined,
): string {
  const dotted = path.join('.');
  const leaf = path[path.length - 1];
  const head = path[0];
  const layered: Array<Record<string, string> | undefined> = [extraLabels, CORE_FIELD_LABELS];
  for (const key of [dotted, leaf, head]) {
    for (const map of layered) {
      if (map && map[key]) return map[key];
    }
  }
  return head ?? dotted;
}

/**
 * The second parameter is typed loosely so that `showFormErrors` can be passed
 * directly as the `handleSubmit` error handler (react-hook-form invokes it as
 * `(errors, event)`). When called explicitly, pass a `ShowFormErrorsOptions`.
 */
export function showFormErrors(errors: FieldErrors, optionsOrEvent?: unknown): void {
  const leaf = firstLeaf(errors);
  if (!leaf) {
    toast.error('Revise os campos destacados antes de continuar.');
    return;
  }
  const options: ShowFormErrorsOptions =
    optionsOrEvent && typeof optionsOrEvent === 'object' && 'fieldLabels' in optionsOrEvent
      ? (optionsOrEvent as ShowFormErrorsOptions)
      : {};
  const label = resolveLabel(leaf.path, options.fieldLabels);
  const msg = leaf.message ? `${label}: ${leaf.message}` : `Revise o campo "${label}".`;
  toast.error(msg);

  requestAnimationFrame(() => {
    const target = findFocusTarget(leaf.path);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (typeof (target as HTMLInputElement).focus === 'function') {
        try {
          (target as HTMLInputElement).focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }
    }
  });
}
