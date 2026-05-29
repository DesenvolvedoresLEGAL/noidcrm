/**
 * Proposal Analytics Scoring Engine v2
 * --------------------------------------------------------------------------
 * Deterministic, version-stamped scoring that separates historical interest
 * from CURRENT engagement, recency, urgency and risk.
 *
 * IMPORTANT: AI must not invent scores. The numbers below are produced here
 * and the LLM only narrates / generates alerts respecting these scores.
 *
 * If the formula changes, bump PROPOSAL_ANALYTICS_SCORING_VERSION so the
 * Sprint A signature cache invalidates automatically.
 */

export const PROPOSAL_ANALYTICS_SCORING_VERSION = 'proposal-analytics-score-v2-2026-05';

export type EngagementLabel =
  | 'Sem engajamento'
  | 'Frio'
  | 'Morno com risco'
  | 'Engajado recente'
  | 'Quente agora'
  | 'Muito quente agora';

export type RiskLabel = 'baixo' | 'medio' | 'alto' | 'critico';

export type FollowupPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProbabilityTrend = 'up' | 'down' | 'neutral';

export interface ProposalScoringInput {
  proposal_status?: string | null;
  proposal_sent_at?: string | null;
  proposal_expires_at?: string | null;
  event_delivery_date?: string | null;
  event_return_date?: string | null;

  total_views: number;
  unique_visitors: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  last_viewed_at?: string | null;
  forwarded_count?: number;

  viewed_sections?: string[];
  attention_map?: Record<string, number>;
  payment_section_seen?: boolean;
  pricing_section_seen?: boolean;
  items_section_seen?: boolean;
  header_section_seen?: boolean;
  cta_section_seen?: boolean;

  last_commercial_activity_at?: string | null;
  last_customer_response_at?: string | null;
  pipeline_stage_probability?: number | null;
}

export interface ProposalScoringResult {
  scoring_version: string;

  historical_interest_score: number;
  current_engagement_score: number;
  recency_score: number;
  urgency_score: number;
  buying_intent_score: number;
  reading_quality_score: number;
  risk_score: number;

  close_probability: number;
  close_probability_trend: ProbabilityTrend;

  engagement_label: EngagementLabel;
  risk_label: RiskLabel;

  // Context for UI + LLM
  last_view_age_days: number | null;
  days_to_delivery: number | null;
  days_to_expiration: number | null;
  recency_multiplier: number;

  score_explanation: string;
  penalties: Array<{ key: string; value: number; reason: string }>;
  bonuses: Array<{ key: string; value: number; reason: string }>;

  recommended_followup_priority: FollowupPriority;
  insufficient_data: boolean;
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function recencyMultiplier(ageDays: number | null): number {
  if (ageDays === null) return 0;
  if (ageDays <= 1) return 1.0;
  if (ageDays <= 3) return 0.85;
  if (ageDays <= 7) return 0.65;
  if (ageDays <= 14) return 0.45;
  if (ageDays <= 30) return 0.2;
  return 0.05;
}

function urgencyMultiplier(daysToDelivery: number | null, daysToExp: number | null): number {
  // Urgency bumps engagement when there is recent interest, otherwise it amplifies risk
  let mult = 1.0;
  if (daysToDelivery !== null) {
    if (daysToDelivery <= 3) mult *= 1.15;
    else if (daysToDelivery <= 7) mult *= 1.08;
  }
  if (daysToExp !== null) {
    if (daysToExp <= 1 && daysToExp >= 0) mult *= 1.05;
  }
  return mult;
}

export function calculateProposalAnalyticsScore(
  input: ProposalScoringInput,
  now: Date = new Date(),
): ProposalScoringResult {
  const penalties: ProposalScoringResult['penalties'] = [];
  const bonuses: ProposalScoringResult['bonuses'] = [];

  const lastViewedAt = input.last_viewed_at ? new Date(input.last_viewed_at) : null;
  const lastViewAgeDays = lastViewedAt ? daysBetween(lastViewedAt, now) : null;

  const deliveryAt = input.event_delivery_date ? new Date(input.event_delivery_date) : null;
  const daysToDelivery = deliveryAt ? daysBetween(now, deliveryAt) : null;

  const expiresAt = input.proposal_expires_at ? new Date(input.proposal_expires_at) : null;
  const daysToExpiration = expiresAt ? daysBetween(now, expiresAt) : null;

  // ---- Insufficient data ----
  if (!input.total_views || input.total_views === 0) {
    return {
      scoring_version: PROPOSAL_ANALYTICS_SCORING_VERSION,
      historical_interest_score: 0,
      current_engagement_score: 0,
      recency_score: 0,
      urgency_score: 0,
      buying_intent_score: 0,
      reading_quality_score: 0,
      risk_score: 80,
      close_probability: input.pipeline_stage_probability ?? 0,
      close_probability_trend: 'neutral',
      engagement_label: 'Sem engajamento',
      risk_label: 'alto',
      last_view_age_days: null,
      days_to_delivery: daysToDelivery,
      days_to_expiration: daysToExpiration,
      recency_multiplier: 0,
      score_explanation: 'Proposta ainda não foi visualizada pelo cliente.',
      penalties: [{ key: 'no_views', value: 0, reason: 'Sem visualizações registradas' }],
      bonuses: [],
      recommended_followup_priority: 'high',
      insufficient_data: true,
    };
  }

  // ---- Historical interest (acumulado, sem decay) ----
  let historical = 0;
  historical += Math.min(25, 10 + (input.total_views - 1) * 5);
  if (input.unique_visitors > 1) historical += Math.min(15, input.unique_visitors * 5);
  const avgMin = (input.avg_duration_seconds || 0) / 60;
  historical += Math.min(30, Math.floor(avgMin * 10));
  const sectionsCount = input.viewed_sections?.length ?? 0;
  historical += Math.min(10, sectionsCount * 2);
  if (input.pricing_section_seen) historical += 5;
  if (input.payment_section_seen) historical += 5;
  if (input.items_section_seen) historical += 3;
  historical = clamp(historical);

  // ---- Recency score (0-100) ----
  const recMult = recencyMultiplier(lastViewAgeDays);
  const recencyScore = Math.round(recMult * 100);

  // ---- Reading quality ----
  let reading = 0;
  if (avgMin >= 3) reading += 35;
  else if (avgMin >= 2) reading += 25;
  else if (avgMin >= 1) reading += 15;
  else if (avgMin >= 0.5) reading += 8;
  if (sectionsCount >= 4) reading += 25;
  else if (sectionsCount >= 2) reading += 15;
  if (input.pricing_section_seen && input.payment_section_seen) reading += 25;
  else if (input.pricing_section_seen || input.payment_section_seen) reading += 12;
  reading = clamp(reading);

  // ---- Buying intent ----
  let buying = 0;
  if (input.pricing_section_seen) { buying += 18; bonuses.push({ key: 'pricing_seen', value: 18, reason: 'Cliente revisou preço' }); }
  if (input.payment_section_seen) { buying += 18; bonuses.push({ key: 'payment_seen', value: 18, reason: 'Cliente revisou condições de pagamento' }); }
  if (input.cta_section_seen) { buying += 10; bonuses.push({ key: 'cta_seen', value: 10, reason: 'Cliente alcançou CTA' }); }
  if (input.total_views >= 3 && (input.unique_visitors ?? 0) >= 1) { buying += 8; }
  if (lastViewAgeDays !== null && lastViewAgeDays <= 1) { buying += 12; bonuses.push({ key: 'view_today', value: 12, reason: 'Visualização nas últimas 24h' }); }
  buying = clamp(buying);

  // ---- Urgency score ----
  let urgency = 0;
  if (daysToDelivery !== null) {
    if (daysToDelivery <= 3) urgency += 70;
    else if (daysToDelivery <= 7) urgency += 50;
    else if (daysToDelivery <= 14) urgency += 25;
  }
  if (daysToExpiration !== null) {
    if (daysToExpiration <= 1 && daysToExpiration >= 0) urgency += 30;
    else if (daysToExpiration <= 3 && daysToExpiration >= 0) urgency += 15;
  }
  urgency = clamp(urgency);

  // ---- Risk score (high = bad) ----
  let risk = 0;
  if (lastViewAgeDays !== null) {
    if (lastViewAgeDays > 30) risk += 60;
    else if (lastViewAgeDays > 21) risk += 50;
    else if (lastViewAgeDays > 14) risk += 40;
    else if (lastViewAgeDays > 7) risk += 25;
    else if (lastViewAgeDays > 3) risk += 10;
  }
  if (daysToDelivery !== null && daysToDelivery <= 7 && (lastViewAgeDays ?? 0) > 7) {
    risk += 25;
    penalties.push({ key: 'delivery_no_recent_view', value: 25, reason: 'Entrega próxima sem nova interação' });
  }
  if (daysToExpiration !== null && daysToExpiration < 0) {
    risk += 30;
    penalties.push({ key: 'expired', value: 30, reason: 'Proposta vencida' });
  }
  if (!input.pricing_section_seen) {
    risk += 10;
    penalties.push({ key: 'pricing_not_seen', value: 10, reason: 'Preço não foi validado' });
  }
  if (!input.payment_section_seen) {
    risk += 8;
    penalties.push({ key: 'payment_not_seen', value: 8, reason: 'Condições de pagamento não vistas' });
  }
  if ((input.forwarded_count ?? 0) > 0 && (lastViewAgeDays ?? 99) > 7) {
    risk += 10;
    penalties.push({ key: 'forwarded_no_followup', value: 10, reason: 'Encaminhamento sem retorno do decisor' });
  }
  risk = clamp(risk);

  // ---- Current engagement (the headline number) ----
  const urgencyMult = urgencyMultiplier(daysToDelivery, daysToExpiration);
  let current = historical * recMult * urgencyMult + buying * 0.4 - risk * 0.6;
  current = clamp(Math.round(current));

  // ---- Mandatory caps (regra de negócio) ----
  if (lastViewAgeDays !== null) {
    if (lastViewAgeDays > 30 && current > 25) { penalties.push({ key: 'cap_30d', value: current - 25, reason: 'Cap: >30d sem visualização' }); current = 25; }
    else if (lastViewAgeDays > 21 && current > 35) { penalties.push({ key: 'cap_21d', value: current - 35, reason: 'Cap: >21d sem visualização' }); current = 35; }
    else if (lastViewAgeDays > 14 && current > 45) { penalties.push({ key: 'cap_14d', value: current - 45, reason: 'Cap: >14d sem visualização' }); current = 45; }
    else if (lastViewAgeDays > 7 && current > 60) { penalties.push({ key: 'cap_7d', value: current - 60, reason: 'Cap: >7d sem visualização' }); current = 60; }
  }
  if (daysToDelivery !== null && daysToDelivery <= 7 && (lastViewAgeDays ?? 0) > 7 && current > 40) {
    penalties.push({ key: 'cap_delivery_7d', value: current - 40, reason: 'Entrega ≤7d sem leitura recente' });
    current = 40;
  }
  if (daysToDelivery !== null && daysToDelivery <= 3 && (lastViewAgeDays ?? 0) > 3 && current > 35) {
    penalties.push({ key: 'cap_delivery_3d', value: current - 35, reason: 'Entrega ≤3d sem leitura recente' });
    current = 35;
  }
  if (daysToExpiration !== null && daysToExpiration < 0 && current > 25) {
    penalties.push({ key: 'cap_expired', value: current - 25, reason: 'Proposta vencida' });
    current = 25;
  }
  if (!input.pricing_section_seen && current > 65) {
    penalties.push({ key: 'cap_no_pricing', value: current - 65, reason: 'Preço não visto' });
    current = 65;
  }
  if (!input.payment_section_seen && current > 70) {
    penalties.push({ key: 'cap_no_payment', value: current - 70, reason: 'Pagamento não visto' });
    current = 70;
  }

  // ---- Engagement label (respeita caps de recência) ----
  let label: EngagementLabel;
  if (current < 20) label = 'Sem engajamento';
  else if (current < 40) label = 'Frio';
  else if (current < 60) label = 'Morno com risco';
  else if (current < 75) label = 'Engajado recente';
  else if (current < 90) label = 'Quente agora';
  else label = 'Muito quente agora';

  if (lastViewAgeDays !== null) {
    if (lastViewAgeDays > 14) {
      // máximo Frio
      if (label === 'Morno com risco' || label === 'Engajado recente' || label === 'Quente agora' || label === 'Muito quente agora') {
        label = current >= 30 ? 'Frio' : 'Sem engajamento';
      }
    } else if (lastViewAgeDays > 7) {
      // máximo Morno com risco
      if (label === 'Engajado recente' || label === 'Quente agora' || label === 'Muito quente agora') {
        label = 'Morno com risco';
      }
    }
  }

  // ---- Risk label ----
  let riskLabel: RiskLabel;
  if (risk >= 70) riskLabel = 'critico';
  else if (risk >= 45) riskLabel = 'alto';
  else if (risk >= 25) riskLabel = 'medio';
  else riskLabel = 'baixo';

  // ---- Close probability + trend ----
  const base = input.pipeline_stage_probability ?? 30;
  let prob = base
    + (buying * 0.25)
    + (recencyScore * 0.10)
    - (risk * 0.35)
    - (daysToExpiration !== null && daysToExpiration < 0 ? 25 : 0);
  prob = clamp(Math.round(prob));

  let trend: ProbabilityTrend = 'neutral';
  if ((lastViewAgeDays ?? 99) <= 3 && buying >= 30) trend = 'up';
  if ((lastViewAgeDays ?? 0) > 7) trend = 'down';
  if ((lastViewAgeDays ?? 0) > 14) trend = 'down';
  if (daysToDelivery !== null && daysToDelivery <= 7 && (lastViewAgeDays ?? 0) > 7) trend = 'down';
  if (daysToExpiration !== null && daysToExpiration <= 2 && (lastViewAgeDays ?? 0) > 2) trend = 'down';

  // ---- Followup priority ----
  let priority: FollowupPriority = 'medium';
  if (risk >= 60 || (daysToDelivery !== null && daysToDelivery <= 3 && (lastViewAgeDays ?? 0) > 3)) priority = 'urgent';
  else if (risk >= 35 || (lastViewAgeDays ?? 0) > 7) priority = 'high';
  else if (current >= 75 && (lastViewAgeDays ?? 99) <= 1) priority = 'high';
  else if (current < 40) priority = 'low';

  // ---- Explanation microcopy ----
  const expl: string[] = [];
  if (historical >= 60 && (lastViewAgeDays ?? 0) > 7) {
    expl.push('Leitura histórica forte, mas sinal atual fraco.');
  } else if (current >= 75 && (lastViewAgeDays ?? 99) <= 1) {
    expl.push('Cliente voltou hoje e demonstrou interesse comercial.');
  } else if (lastViewAgeDays !== null && lastViewAgeDays > 14) {
    expl.push(`Sem nova visualização há ${lastViewAgeDays} dias.`);
  } else if (lastViewAgeDays !== null) {
    expl.push(`Última visualização há ${lastViewAgeDays} dia${lastViewAgeDays === 1 ? '' : 's'}.`);
  }
  if (daysToDelivery !== null && daysToDelivery <= 7 && daysToDelivery >= 0) {
    expl.push(`Entrega em ${daysToDelivery} dia${daysToDelivery === 1 ? '' : 's'}.`);
  }
  if (daysToExpiration !== null && daysToExpiration < 0) {
    expl.push('Proposta vencida.');
  } else if (daysToExpiration !== null && daysToExpiration <= 2) {
    expl.push(`Proposta vence em ${daysToExpiration} dia${daysToExpiration === 1 ? '' : 's'}.`);
  }
  if (!input.pricing_section_seen) expl.push('Preço ainda não foi validado.');
  if (!input.payment_section_seen) expl.push('Condições de pagamento não vistas.');

  return {
    scoring_version: PROPOSAL_ANALYTICS_SCORING_VERSION,
    historical_interest_score: historical,
    current_engagement_score: current,
    recency_score: recencyScore,
    urgency_score: urgency,
    buying_intent_score: buying,
    reading_quality_score: reading,
    risk_score: risk,
    close_probability: prob,
    close_probability_trend: trend,
    engagement_label: label,
    risk_label: riskLabel,
    last_view_age_days: lastViewAgeDays,
    days_to_delivery: daysToDelivery,
    days_to_expiration: daysToExpiration,
    recency_multiplier: recMult,
    score_explanation: expl.join(' ') || 'Sinais comerciais equilibrados.',
    penalties,
    bonuses,
    recommended_followup_priority: priority,
    insufficient_data: false,
  };
}
