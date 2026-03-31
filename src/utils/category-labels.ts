/**
 * Mapa centralizado de labels PT-BR para categorias de motivos de ganho/perda.
 * Usado em settings, modais e dashboards.
 */

export const LOSS_CATEGORY_LABELS: Record<string, string> = {
  price: 'Preço / Valor',
  competition: 'Concorrência',
  timing: 'Timing / Prioridade',
  operational: 'Operacional Cliente',
  internal: 'Erro Interno',
  no_fit: 'Sem Fit',
  sales_process: 'Processo Comercial',
  other: 'Outro',
  // Legacy values (caso ainda existam no banco)
  product: 'Sem Fit',
  relationship: 'Processo Comercial',
  service: 'Processo Comercial',
  brand: 'Preço / Valor',
};

export const WIN_CATEGORY_LABELS: Record<string, string> = {
  price: 'Preço / Valor',
  product: 'Produto / Solução',
  service: 'Atendimento',
  brand: 'Marca / Reputação',
  relationship: 'Relacionamento',
  timing: 'Timing',
  other: 'Outro',
};

export function getLossCategoryLabel(category?: string | null): string {
  if (!category) return '—';
  return LOSS_CATEGORY_LABELS[category] || category;
}

export function getWinCategoryLabel(category?: string | null): string {
  if (!category) return '—';
  return WIN_CATEGORY_LABELS[category] || category;
}
