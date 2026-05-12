/**
 * Cálculo unificado de margem de produto/serviço.
 *
 * Regra:
 *  - revenue = preço efetivo do modo (avulso: price; recorrente: monthly_price;
 *    ponto-dia: unit_price_point_day × points × days)
 *  - tax_amount = revenue × (tax_percent / 100)
 *  - net_revenue = revenue − tax_amount
 *  - margin% = (net_revenue − cost) / net_revenue × 100  (quando net_revenue > 0)
 */

export type BillingType = 'one_time' | 'recurring' | 'point_day';

export interface MarginInput {
  billing_type: BillingType;
  price?: number | null;
  monthly_price?: number | null;
  point_day_price?: number | null;
  points?: number | null;
  days?: number | null;
  cost?: number | null;
  tax_percent?: number | null;
}

export interface MarginResult {
  revenue: number;
  tax_amount: number;
  net_revenue: number;
  cost: number;
  margin_amount: number;
  margin_percent: number;
  has_data: boolean;
}

const num = (v: number | null | undefined) => (typeof v === 'number' && !isNaN(v) ? v : 0);

export function computeRevenue(input: MarginInput): number {
  switch (input.billing_type) {
    case 'recurring':
      return num(input.monthly_price);
    case 'point_day':
      return num(input.point_day_price) * (num(input.points) || 1) * (num(input.days) || 1);
    case 'one_time':
    default:
      return num(input.price);
  }
}

export function computeMargin(input: MarginInput): MarginResult {
  const revenue = computeRevenue(input);
  const taxPct = num(input.tax_percent);
  const cost = num(input.cost);
  const tax_amount = revenue * (taxPct / 100);
  const net_revenue = revenue - tax_amount;
  const margin_amount = net_revenue - cost;
  const margin_percent = net_revenue > 0 ? (margin_amount / net_revenue) * 100 : 0;
  return {
    revenue,
    tax_amount,
    net_revenue,
    cost,
    margin_amount,
    margin_percent,
    has_data: revenue > 0 || cost > 0,
  };
}
