/**
 * Sprint 2.7 — Formatadores compartilhados dos relatórios V2.
 * Uso: apenas formatação. Não contém regra de negócio.
 */

export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} dias`;
}
