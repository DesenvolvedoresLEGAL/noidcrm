// Shared engine for evaluating cooldown + granular send policy for AI agents.
// Used by execute-email-agent-run and approve-email-agent-action.

export type PolicyDecision =
  | { mode: 'auto_send'; reason: string }
  | { mode: 'require_approval'; reason: string }
  | { mode: 'block'; reason: string };

export interface PolicyContext {
  confidence: number;
  risk: number;
  deal_value: number | null;
  hours_since_last_contact: number | null;
  emails_sent_to_contact_7d: number;
}

export interface PolicyRules {
  auto_send_rules: {
    confidence_min?: number;
    deal_value_max?: number;
    risk_max?: number;
  };
  require_approval_rules: {
    deal_value_min?: number;
    risk_min?: number;
    confidence_max?: number;
  };
  block_rules: {
    last_contact_hours_min?: number;
    max_emails_window_7d?: number;
  };
}

/**
 * Evaluate policy in strict order: BLOCK → APPROVAL → AUTO.
 * If no rule matches auto_send criteria, defaults to require_approval (safer).
 */
export function evaluatePolicy(ctx: PolicyContext, rules: PolicyRules): PolicyDecision {
  // 1. BLOCK
  const block = rules.block_rules || {};
  if (
    block.last_contact_hours_min != null &&
    ctx.hours_since_last_contact != null &&
    ctx.hours_since_last_contact < block.last_contact_hours_min
  ) {
    return {
      mode: 'block',
      reason: `Último contato foi há ${ctx.hours_since_last_contact.toFixed(1)}h (mínimo ${block.last_contact_hours_min}h)`,
    };
  }
  if (
    block.max_emails_window_7d != null &&
    ctx.emails_sent_to_contact_7d >= block.max_emails_window_7d
  ) {
    return {
      mode: 'block',
      reason: `${ctx.emails_sent_to_contact_7d} emails nos últimos 7 dias (máx ${block.max_emails_window_7d})`,
    };
  }

  // 2. APPROVAL
  const approval = rules.require_approval_rules || {};
  if (approval.deal_value_min != null && ctx.deal_value != null && ctx.deal_value >= approval.deal_value_min) {
    return { mode: 'require_approval', reason: `Deal value R$ ${ctx.deal_value.toFixed(0)} ≥ R$ ${approval.deal_value_min}` };
  }
  if (approval.risk_min != null && ctx.risk >= approval.risk_min) {
    return { mode: 'require_approval', reason: `Risco ${(ctx.risk * 100).toFixed(0)}% ≥ ${(approval.risk_min * 100).toFixed(0)}%` };
  }
  if (approval.confidence_max != null && ctx.confidence < approval.confidence_max) {
    return { mode: 'require_approval', reason: `Confiança ${(ctx.confidence * 100).toFixed(0)}% < ${(approval.confidence_max * 100).toFixed(0)}%` };
  }

  // 3. AUTO
  const auto = rules.auto_send_rules || {};
  const meetsConf = auto.confidence_min == null || ctx.confidence >= auto.confidence_min;
  const meetsValue = auto.deal_value_max == null || ctx.deal_value == null || ctx.deal_value <= auto.deal_value_max;
  const meetsRisk = auto.risk_max == null || ctx.risk <= auto.risk_max;

  if (meetsConf && meetsValue && meetsRisk) {
    return { mode: 'auto_send', reason: 'Critérios de auto-envio atendidos' };
  }

  return { mode: 'require_approval', reason: 'Não atende critérios de auto-envio — exige aprovação por padrão' };
}

export interface CooldownPolicy {
  min_hours_between_emails_per_contact: number;
  min_hours_between_emails_per_opportunity: number;
  max_emails_per_contact_7d: number;
  max_emails_per_opportunity_7d: number;
  stop_if_manual_contact_recent_hours: number | null;
  respect_business_hours: boolean;
  allowed_weekdays_json: number[];
  daily_send_window_start: string | null;
  daily_send_window_end: string | null;
  timezone: string;
}

export interface CooldownCheckCtx {
  hours_since_last_email_to_contact: number | null;
  hours_since_last_email_to_opportunity: number | null;
  emails_to_contact_7d: number;
  emails_to_opportunity_7d: number;
  hours_since_last_manual_contact: number | null;
}

export type CooldownResult = { allowed: true } | { allowed: false; reason: string };

export function checkCooldown(cooldown: CooldownPolicy | null, ctx: CooldownCheckCtx): CooldownResult {
  if (!cooldown) return { allowed: true };

  if (
    ctx.hours_since_last_email_to_contact != null &&
    ctx.hours_since_last_email_to_contact < cooldown.min_hours_between_emails_per_contact
  ) {
    return {
      allowed: false,
      reason: `Cooldown contato: último email há ${ctx.hours_since_last_email_to_contact.toFixed(1)}h (mín ${cooldown.min_hours_between_emails_per_contact}h)`,
    };
  }
  if (
    ctx.hours_since_last_email_to_opportunity != null &&
    ctx.hours_since_last_email_to_opportunity < cooldown.min_hours_between_emails_per_opportunity
  ) {
    return {
      allowed: false,
      reason: `Cooldown oportunidade: último email há ${ctx.hours_since_last_email_to_opportunity.toFixed(1)}h (mín ${cooldown.min_hours_between_emails_per_opportunity}h)`,
    };
  }
  if (ctx.emails_to_contact_7d >= cooldown.max_emails_per_contact_7d) {
    return {
      allowed: false,
      reason: `Limite contato 7d atingido (${ctx.emails_to_contact_7d}/${cooldown.max_emails_per_contact_7d})`,
    };
  }
  if (ctx.emails_to_opportunity_7d >= cooldown.max_emails_per_opportunity_7d) {
    return {
      allowed: false,
      reason: `Limite oportunidade 7d atingido (${ctx.emails_to_opportunity_7d}/${cooldown.max_emails_per_opportunity_7d})`,
    };
  }
  if (
    cooldown.stop_if_manual_contact_recent_hours != null &&
    ctx.hours_since_last_manual_contact != null &&
    ctx.hours_since_last_manual_contact < cooldown.stop_if_manual_contact_recent_hours
  ) {
    return {
      allowed: false,
      reason: `Vendedor contatou manualmente há ${ctx.hours_since_last_manual_contact.toFixed(1)}h (mín ${cooldown.stop_if_manual_contact_recent_hours}h)`,
    };
  }

  // Business hours (simplified — uses server time, treats timezone offset)
  if (cooldown.respect_business_hours) {
    const now = new Date();
    // Brazil offset (simplified, no DST handling — UTC-3)
    const brOffset = -3 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + brOffset);
    const dow = local.getUTCDay(); // 0=Sun
    const allowed = (cooldown.allowed_weekdays_json || [1, 2, 3, 4, 5]).includes(dow);
    if (!allowed) return { allowed: false, reason: `Fora de dias úteis (hoje=${dow})` };

    if (cooldown.daily_send_window_start && cooldown.daily_send_window_end) {
      const [sh] = cooldown.daily_send_window_start.split(':').map(Number);
      const [eh] = cooldown.daily_send_window_end.split(':').map(Number);
      const hour = local.getUTCHours();
      if (hour < sh || hour >= eh) {
        return { allowed: false, reason: `Fora do horário comercial (${sh}h-${eh}h, agora ${hour}h BRT)` };
      }
    }
  }

  return { allowed: true };
}

/** Query cooldown context for a (contact, opportunity) pair. */
export async function buildCooldownCtx(
  supabase: any,
  orgId: string,
  contactId: string | null,
  opportunityId: string | null,
): Promise<CooldownCheckCtx> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let hoursContact: number | null = null;
  let hoursOpp: number | null = null;
  let countContact = 0;
  let countOpp = 0;
  let hoursManual: number | null = null;

  if (contactId) {
    const { data } = await supabase
      .from('ai_email_messages')
      .select('sent_at')
      .eq('organization_id', orgId)
      .eq('contact_id', contactId)
      .eq('send_status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(50);
    const sent = (data || []).filter((r: any) => r.sent_at);
    if (sent[0]?.sent_at) {
      hoursContact = (Date.now() - new Date(sent[0].sent_at).getTime()) / 3_600_000;
    }
    countContact = sent.filter((r: any) => r.sent_at >= sevenDaysAgo).length;
  }

  if (opportunityId) {
    const { data } = await supabase
      .from('ai_email_messages')
      .select('sent_at')
      .eq('organization_id', orgId)
      .eq('opportunity_id', opportunityId)
      .eq('send_status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(50);
    const sent = (data || []).filter((r: any) => r.sent_at);
    if (sent[0]?.sent_at) {
      hoursOpp = (Date.now() - new Date(sent[0].sent_at).getTime()) / 3_600_000;
    }
    countOpp = sent.filter((r: any) => r.sent_at >= sevenDaysAgo).length;

    // Manual activities (não automatizadas) na oportunidade
    const { data: acts } = await supabase
      .from('activities')
      .select('completed_at, created_at, is_automated, ai_generated')
      .eq('organization_id', orgId)
      .eq('opportunity_id', opportunityId)
      .or('is_automated.eq.false,is_automated.is.null')
      .or('ai_generated.eq.false,ai_generated.is.null')
      .order('created_at', { ascending: false })
      .limit(5);
    const lastManual = (acts || []).find((a: any) => !a.is_automated && !a.ai_generated);
    const lastTs = lastManual?.completed_at || lastManual?.created_at;
    if (lastTs) hoursManual = (Date.now() - new Date(lastTs).getTime()) / 3_600_000;
  }

  return {
    hours_since_last_email_to_contact: hoursContact,
    hours_since_last_email_to_opportunity: hoursOpp,
    emails_to_contact_7d: countContact,
    emails_to_opportunity_7d: countOpp,
    hours_since_last_manual_contact: hoursManual,
  };
}

/** Build recent_interactions[] for the deliberation context. */
export async function buildRecentInteractions(
  supabase: any,
  orgId: string,
  contactId: string | null,
  opportunityId: string | null,
  lookbackHours: number,
): Promise<Array<Record<string, any>>> {
  const since = new Date(Date.now() - lookbackHours * 3_600_000).toISOString();
  const items: Array<Record<string, any>> = [];

  if (contactId || opportunityId) {
    let q = supabase
      .from('ai_email_messages')
      .select('subject, email_purpose, sent_at, send_status, was_human_edited')
      .eq('organization_id', orgId)
      .gte('sent_at', since)
      .eq('send_status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(10);
    if (contactId) q = q.eq('contact_id', contactId);
    else if (opportunityId) q = q.eq('opportunity_id', opportunityId);
    const { data } = await q;
    for (const e of data || []) {
      items.push({
        kind: 'agent_email',
        at: e.sent_at,
        subject: e.subject,
        purpose: e.email_purpose,
        edited_by_human: e.was_human_edited,
      });
    }
  }

  // Manual emails from opportunity_emails
  if (opportunityId) {
    const { data: manualEmails } = await supabase
      .from('opportunity_emails')
      .select('subject, direction, sent_at, from_email')
      .eq('opportunity_id', opportunityId)
      .order('sent_at', { ascending: false })
      .limit(5);
    for (const me of manualEmails || []) {
      items.push({
        kind: 'manual_email',
        at: me.sent_at,
        subject: me.subject,
        direction: me.direction,
        from: me.from_email,
      });
    }
  }

  if (opportunityId) {
    const { data } = await supabase
      .from('activities')
      .select('type, title, completed_at, created_at, status, scheduled_date')
      .eq('organization_id', orgId)
      .eq('opportunity_id', opportunityId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const a of data || []) {
      items.push({
        kind: `activity_${a.type}`,
        at: a.completed_at || a.created_at,
        title: a.title,
        status: a.status,
        scheduled_date: a.scheduled_date,
      });
    }
  }

  // Sort by time desc
  items.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return items.slice(0, 20);
}

/** Fetch recent feedback (rejections/edits) for this agent+org to inject into deliberation. */
export async function buildFeedbackContext(
  supabase: any,
  orgId: string,
  agentId: string,
  limit = 10,
): Promise<Array<Record<string, any>>> {
  const { data } = await supabase
    .from('ai_agent_feedback')
    .select('feedback_type, feedback_text, original_output_json, edited_output_json, created_at')
    .eq('organization_id', orgId)
    .eq('agent_id', agentId)
    .in('feedback_type', ['rejection', 'edit'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).map((f: any) => ({
    type: f.feedback_type,
    reason: f.feedback_text,
    original_subject: f.original_output_json?.subject,
    edited_subject: f.edited_output_json?.subject,
    at: f.created_at,
  }));
}
