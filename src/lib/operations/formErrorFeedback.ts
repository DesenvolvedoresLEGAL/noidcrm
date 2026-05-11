import { toast } from 'sonner';
import type { FieldErrors } from 'react-hook-form';

const FIELD_LABELS: Record<string, string> = {
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
  router_factory: 'Dados de fábrica do roteador',
  sim_card_factory: 'Dados do chip',
  technical_specs: 'Especificações técnicas',
};

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
  // Try id by leaf or root key (we use ids on inputs like "name", "asset_code")
  const ids = [path.join('.'), path[0]];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  // Generic: any element with [aria-invalid="true"] inside the dialog
  const invalid = document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]');
  if (invalid) return invalid;
  return null;
}

export function showFormErrors(errors: FieldErrors): void {
  const leaf = firstLeaf(errors);
  if (!leaf) {
    toast.error('Revise os campos destacados antes de continuar.');
    return;
  }
  const rootKey = leaf.path[0];
  const label = FIELD_LABELS[rootKey] ?? rootKey;
  const msg = leaf.message ? `${label}: ${leaf.message}` : `Revise o campo "${label}".`;
  toast.error(msg);

  // Scroll to the offending field on the next frame so the toast doesn't race the layout
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
