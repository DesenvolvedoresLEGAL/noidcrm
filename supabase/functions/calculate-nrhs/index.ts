// Edge Function: calculate-nrhs (Sprint Scoring 1.4 — NRHS v1)
// Computes the NOID Revenue Hygiene Score for a single opportunity using the
// official additive formula (6 pillars + critical penalties).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type NRHSStatus = 'healthy' | 'risk' | 'critical' | 'unhealthy';

interface PillarItem {
  code: string;
  label: string;
  points: number;
  achieved: boolean;
}

interface Pillar {
  score: number;
  max: number;
  items: PillarItem[];
}

interface Blocker {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  description: string;
  how_to_fix: string;
  penalty: number;
}

interface Gap {
  field: string;
  label: string;
  impact: string;
  recommended_action: string;
}

interface Recommendation {
  priority: 'low' | 'medium' | 'high';
  action: string;
  reason: string;
  expected_impact: string;
  target_field: string;
}

const STAGE_SLA_DAYS: Record<string, number> = {
  default: 5,
  'qualificação': 7,
  'qualificacao': 7,
  'opp': 7,
  'proposta na mesa': 3,
  'proposta': 3,
  'negociação': 2,
  'negociacao': 2,
  'pré-aprovação': 2,
  'pre-aprovacao': 2,
  'contrato': 2,
};

const ADVANCED_STAGE_KEYWORDS = [
  'proposta', 'negocia', 'contrato', 'pré-aprov', 'pre-aprov', 'fechamento',
];

function statusFromScore(score: number): NRHSStatus {
  if (score >= 75) return 'healthy';
  if (score >= 50) return 'risk';
  if (score >= 25) return 'critical';
  return 'unhealthy';
}

function tierFromStatus(status: NRHSStatus): string {
  // Backwards compat with nrhs_tier check constraint (elite/healthy/risk/critical/insalubrious).
  if (status === 'unhealthy') return 'insalubrious';
  return status;
}

function isAdvancedStage(stageName: string | null | undefined): boolean {
  if (!stageName) return false;
  const n = stageName.toLowerCase();
  return ADVANCED_STAGE_KEYWORDS.some((k) => n.includes(k));
}

function slaForStage(stageName: string | null | undefined): number {
  if (!stageName) return STAGE_SLA_DAYS.default;
  const n = stageName.toLowerCase().trim();
  return STAGE_SLA_DAYS[n] ?? STAGE_SLA_DAYS.default;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function addItem(p: Pillar, code: string, label: string, points: number, achieved: boolean) {
  p.items.push({ code, label, points, achieved });
  if (achieved) p.score += points;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ---------- PILLARS ----------

function pillarIntegrity(opp: any, account: any): Pillar {
  const p: Pillar = { score: 0, max: 25, items: [] };
  addItem(p, 'amount', 'Valor da oportunidade preenchido', 4, !!opp.valor_previsto && opp.valor_previsto > 0);
  addItem(p, 'account', 'Conta vinculada', 3, !!opp.account_id);
  addItem(p, 'primary_contact', 'Contato principal vinculado', 4, !!opp.contact_id);
  addItem(p, 'stage', 'Estágio definido', 3, !!opp.stage_id);
  addItem(p, 'source', 'Origem preenchida', 2, !!(opp.source || opp.lead_source));
  addItem(p, 'expected_close_date', 'Data prevista de fechamento', 3, !!opp.close_date_prevista);
  addItem(p, 'owner', 'Responsável definido', 3, !!opp.owner_user_id);
  addItem(p, 'pipeline', 'Pipeline correto', 2, !!opp.pipeline_id);
  addItem(p, 'segment', 'Segmento da conta', 1, !!(account?.segment || account?.segmento));
  addItem(p, 'company_size', 'Porte da conta', 1, !!(account?.company_size || account?.porte));
  p.score = clamp(p.score, 0, 25);
  return p;
}

function pillarCadence(opp: any, activities: any[], stageName: string, now: Date): Pillar {
  const p: Pillar = { score: 0, max: 20, items: [] };
  const open = activities.filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && !a.deleted_at);
  const completed = activities.filter((a) => a.status === 'completed' && a.completed_at);
  const overdue = open.filter((a) => a.scheduled_date && new Date(a.scheduled_date) < now);
  const next = open
    .filter((a) => a.scheduled_date && new Date(a.scheduled_date) >= now)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];

  const lastActivityAt = [
    ...completed.map((a) => new Date(a.completed_at)),
    ...activities.filter((a) => a.updated_at).map((a) => new Date(a.updated_at)),
  ].sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSinceLast = lastActivityAt ? daysBetween(now, lastActivityAt) : 999;

  addItem(p, 'has_next_activity', 'Tem próxima atividade', 6, !!next);
  if (next) {
    const sla = slaForStage(stageName);
    const daysUntil = daysBetween(new Date(next.scheduled_date), now);
    addItem(p, 'next_within_sla', `Próxima atividade dentro do SLA (${sla}d)`, 4, daysUntil <= sla);
  } else {
    addItem(p, 'next_within_sla', 'Próxima atividade dentro do SLA', 4, false);
  }
  addItem(p, 'recent_completed', 'Atividade concluída últimos 3 dias', 4, daysSinceLast <= 3);
  addItem(p, 'no_overdue', 'Sem atividade vencida', 3, overdue.length === 0);
  addItem(p, 'followup_coherent', 'Follow-up coerente com estágio', 3, !!next && overdue.length === 0);

  // internal pillar penalties
  if (!next) p.score = Math.floor(p.score / 2);
  if (overdue.length === 1) p.score -= 5;
  if (overdue.length >= 2) p.score -= 10;
  if (daysSinceLast >= 14 && daysSinceLast < 30) p.score -= 10;
  if (daysSinceLast >= 30) p.score = 0;

  p.score = clamp(p.score, 0, 20);
  return p;
}

function pillarStakeholders(contacts: any[], opp: any, stageName: string): { pillar: Pillar; missingDecisor: boolean } {
  const p: Pillar = { score: 0, max: 20, items: [] };
  const primary = contacts.find((c) => c.id === opp.contact_id) ?? contacts[0];
  const decisor = contacts.find((c) => {
    const cargo = (c.cargo || '').toLowerCase();
    return /diretor|ceo|cfo|coo|cto|presidente|s[oó]cio|founder|owner|chefe|head/.test(cargo);
  });

  const validEmail = primary?.emails && (Array.isArray(primary.emails)
    ? primary.emails.some((e: any) => typeof e === 'string' ? /@/.test(e) : e?.email && /@/.test(e.email))
    : false);
  const validPhone = primary?.telefones && Array.isArray(primary.telefones) && primary.telefones.length > 0;

  addItem(p, 'primary_valid', 'Contato principal válido', 4, !!primary);
  addItem(p, 'email_valid', 'Email válido', 3, !!validEmail);
  addItem(p, 'phone_valid', 'Telefone válido', 3, !!validPhone);
  addItem(p, 'has_role', 'Cargo preenchido', 2, !!primary?.cargo);
  addItem(p, 'decisor', 'Decisor identificado', 5, !!decisor);
  addItem(p, 'influencer', 'Influenciador/usuário envolvido', 2, contacts.length >= 2);

  const advanced = isAdvancedStage(stageName);
  addItem(p, 'finance_role_advanced', 'Financeiro/comprador em estágio avançado', 3,
    advanced && contacts.some((c) => /financ|compra|procurement/i.test(c.cargo || '')));

  p.score = clamp(p.score, 0, 20);
  const missingDecisor = advanced && !decisor;
  return { pillar: p, missingDecisor };
}

function pillarWinLoss(opp: any): Pillar {
  const p: Pillar = { score: 0, max: 15, items: [] };
  const meta = opp.metadata || {};
  addItem(p, 'pain', 'Dor registrada', 3, !!(meta.pain || opp.pain || opp.dor));
  addItem(p, 'objection', 'Objeção registrada', 3, !!(meta.objection || opp.objection || opp.objecao));
  addItem(p, 'competitor', 'Concorrente identificado', 2, !!(meta.competitor || opp.competitor || opp.concorrente));
  addItem(p, 'advance_reason', 'Motivo de avanço registrado', 2, !!(meta.advance_reason || meta.motivo_avanco));
  addItem(p, 'risk_reason', 'Risco/motivo de perda provável', 2, !!(meta.risk_reason || opp.lost_reason));
  addItem(p, 'next_action', 'Próxima ação clara', 3, !!(meta.next_action || meta.next_step));
  p.score = clamp(p.score, 0, 15);
  return p;
}

function pillarProcess(opp: any, stageName: string, pipelineType: string | null): Pillar {
  const p: Pillar = { score: 0, max: 10, items: [] };
  addItem(p, 'pipeline_correct', 'No pipeline correto', 2, pipelineType === 'sales' || pipelineType === 'qualification');
  addItem(p, 'stage_coherent', 'Estágio coerente com maturidade', 2, !!opp.stage_id);
  addItem(p, 'no_skip', 'Não pulou etapa crítica', 2, true);
  const advanced = isAdvancedStage(stageName);
  const prob = opp.probability ?? null;
  let probOk = true;
  if (prob != null && advanced && prob < 30) probOk = false;
  if (prob != null && !advanced && prob > 80) probOk = false;
  addItem(p, 'probability_coherent', 'Probabilidade coerente com estágio', 2, probOk);
  addItem(p, 'status_coherent', 'Status comercial coerente', 2, opp.status !== 'lost' && opp.status !== 'won');
  p.score = clamp(p.score, 0, 10);
  return p;
}

function pillarEvidence(opp: any, activities: any[], emails: any[], proposals: any[], now: Date): Pillar {
  const p: Pillar = { score: 0, max: 10, items: [] };
  const recent = (d?: string | null) => !!d && daysBetween(now, new Date(d)) <= 14;
  const hasEmail = emails.some((e) => recent(e.sent_at));
  const hasCall = activities.some((a) => a.type === 'call' && a.status === 'completed' && recent(a.completed_at));
  const hasMeeting = activities.some((a) => a.type === 'meeting' && a.status === 'completed' && recent(a.completed_at));
  const hasProposal = proposals.some((pr) => recent(pr.sent_at) || recent(pr.viewed_at));
  const hasNote = activities.some((a) => a.type === 'note' && a.description && a.description.length > 20);

  addItem(p, 'recent_email', 'Email/WhatsApp recente', 2, hasEmail);
  addItem(p, 'call_done', 'Call realizada', 2, hasCall);
  addItem(p, 'meeting_done', 'Reunião registrada', 2, hasMeeting);
  addItem(p, 'proposal_evidence', 'Proposta enviada/visualizada', 2, hasProposal);
  addItem(p, 'useful_notes', 'Notas comerciais úteis', 2, hasNote);
  p.score = clamp(p.score, 0, 10);
  return p;
}

// ---------- BLOCKERS / GAPS / RECOMMENDATIONS ----------

function buildBlockers(opp: any, stageName: string, contacts: any[], activities: any[], proposals: any[], now: Date, missingDecisor: boolean): Blocker[] {
  const b: Blocker[] = [];
  const advanced = isAdvancedStage(stageName);
  const open = activities.filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && !a.deleted_at);
  const overdue = open.filter((a) => a.scheduled_date && new Date(a.scheduled_date) < now);
  const next = open.find((a) => a.scheduled_date && new Date(a.scheduled_date) >= now);
  const lastActivityAt = activities
    .map((a) => new Date(a.completed_at || a.updated_at || 0))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysStale = lastActivityAt ? daysBetween(now, lastActivityAt) : 999;

  const push = (code: string, severity: Blocker['severity'], label: string, description: string, how_to_fix: string, penalty: number) =>
    b.push({ code, severity, label, description, how_to_fix, penalty });

  if (!opp.owner_user_id) push('no_owner', 'critical', 'Sem responsável', 'Oportunidade sem owner.', 'Atribua um responsável.', 20);
  if (!opp.contact_id) push('no_primary_contact', 'high', 'Sem contato principal', 'Oportunidade sem contato principal vinculado.', 'Vincule o contato principal.', 15);
  if (missingDecisor) push('no_decisor', 'critical', 'Sem decisor identificado', 'Em estágio avançado sem decisor.', 'Marque um contato como decisor.', 20);
  if (!next) push('no_next_activity', 'high', 'Sem próxima atividade', 'Deal sem próximo passo agendado.', 'Crie a próxima atividade com data.', 20);
  if (advanced && !(opp.valor_previsto > 0)) push('no_amount', 'high', 'Sem valor em estágio avançado', 'Sem valor previsto definido.', 'Preencha o valor da oportunidade.', 15);
  if (advanced && !opp.close_date_prevista) push('no_expected_close_date', 'medium', 'Sem data prevista', 'Sem data prevista de fechamento.', 'Defina a data prevista.', 10);
  if (overdue.length === 1) push('overdue_activity', 'medium', 'Atividade vencida', '1 atividade está vencida.', 'Conclua ou reagende.', 10);
  if (overdue.length >= 2) push('multiple_overdue_activities', 'high', 'Múltiplas atividades vencidas', `${overdue.length} atividades vencidas.`, 'Conclua ou reagende as atividades.', 20);
  if (daysStale >= 14 && daysStale < 30) push('stale_stage_14d', 'medium', 'Sem movimento há 14d+', `Sem movimento há ${daysStale} dias.`, 'Registre uma interação.', 15);
  if (daysStale >= 30) push('stale_stage_30d', 'critical', 'Sem movimento há 30d+', `Sem movimento há ${daysStale} dias.`, 'Reative ou perca o deal.', 30);
  if (!opp.source && !opp.lead_source) push('missing_source', 'low', 'Origem ausente', 'Origem não preenchida.', 'Preencha a origem do lead.', 5);

  const expiredProposal = proposals.some((p) => p.status === 'expired' || (p.expires_at && new Date(p.expires_at) < now && p.status !== 'accepted'));
  if (expiredProposal) push('proposal_expired', 'high', 'Proposta vencida', 'Existe proposta vencida.', 'Reenvie ou renegocie a proposta.', 15);

  return b;
}

function buildGaps(opp: any, account: any, contacts: any[]): Gap[] {
  const g: Gap[] = [];
  const meta = opp.metadata || {};
  const add = (field: string, label: string, impact: string, action: string, cond: boolean) => {
    if (cond) g.push({ field, label, impact, recommended_action: action });
  };
  add('segment', 'Segmento ausente', 'Reduz qualidade de segmentação', 'Preencha o segmento da conta', !(account?.segment || account?.segmento));
  add('company_size', 'Porte ausente', 'Reduz capacidade de qualificação', 'Preencha o porte da conta', !(account?.company_size || account?.porte));
  add('source', 'Origem ausente', 'Reduz atribuição de marketing', 'Preencha a origem', !(opp.source || opp.lead_source));
  add('pain', 'Dor não registrada', 'Reduz qualidade do discurso', 'Registre a dor do cliente', !(meta.pain || opp.pain));
  add('objection', 'Objeção não registrada', 'Reduz preparação para fechamento', 'Registre objeções identificadas', !(meta.objection || opp.objection));
  add('competitor', 'Concorrente não identificado', 'Reduz inteligência competitiva', 'Identifique o concorrente', !(meta.competitor || opp.competitor));
  add('contact_role', 'Cargo do contato ausente', 'Dificulta identificar decisor', 'Preencha o cargo', !contacts.some((c) => c.cargo));
  add('next_step', 'Próximo passo ausente', 'Reduz previsibilidade', 'Defina o próximo passo', !(meta.next_step || meta.next_action));
  add('expected_close_date', 'Data prevista ausente', 'Reduz confiabilidade do forecast', 'Preencha a data prevista', !opp.close_date_prevista);
  return g;
}

function buildRecommendations(blockers: Blocker[], gaps: Gap[]): Recommendation[] {
  const recs: Recommendation[] = [];
  for (const b of blockers) {
    let target = '';
    let action = b.label;
    switch (b.code) {
      case 'no_decisor': target = 'decision_maker'; action = 'Identificar decisor'; break;
      case 'no_next_activity': target = 'next_activity'; action = 'Criar próxima atividade'; break;
      case 'no_primary_contact': target = 'contact_id'; action = 'Vincular contato principal'; break;
      case 'no_amount': target = 'valor_previsto'; action = 'Preencher valor da oportunidade'; break;
      case 'no_expected_close_date': target = 'close_date_prevista'; action = 'Preencher data prevista'; break;
      case 'overdue_activity':
      case 'multiple_overdue_activities': target = 'activities'; action = 'Concluir atividades vencidas'; break;
      case 'stale_stage_14d':
      case 'stale_stage_30d': target = 'next_activity'; action = 'Registrar movimento na oportunidade'; break;
      case 'proposal_expired': target = 'proposal'; action = 'Revisar proposta vencida'; break;
      case 'missing_source': target = 'source'; action = 'Preencher origem'; break;
      case 'no_owner': target = 'owner_user_id'; action = 'Atribuir responsável'; break;
      default: target = b.code;
    }
    recs.push({
      priority: b.severity === 'critical' ? 'high' : (b.severity === 'high' ? 'high' : 'medium'),
      action,
      reason: b.description,
      expected_impact: `+${b.penalty} NRHS`,
      target_field: target,
    });
  }
  for (const g of gaps.slice(0, 5)) {
    recs.push({
      priority: 'low',
      action: g.recommended_action,
      reason: g.impact,
      expected_impact: '+1-3 NRHS',
      target_field: g.field,
    });
  }
  return recs;
}

// ---------- MAIN ----------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const opportunityId: string | undefined = body.opportunity_id;
    const orgIdInput: string | undefined = body.organization_id || body.org_id;
    const triggerSource: string = body.trigger_source ?? 'manual';
    const triggerAction: string = body.trigger_action ?? 'recalculate';

    if (!opportunityId) {
      return new Response(JSON.stringify({ error: 'opportunity_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: opportunity, error: oppErr } = await supabase
      .from('opportunities').select('*').eq('id', opportunityId).maybeSingle();
    if (oppErr || !opportunity) {
      return new Response(JSON.stringify({ error: 'opportunity not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (orgIdInput && opportunity.organization_id !== orgIdInput) {
      return new Response(JSON.stringify({ error: 'org mismatch' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [stageRes, accountRes, activitiesRes, contactsRes, proposalsRes, emailsRes, pipelineRes] = await Promise.all([
      opportunity.stage_id
        ? supabase.from('pipeline_stages').select('id, name, position').eq('id', opportunity.stage_id).maybeSingle()
        : Promise.resolve({ data: null }),
      opportunity.account_id
        ? supabase.from('accounts').select('id, segment, segmento, company_size, porte').eq('id', opportunity.account_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('activities').select('*').eq('opportunity_id', opportunityId).is('deleted_at', null),
      opportunity.account_id
        ? supabase.from('contacts').select('*').eq('account_id', opportunity.account_id).is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      supabase.from('proposals').select('id, status, sent_at, viewed_at, expires_at').eq('opportunity_id', opportunityId),
      supabase.from('opportunity_emails').select('id, sent_at, opened_at').eq('opportunity_id', opportunityId).order('sent_at', { ascending: false }).limit(20),
      opportunity.pipeline_id
        ? supabase.from('pipelines').select('id, pipeline_type').eq('id', opportunity.pipeline_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const stageName = (stageRes.data as any)?.name ?? '';
    const account = accountRes.data ?? {};
    const activities = (activitiesRes.data as any[]) ?? [];
    const contacts = (contactsRes.data as any[]) ?? [];
    const proposals = (proposalsRes.data as any[]) ?? [];
    const emails = (emailsRes.data as any[]) ?? [];
    const pipelineType = (pipelineRes.data as any)?.pipeline_type ?? null;
    const now = new Date();

    const integrity = pillarIntegrity(opportunity, account);
    const cadence = pillarCadence(opportunity, activities, stageName, now);
    const stk = pillarStakeholders(contacts, opportunity, stageName);
    const stakeholders = stk.pillar;
    const winLoss = pillarWinLoss(opportunity);
    const process = pillarProcess(opportunity, stageName, pipelineType);
    const evidence = pillarEvidence(opportunity, activities, emails, proposals, now);

    const blockers = buildBlockers(opportunity, stageName, contacts, activities, proposals, now, stk.missingDecisor);
    const gaps = buildGaps(opportunity, account, contacts);
    const recommendations = buildRecommendations(blockers, gaps);

    const pillarsTotal = integrity.score + cadence.score + stakeholders.score + winLoss.score + process.score + evidence.score;
    const penaltiesTotal = blockers.reduce((s, b) => s + b.penalty, 0);
    const finalScore = clamp(Math.round(pillarsTotal - penaltiesTotal), 0, 100);
    const status = statusFromScore(finalScore);
    const tier = tierFromStatus(status);

    const metadata = {
      formula_version: 'nrhs_v1',
      data_integrity: { score: integrity.score, max: integrity.max, items: integrity.items },
      cadence: { score: cadence.score, max: cadence.max, items: cadence.items },
      stakeholders: { score: stakeholders.score, max: stakeholders.max, items: stakeholders.items },
      win_loss: { score: winLoss.score, max: winLoss.max, items: winLoss.items },
      process_adherence: { score: process.score, max: process.max, items: process.items },
      evidence: { score: evidence.score, max: evidence.max, items: evidence.items },
      penalties: blockers.map((b) => ({ code: b.code, penalty: b.penalty })),
      blockers,
      gaps,
      recommendations,
      calculated_at: now.toISOString(),
    };

    const previousScore = opportunity.nrhs_score ?? null;
    const previousStatus = opportunity.nrhs_status ?? null;

    const { error: updErr } = await supabase
      .from('opportunities')
      .update({
        nrhs_score: finalScore,
        nrhs_status: status,
        nrhs_tier: tier,
        nrhs_data_integrity_score: integrity.score,
        nrhs_cadence_score: cadence.score,
        nrhs_stakeholders_score: stakeholders.score,
        nrhs_win_loss_score: winLoss.score,
        nrhs_process_adherence_score: process.score,
        nrhs_evidence_score: evidence.score,
        nrhs_blockers: blockers.map((b) => b.code),
        nrhs_gaps: gaps,
        nrhs_recommendations: recommendations,
        nrhs_metadata: metadata,
        nrhs_breakdown: metadata,
        nrhs_issues_count: blockers.length + gaps.length,
        nrhs_last_calculated_at: now.toISOString(),
        nrhs_updated_at: now.toISOString(),
        forecast_hygiene_eligible: finalScore >= 70,
        ote_hygiene_eligible: finalScore >= 75,
      })
      .eq('id', opportunityId);

    if (updErr) {
      console.error('[calculate-nrhs] update error:', updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // History
    await supabase.from('score_history').insert({
      organization_id: opportunity.organization_id,
      entity_type: 'opportunity',
      entity_id: opportunityId,
      score_type: 'nrhs',
      old_value: previousScore,
      new_value: finalScore,
      change_reason: triggerSource,
      factors: {
        previous_status: previousStatus,
        new_status: status,
        components: {
          data_integrity: integrity.score,
          cadence: cadence.score,
          stakeholders: stakeholders.score,
          win_loss: winLoss.score,
          process_adherence: process.score,
          evidence: evidence.score,
        },
        blockers: blockers.map((b) => b.code),
        gaps: gaps.map((g) => g.field),
        recommendations: recommendations.length,
        formula_version: 'nrhs_v1',
        trigger_action: triggerAction,
      },
    });

    // Learning signal
    await supabase.from('nrhs_learning_signals').insert({
      organization_id: opportunity.organization_id,
      opportunity_id: opportunityId,
      account_id: opportunity.account_id,
      event_type: 'nrhs_recalculated',
      nrhs_score_at_event: finalScore,
      outcome: status,
      event_value: { previous_score: previousScore, blockers: blockers.length, gaps: gaps.length, trigger_source: triggerSource },
    });

    return new Response(
      JSON.stringify({
        success: true,
        score: finalScore,
        status,
        tier,
        pillars: {
          data_integrity: integrity.score,
          cadence: cadence.score,
          stakeholders: stakeholders.score,
          win_loss: winLoss.score,
          process_adherence: process.score,
          evidence: evidence.score,
        },
        blockers,
        gaps,
        recommendations,
        metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[calculate-nrhs] error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
