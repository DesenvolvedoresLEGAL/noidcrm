// Currency and number formatting utilities for Brazilian locale

export function formatCurrencyBR(value: number): string {
  if (value === 0) return 'R$ 0';
  
  const absValue = Math.abs(value);
  
  // Format large numbers with abbreviations
  if (absValue >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `R$ ${(value / 1000).toFixed(absValue >= 10000 ? 0 : 1)}k`;
  }
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}
