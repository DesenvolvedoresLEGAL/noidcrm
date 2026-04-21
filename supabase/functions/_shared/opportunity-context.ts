// Single source of truth for the "Opportunity Brief" used by AI agents.
// Returns a tightly-scoped, deterministic JSON snapshot of EVERYTHING that
// matters about a given opportunity, so prompts can stop guessing and the
// anti-hallucination validator has a precise allowlist of entities.

export interface OpportunityBrief {
  signature: string; // hash-like fingerprint for log/replay
  opportunity: {
    id: string;
    title: string | null;
    status: string | null;
    pipeline_id: string | null;
    pipeline_name: string | null;
    pipeline_type: string | null;
    stage_id: string | null;
    stage_name: string | null;
    valor_previsto: number | null;
    close_date_prevista: string | null;
    prob: number | null;
    urgency_score: number | null;
    temperatura: string | null;
    produto: string | null;
    origem: string | null;
    fonte: string | null;
    next_followup_date: string | null;
    last_contact_date: string | null;
    days_since_contact: number | null;
    opportunity_score: number | null;
    win_probability_ai: number | null;
    engagement_score: number | null;
    velocity_score: number | null;
    risk_score: number | null;
    vibe_state: string | null;
    energy_score: number | null;
    timing_score: number | null;
    nrhs_score: number | null;
    nrhs_tier: string | null;
    nrhs_blockers: any;
    diagnostic_classification: string | null;
    owner_user_id: string | null;
    created_at: string | null;
  };
  account: {
    id: string | null;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnpj: string | null;
    segmento: string | null;
    porte: string | null;
    cidade: string | null;
    uf: string | null;
    website: string | null;
    lifecycle_stage: string | null;
    lead_score: number | null;
    fit_score: number | null;
    intent_score: number | null;
    score_financeiro: number | null;
    risco_financeiro: string | null;
    observacoes: string | null;
  };
  primary_contact: {
    id: string | null;
    nome: string | null;
    primeiro_nome: string | null;
    ultimo_nome: string | null;
    cargo: string | null;
    departamento: string | null;
    email: string | null;
    telefone: string | null;
  };
  other_contacts: Array<{
    id: string;
    nome: string | null;
    cargo: string | null;
    email: string | null;
  }>;
  custom_fields: Record<string, any>;
  proposals: Array<{
    id: string;
    title: string | null;
    status: string | null;
    net_value: number | null;
    sent_at: string | null;
    viewed_at: string | null;
    accepted_at: string | null;
    declined_at: string | null;
    expires_at: string | null;
    items_summary: string[];
  }>;
  recent_activities: Array<{
    id: string;
    type: string;
    title: string | null;
    description: string | null;
    status: string | null;
    scheduled_date: string | null;
    completed_at: string | null;
    ai_generated: boolean | null;
    is_automated: boolean | null;
  }>;
  manual_emails: Array<{
    subject: string | null;
    body_excerpt: string | null;
    direction: string | null;
    sent_at: string | null;
    from_email: string | null;
  }>;
  scoring_factors: any;

  // ===== 360º expanded blocks =====
  proposal_analytics: Array<{
    proposal_id: string;
    proposal_title: string | null;
    view_count: number;
    last_viewed_at: string | null;
    total_seconds: number;
    max_scroll_pct: number | null;
    dominant_device: string | null;
    cities: string[];
    sections_viewed: string[];
  }>;
  account_context: {
    other_opportunities: Array<{
      id: string;
      title: string | null;
      status: string | null;
      stage_name: string | null;
      pipeline_type: string | null;
      valor_previsto: number | null;
      closed_at: string | null;
    }>;
    contracts: Array<{
      id: string;
      title: string | null;
      status: string | null;
      contract_type: string | null;
      contract_value: number | null;
      monthly_value: number | null;
      one_time_value: number | null;
      start_date: string | null;
      end_date: string | null;
    }>;
    account_notes: Array<{ content: string; created_at: string | null }>;
    revenue_history: {
      total_won_value: number;
      won_count: number;
      lost_count: number;
      open_count: number;
      active_mrr: number;
      total_one_time: number;
    };
  };
  nrhs_detail: {
    score: number | null;
    tier: string | null;
    blockers: any;
    recent_events: Array<{ event_type: string; payload: any; created_at: string | null }>;
  };
  vibe: {
    last_emotional_state: string | null;
    risk_of_vibe_break: string | null;
    vibe_break_reason: string | null;
    ideal_tone: string | null;
    response_rhythm: string | null;
    preferred_channel: string | null;
    best_contact_time: string | null;
    dominant_objection_type: string | null;
    last_interaction_summary: string | null;
    recent_alerts: Array<{
      alert_type: string;
      title: string | null;
      message: string | null;
      recommendation: string | null;
      priority: string | null;
      created_at: string | null;
    }>;
  };
  timeline_highlights: Array<{
    type: string;
    activity_type: string | null;
    title: string | null;
    timestamp: string | null;
  }>;

  // The exact, lower-cased token allowlist used by the anti-hallucination
  // validator. Anything in body/subject that "looks like" a proper noun and
  // is NOT in this set will be flagged as suspicious.
  allowlist_tokens: string[];

  // Numeric tokens (visualizations, MRR, days, etc.) extracted from the brief.
  // Used by the "unverifiable_metric" detector to ensure that any number the
  // model writes has an origin in the brief.
  numeric_allowlist: string[];
}

const PORTUGUESE_STOPWORDS = new Set([
  "a","o","as","os","um","uma","uns","umas","de","do","da","dos","das","em","no","na","nos","nas",
  "para","por","pelo","pela","pelos","pelas","com","sem","sob","sobre","entre","ao","aos","à","às",
  "que","se","sua","seu","suas","seus","ele","ela","eles","elas","este","esta","isto","esse","essa","isso",
  "aquele","aquela","aquilo","mas","ou","e","como","quando","onde","porque","muito","mais","menos","já",
  "também","tambem","então","entao","só","so","ainda","sempre","nunca","tudo","todo","toda","todos","todas",
  "ser","estar","ter","fazer","ir","vir","ver","saber","poder","dever","oi","olá","ola","obrigado","obrigada",
  "bom","boa","dia","tarde","noite","prezado","prezada","caro","cara","abraço","abraco","atenciosamente",
  "att","equipe","time","empresa","cliente","proposta","contrato","reunião","reuniao","email","follow",
  "up","crm","whatsapp","sim","não","nao","talvez","data","hora","segunda","terça","terca","quarta",
  "quinta","sexta","sábado","sabado","domingo","janeiro","fevereiro","março","marco","abril","maio",
  "junho","julho","agosto","setembro","outubro","novembro","dezembro"
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  // Split into words, keep accented Portuguese chars
  return text
    .split(/[^A-Za-zÀ-ÿ0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function distinctCaseInsensitive(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const k = v.toLowerCase();
    if (!seen.has(k)) seen.add(k);
  }
  return Array.from(seen);
}

// Normalize a number to canonical forms used in body text. We index multiple
// representations (raw integer, "R$ X", "X%", "X,YY", "X.YY") so the detector
// matches whichever style the LLM produces.
function numericVariants(n: number | string | null | undefined): string[] {
  if (n === null || n === undefined || n === "") return [];
  const num = typeof n === "string" ? Number(String(n).replace(",", ".")) : n;
  if (!Number.isFinite(num)) return [];
  const out = new Set<string>();
  out.add(String(num));
  out.add(String(Math.round(num)));
  // Common BR formatting
  out.add(num.toFixed(0));
  out.add(num.toFixed(2));
  out.add(num.toFixed(2).replace(".", ","));
  // Thousand separator (BR)
  if (Math.abs(num) >= 1000) {
    const intPart = Math.round(num).toString();
    const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    out.add(withDots);
  }
  return Array.from(out);
}

export async function buildOpportunityBrief(
  supabase: any,
  opportunityId: string,
): Promise<OpportunityBrief | null> {
  // 1. Opportunity + account + primary contact (best-effort joins)
  const { data: opp } = await supabase
    .from("opportunities")
    .select(`
      *,
      accounts(*),
      contacts(*)
    `)
    .eq("id", opportunityId)
    .single();

  if (!opp) return null;

  // 2. Pipeline + stage names
  let pipelineName: string | null = null;
  let pipelineType: string | null = null;
  let stageName: string | null = null;
  if (opp.pipeline_id) {
    const { data: pipe } = await supabase
      .from("pipelines")
      .select("name, pipeline_type")
      .eq("id", opp.pipeline_id)
      .maybeSingle();
    pipelineName = pipe?.name || null;
    pipelineType = pipe?.pipeline_type || null;
  }
  if (opp.stage_id) {
    const { data: st } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("id", opp.stage_id)
      .maybeSingle();
    stageName = st?.name || null;
  }

  // 3. Other contacts on this opportunity (via deal_participants)
  const { data: participants } = await supabase
    .from("deal_participants")
    .select("user_id, role, contact:contacts(id, nome, cargo, emails)")
    .eq("opportunity_id", opportunityId)
    .limit(10);
  const otherContacts = (participants || [])
    .map((p: any) => p.contact)
    .filter((c: any) => c && c.id && c.id !== opp.contacts?.id)
    .slice(0, 5)
    .map((c: any) => ({
      id: c.id,
      nome: c.nome,
      cargo: c.cargo,
      email: Array.isArray(c.emails) ? c.emails[0] : (c.emails?.principal || null),
    }));

  // 4. Custom fields for this opportunity
  const { data: cfValues } = await supabase
    .from("custom_field_values")
    .select("custom_field_id, value, custom_fields:custom_fields(field_key, label)")
    .eq("entity_type", "opportunity")
    .eq("entity_id", opportunityId);
  const customFields: Record<string, any> = {};
  for (const row of cfValues || []) {
    const key = row.custom_fields?.field_key || row.custom_fields?.label;
    if (key) customFields[key] = row.value;
  }

  // 5. Proposals + items
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, status, total_amount, discount_amount, sent_at, viewed_at, accepted_at, declined_at, expires_at, created_at")
    .eq("opportunity_id", opportunityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const proposalIds = (proposals || []).map((p: any) => p.id);
  const proposalItemsByProp: Record<string, string[]> = {};
  if (proposalIds.length > 0) {
    const { data: items } = await supabase
      .from("proposal_items")
      .select("proposal_id, name, quantity, total")
      .in("proposal_id", proposalIds)
      .order("order_index", { ascending: true });
    for (const it of items || []) {
      const k = it.proposal_id;
      if (!proposalItemsByProp[k]) proposalItemsByProp[k] = [];
      proposalItemsByProp[k].push(`${it.name} (qtd ${it.quantity}, R$ ${Number(it.total || 0).toFixed(2)})`);
    }
  }

  const proposalsOut = (proposals || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    net_value: p.total_amount != null ? Number(p.total_amount) - Number(p.discount_amount || 0) : null,
    sent_at: p.sent_at,
    viewed_at: p.viewed_at,
    accepted_at: p.accepted_at,
    declined_at: p.declined_at,
    expires_at: p.expires_at,
    items_summary: (proposalItemsByProp[p.id] || []).slice(0, 8),
  }));

  // ===== 360º data fetched in parallel (best-effort) =====
  const accountId = opp.accounts?.id || opp.account_id || null;

  const [
    activitiesRes,
    manualEmailsRes,
    proposalViewsRes,
    otherOppsRes,
    contractsRes,
    accountNotesRes,
    nrhsEventsRes,
    leadEmotionRes,
    vibeAlertsRes,
    timelineRes,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, title, description, status, scheduled_date, completed_at, ai_generated, is_automated")
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("opportunity_emails")
      .select("subject, body, body_text, body_html, direction, sent_at, from_email")
      .eq("opportunity_id", opportunityId)
      .order("sent_at", { ascending: false })
      .limit(5),
    proposalIds.length > 0
      ? supabase
          .from("proposal_views")
          .select("proposal_id, viewed_at, duration_seconds, scroll_depth_percent, sections_viewed, device_type, city")
          .in("proposal_id", proposalIds)
          .order("viewed_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),
    accountId
      ? supabase
          .from("opportunities")
          .select("id, title, status, valor_previsto, closed_at, pipeline_id, stage_id")
          .eq("account_id", accountId)
          .neq("id", opportunityId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
    accountId
      ? supabase
          .from("contracts")
          .select("id, title, status, contract_type, contract_value, monthly_value, one_time_value, start_date, end_date")
          .eq("account_id", accountId)
          .is("deleted_at", null)
          .order("start_date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase
      .from("opportunity_notes")
      .select("content, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("nrhs_events")
      .select("event_type, payload, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("lead_emotional_memory")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vibe_alerts")
      .select("alert_type, title, message, recommendation, priority, created_at")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("unified_timeline")
      .select("type, activity_type, title, timestamp")
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)
      .order("timestamp", { ascending: false })
      .limit(15),
  ]);

  const activities = activitiesRes?.data || [];
  const manualEmails = manualEmailsRes?.data || [];

  const manualEmailsOut = manualEmails.map((m: any) => {
    const raw = m.body_text || (m.body_html ? String(m.body_html).replace(/<[^>]+>/g, " ") : m.body || "");
    const excerpt = raw ? String(raw).replace(/\s+/g, " ").trim().slice(0, 400) : null;
    return {
      subject: m.subject,
      body_excerpt: excerpt,
      direction: m.direction,
      sent_at: m.sent_at,
      from_email: m.from_email,
    };
  });

  // -- proposal_analytics aggregation --
  const viewsByProposal: Record<string, any[]> = {};
  for (const v of (proposalViewsRes?.data || [])) {
    if (!viewsByProposal[v.proposal_id]) viewsByProposal[v.proposal_id] = [];
    viewsByProposal[v.proposal_id].push(v);
  }
  const proposal_analytics = proposalsOut.map((p) => {
    const views = viewsByProposal[p.id] || [];
    const deviceTally: Record<string, number> = {};
    const cities = new Set<string>();
    const sections = new Set<string>();
    let totalSeconds = 0;
    let maxScroll: number | null = null;
    let lastViewedAt: string | null = null;
    for (const v of views) {
      if (v.device_type) deviceTally[v.device_type] = (deviceTally[v.device_type] || 0) + 1;
      if (v.city) cities.add(v.city);
      if (Array.isArray(v.sections_viewed)) for (const s of v.sections_viewed) if (s) sections.add(String(s));
      totalSeconds += Number(v.duration_seconds || 0);
      if (v.scroll_depth_percent != null) {
        maxScroll = Math.max(maxScroll ?? 0, Number(v.scroll_depth_percent));
      }
      if (v.viewed_at && (!lastViewedAt || v.viewed_at > lastViewedAt)) lastViewedAt = v.viewed_at;
    }
    const dominantDevice = Object.keys(deviceTally).sort((a, b) => deviceTally[b] - deviceTally[a])[0] || null;
    return {
      proposal_id: p.id,
      proposal_title: p.title,
      view_count: views.length,
      last_viewed_at: lastViewedAt,
      total_seconds: Math.round(totalSeconds),
      max_scroll_pct: maxScroll,
      dominant_device: dominantDevice,
      cities: Array.from(cities).slice(0, 3),
      sections_viewed: Array.from(sections).slice(0, 8),
    };
  });

  // -- account_context --
  const otherOpps = (otherOppsRes?.data || []).map((o: any) => ({
    id: o.id,
    title: o.title,
    status: o.status,
    stage_name: null, // filled below if we want; kept null to avoid extra query storm
    pipeline_type: null,
    valor_previsto: o.valor_previsto != null ? Number(o.valor_previsto) : null,
    closed_at: o.closed_at,
  }));
  const contracts = (contractsRes?.data || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    contract_type: c.contract_type,
    contract_value: c.contract_value != null ? Number(c.contract_value) : null,
    monthly_value: c.monthly_value != null ? Number(c.monthly_value) : null,
    one_time_value: c.one_time_value != null ? Number(c.one_time_value) : null,
    start_date: c.start_date,
    end_date: c.end_date,
  }));
  const accountNotes = (accountNotesRes?.data || [])
    .map((n: any) => ({ content: String(n.content || "").slice(0, 280), created_at: n.created_at }))
    .filter((n: any) => n.content);

  // Revenue history aggregates
  let totalWonValue = 0;
  let wonCount = 0;
  let lostCount = 0;
  let openCount = 0;
  for (const o of otherOpps) {
    if (o.status === "won") {
      wonCount += 1;
      totalWonValue += o.valor_previsto || 0;
    } else if (o.status === "lost") {
      lostCount += 1;
    } else {
      openCount += 1;
    }
  }
  let activeMrr = 0;
  let totalOneTime = 0;
  for (const c of contracts) {
    if (c.status === "active") {
      activeMrr += c.monthly_value || 0;
      totalOneTime += c.one_time_value || 0;
    }
  }

  // -- nrhs_detail --
  const nrhs_detail = {
    score: opp.nrhs_score != null ? Number(opp.nrhs_score) : null,
    tier: opp.nrhs_tier || null,
    blockers: opp.nrhs_blockers || null,
    recent_events: (nrhsEventsRes?.data || []).map((e: any) => ({
      event_type: e.event_type,
      payload: e.payload,
      created_at: e.created_at,
    })),
  };

  // -- vibe --
  const lem = leadEmotionRes?.data || null;
  const vibe = {
    last_emotional_state: lem?.last_emotional_state || opp.vibe_state || null,
    risk_of_vibe_break: lem?.risk_of_vibe_break || null,
    vibe_break_reason: lem?.vibe_break_reason || null,
    ideal_tone: lem?.ideal_tone || null,
    response_rhythm: lem?.response_rhythm || null,
    preferred_channel: lem?.preferred_channel || null,
    best_contact_time: lem?.best_contact_time || null,
    dominant_objection_type: lem?.dominant_objection_type || null,
    last_interaction_summary: lem?.last_interaction_summary || null,
    recent_alerts: (vibeAlertsRes?.data || []).map((a: any) => ({
      alert_type: a.alert_type,
      title: a.title,
      message: a.message,
      recommendation: a.recommendation,
      priority: a.priority,
      created_at: a.created_at,
    })),
  };

  // -- timeline_highlights --
  const timeline_highlights = (timelineRes?.data || []).map((t: any) => ({
    type: t.type,
    activity_type: t.activity_type,
    title: t.title,
    timestamp: t.timestamp,
  }));

  // Resolve primary contact email (jsonb -> first entry)
  const primaryEmails = opp.contacts?.emails;
  const primaryEmail = Array.isArray(primaryEmails)
    ? (primaryEmails[0]?.email || primaryEmails[0])
    : primaryEmails?.principal || primaryEmails?.[0] || null;
  const primaryPhones = opp.contacts?.telefones;
  const primaryPhone = Array.isArray(primaryPhones)
    ? (primaryPhones[0]?.numero || primaryPhones[0])
    : primaryPhones?.principal || null;

  // ---- Build allowlist for hallucination validator ----
  // We accept: account names, contact names, opportunity title, pipeline/stage,
  // produto, custom-field string values, segmento, cidade, observações tokens,
  // proposal item names, names of OTHER OPPORTUNITIES OF THE SAME ACCOUNT,
  // contract titles, account notes content, vibe/nrhs descriptive text, and
  // proposal-engagement city names. We deliberately do NOT add other accounts.
  const allowlistRaw: string[] = [];
  const account = opp.accounts || {};
  allowlistRaw.push(account.razao_social, account.nome_fantasia, account.segmento, account.cidade, account.uf);
  const contact = opp.contacts || {};
  allowlistRaw.push(contact.nome, contact.primeiro_nome, contact.ultimo_nome, contact.cargo);
  for (const oc of otherContacts) allowlistRaw.push(oc.nome, oc.cargo);
  allowlistRaw.push(opp.title, opp.produto, opp.origem, opp.fonte, pipelineName, stageName);
  for (const v of Object.values(customFields)) {
    if (typeof v === "string") allowlistRaw.push(v);
    else if (v && typeof v === "object" && typeof (v as any).label === "string") allowlistRaw.push((v as any).label);
  }
  for (const p of proposalsOut) {
    if (p.title) allowlistRaw.push(p.title);
    for (const s of p.items_summary) allowlistRaw.push(s);
  }
  for (const m of manualEmailsOut) {
    if (m.subject) allowlistRaw.push(m.subject);
    if (m.body_excerpt) allowlistRaw.push(m.body_excerpt);
  }
  if (account.observacoes) allowlistRaw.push(account.observacoes);
  if (primaryEmail) allowlistRaw.push(String(primaryEmail).split("@")[1] || ""); // domain ok
  for (const o of otherOpps) {
    if (o.title) allowlistRaw.push(o.title);
    if (o.status) allowlistRaw.push(o.status);
  }
  for (const c of contracts) {
    if (c.title) allowlistRaw.push(c.title);
    if (c.contract_type) allowlistRaw.push(c.contract_type);
  }
  for (const n of accountNotes) allowlistRaw.push(n.content);
  for (const a of vibe.recent_alerts) {
    allowlistRaw.push(a.title || "", a.message || "", a.recommendation || "");
  }
  for (const pa of proposal_analytics) {
    for (const c of pa.cities) allowlistRaw.push(c);
    for (const s of pa.sections_viewed) allowlistRaw.push(s);
    if (pa.dominant_device) allowlistRaw.push(pa.dominant_device);
  }
  for (const t of timeline_highlights) {
    if (t.title) allowlistRaw.push(t.title);
  }
  if (vibe.last_interaction_summary) allowlistRaw.push(vibe.last_interaction_summary);

  // Tokenize everything, lower-case, dedupe.
  const allTokens: string[] = [];
  for (const v of allowlistRaw) {
    if (!v) continue;
    for (const tk of tokenize(String(v))) {
      const lo = tk.toLowerCase();
      if (lo.length < 2) continue;
      allTokens.push(lo);
    }
  }
  const allowlist_tokens = distinctCaseInsensitive(allTokens);

  // ---- Build numeric_allowlist for unverifiable_metric detector ----
  const numericRaw: string[] = [];
  const pushN = (n: any) => { for (const s of numericVariants(n)) numericRaw.push(s); };
  pushN(opp.valor_previsto); pushN(opp.opportunity_score); pushN(opp.win_probability_ai);
  pushN(opp.engagement_score); pushN(opp.velocity_score); pushN(opp.risk_score);
  pushN(opp.energy_score); pushN(opp.timing_score); pushN(opp.nrhs_score);
  pushN(opp.urgency_score); pushN(opp.prob); pushN(opp.days_since_contact);
  pushN(account.lead_score); pushN(account.fit_score); pushN(account.intent_score);
  pushN(account.score_financeiro);
  for (const p of proposalsOut) { pushN(p.net_value); }
  for (const c of contracts) {
    pushN(c.contract_value); pushN(c.monthly_value); pushN(c.one_time_value);
  }
  pushN(activeMrr); pushN(totalOneTime); pushN(totalWonValue);
  pushN(wonCount); pushN(lostCount); pushN(openCount);
  for (const pa of proposal_analytics) {
    pushN(pa.view_count);
    pushN(pa.total_seconds);
    if (pa.max_scroll_pct != null) pushN(pa.max_scroll_pct);
  }
  // Include all dates as YYYY-MM-DD strings — they're already in the brief
  // and we don't validate dates; the proper-noun validator handles those.
  const numeric_allowlist = Array.from(new Set(numericRaw));

  // Signature — cheap deterministic hash of the key identity fields.
  const sigSource = [
    opp.id,
    opp.title || "",
    account.id || "",
    account.razao_social || account.nome_fantasia || "",
    contact.id || "",
    contact.nome || "",
    stageName || "",
    String(proposalIds.length),
    String(otherOpps.length),
    String(contracts.length),
    String(timeline_highlights.length),
  ].join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < sigSource.length; i++) {
    h ^= sigSource.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const signature = `brf_${h.toString(16)}_${(opp.id as string).slice(0, 8)}`;

  return {
    signature,
    opportunity: {
      id: opp.id,
      title: opp.title || null,
      status: opp.status || null,
      pipeline_id: opp.pipeline_id || null,
      pipeline_name: pipelineName,
      pipeline_type: pipelineType,
      stage_id: opp.stage_id || null,
      stage_name: stageName,
      valor_previsto: opp.valor_previsto != null ? Number(opp.valor_previsto) : null,
      close_date_prevista: opp.close_date_prevista || null,
      prob: opp.prob != null ? Number(opp.prob) : null,
      urgency_score: opp.urgency_score != null ? Number(opp.urgency_score) : null,
      temperatura: opp.temperatura || opp.temperature || null,
      produto: opp.produto || null,
      origem: opp.origem || null,
      fonte: opp.fonte || null,
      next_followup_date: opp.next_followup_date || null,
      last_contact_date: opp.last_contact_date || null,
      days_since_contact: opp.days_since_contact != null ? Number(opp.days_since_contact) : null,
      opportunity_score: opp.opportunity_score != null ? Number(opp.opportunity_score) : null,
      win_probability_ai: opp.win_probability_ai != null ? Number(opp.win_probability_ai) : null,
      engagement_score: opp.engagement_score != null ? Number(opp.engagement_score) : null,
      velocity_score: opp.velocity_score != null ? Number(opp.velocity_score) : null,
      risk_score: opp.risk_score != null ? Number(opp.risk_score) : null,
      vibe_state: opp.vibe_state || null,
      energy_score: opp.energy_score != null ? Number(opp.energy_score) : null,
      timing_score: opp.timing_score != null ? Number(opp.timing_score) : null,
      nrhs_score: opp.nrhs_score != null ? Number(opp.nrhs_score) : null,
      nrhs_tier: opp.nrhs_tier || null,
      nrhs_blockers: opp.nrhs_blockers || null,
      diagnostic_classification: opp.diagnostic_classification || null,
      owner_user_id: opp.owner_user_id || null,
      created_at: opp.created_at || null,
    },
    account: {
      id: account.id || null,
      razao_social: account.razao_social || null,
      nome_fantasia: account.nome_fantasia || null,
      cnpj: account.cnpj || null,
      segmento: account.segmento || null,
      porte: account.porte || null,
      cidade: account.cidade || null,
      uf: account.uf || null,
      website: account.website || null,
      lifecycle_stage: account.lifecycle_stage || null,
      lead_score: account.lead_score != null ? Number(account.lead_score) : null,
      fit_score: account.fit_score != null ? Number(account.fit_score) : null,
      intent_score: account.intent_score != null ? Number(account.intent_score) : null,
      score_financeiro: account.score_financeiro != null ? Number(account.score_financeiro) : null,
      risco_financeiro: account.risco_financeiro || null,
      observacoes: account.observacoes || null,
    },
    primary_contact: {
      id: contact.id || null,
      nome: contact.nome || null,
      primeiro_nome: contact.primeiro_nome || null,
      ultimo_nome: contact.ultimo_nome || null,
      cargo: contact.cargo || null,
      departamento: contact.departamento || null,
      email: primaryEmail || null,
      telefone: primaryPhone || null,
    },
    other_contacts: otherContacts,
    custom_fields: customFields,
    proposals: proposalsOut,
    recent_activities: (activities || []).map((a: any) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      status: a.status,
      scheduled_date: a.scheduled_date,
      completed_at: a.completed_at,
      ai_generated: a.ai_generated,
      is_automated: a.is_automated,
    })),
    manual_emails: manualEmailsOut,
    scoring_factors: opp.scoring_factors || null,
    proposal_analytics,
    account_context: {
      other_opportunities: otherOpps,
      contracts,
      account_notes: accountNotes,
      revenue_history: {
        total_won_value: Math.round(totalWonValue * 100) / 100,
        won_count: wonCount,
        lost_count: lostCount,
        open_count: openCount,
        active_mrr: Math.round(activeMrr * 100) / 100,
        total_one_time: Math.round(totalOneTime * 100) / 100,
      },
    },
    nrhs_detail,
    vibe,
    timeline_highlights,
    allowlist_tokens,
    numeric_allowlist,
  };
}

// ---------- Anti-hallucination validator ----------

export interface HallucinationCheckResult {
  ok: boolean;
  suspicious_terms: string[];
  unverifiable_metrics: string[];
  /**
   * A short reason explaining what to surface to humans.
   * Empty when ok=true.
   */
  reason: string;
  flag: "ok" | "possible_hallucination" | "unverifiable_metric" | "possible_hallucination_and_metric";
}

/**
 * Looks at the generated subject + body, extracts capitalized "name-like"
 * tokens (proper nouns), and flags any that are NOT present in the brief's
 * allowlist. Stopwords + dates/days/months are ignored.
 *
 * Also extracts NUMERIC tokens (possible visualizations, MRR, $, %, days)
 * and flags numbers that have no provenance in the brief's numeric_allowlist.
 */
export function detectHallucinations(
  generated: { subject?: string | null; body_text?: string | null; body_html?: string | null },
  brief: OpportunityBrief,
): HallucinationCheckResult {
  const allowSet = new Set(brief.allowlist_tokens);
  const numAllowSet = new Set(brief.numeric_allowlist || []);
  const text = [
    generated.subject || "",
    generated.body_text || "",
    (generated.body_html || "").replace(/<[^>]+>/g, " "),
  ].join(" ");

  // Capture tokens that look like proper nouns: starts with uppercase letter
  // (or fully uppercase) AND has length >= 3. We accept accented chars.
  const candidates = new Set<string>();
  const re = /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ]{2,}|[A-Z]{3,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const lo = raw.toLowerCase();
    if (PORTUGUESE_STOPWORDS.has(lo)) continue;
    candidates.add(raw);
  }

  const suspicious: string[] = [];
  for (const cand of candidates) {
    const lo = cand.toLowerCase();
    if (allowSet.has(lo)) continue;
    let matched = false;
    for (const allowed of allowSet) {
      if (allowed.length >= 4 && (allowed.includes(lo) || lo.includes(allowed))) {
        matched = true;
        break;
      }
    }
    if (!matched) suspicious.push(cand);
  }

  // ---- Numeric verification ----
  // Extract numbers >= 10 (skip trivial "1", "2 dias" etc.) and percentages,
  // currency amounts, and standalone integers/decimals. A number is unverifiable
  // when none of its canonical variants is present in the numeric_allowlist.
  const unverifiableMetrics: string[] = [];
  const numRe = /(?:R\$\s*)?(\d{1,3}(?:[.\,]\d{3})*(?:[.\,]\d+)?|\d+(?:[.\,]\d+)?)\s*(%|x|vezes|aberturas|visualizações|visualizacoes|dias|horas|meses|minutos)?/gi;
  const seenNum = new Set<string>();
  while ((m = numRe.exec(text)) !== null) {
    const numStr = m[1];
    const unit = (m[2] || "").toLowerCase();
    const cleaned = numStr.replace(/\./g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) continue;
    // Skip very small numbers without a metric unit (likely list counters or "1 reunião")
    if (Math.abs(num) < 10 && !unit) continue;
    // Skip 4-digit numbers that look like years (2020-2099)
    if (num >= 2020 && num <= 2099 && !unit) continue;
    const key = `${num}|${unit}`;
    if (seenNum.has(key)) continue;
    seenNum.add(key);

    // Build candidate variants and check overlap with numeric_allowlist
    const variants = numericVariants(num);
    let found = variants.some((v) => numAllowSet.has(v));
    if (!found) {
      const display = unit ? `${numStr} ${unit}` : numStr;
      unverifiableMetrics.push(display);
    }
  }

  if (suspicious.length === 0 && unverifiableMetrics.length === 0) {
    return { ok: true, suspicious_terms: [], unverifiable_metrics: [], reason: "", flag: "ok" };
  }

  let flag: HallucinationCheckResult["flag"] = "ok";
  if (suspicious.length > 0 && unverifiableMetrics.length > 0) flag = "possible_hallucination_and_metric";
  else if (suspicious.length > 0) flag = "possible_hallucination";
  else flag = "unverifiable_metric";

  const parts: string[] = [];
  if (suspicious.length > 0) {
    parts.push(`Termos não encontrados na oportunidade: ${Array.from(new Set(suspicious)).slice(0, 10).join(", ")}`);
  }
  if (unverifiableMetrics.length > 0) {
    parts.push(`Métricas sem origem no brief: ${Array.from(new Set(unverifiableMetrics)).slice(0, 8).join(", ")}`);
  }

  return {
    ok: false,
    suspicious_terms: Array.from(new Set(suspicious)).slice(0, 20),
    unverifiable_metrics: Array.from(new Set(unverifiableMetrics)).slice(0, 20),
    reason: parts.join(" | "),
    flag,
  };
}

/**
 * Compact, prompt-friendly textual rendering of the brief.
 * Always include this VERBATIM in the LLM prompt as the only source of truth.
 */
export function renderBriefForPrompt(brief: OpportunityBrief, todayStr: string): string {
  const o = brief.opportunity;
  const a = brief.account;
  const c = brief.primary_contact;
  const lines: string[] = [];
  lines.push(`<opportunity_brief signature="${brief.signature}" today="${todayStr}">`);
  lines.push(`OPPORTUNITY:`);
  lines.push(`  id: ${o.id}`);
  lines.push(`  title: ${o.title ?? "—"}`);
  lines.push(`  status: ${o.status ?? "—"}`);
  lines.push(`  pipeline: ${o.pipeline_name ?? "—"} (${o.pipeline_type ?? "—"})`);
  lines.push(`  stage: ${o.stage_name ?? "—"}`);
  lines.push(`  valor_previsto: ${o.valor_previsto ?? "—"}`);
  lines.push(`  close_date_prevista: ${o.close_date_prevista ?? "—"}`);
  lines.push(`  prob: ${o.prob ?? "—"}  urgency: ${o.urgency_score ?? "—"}  temperatura: ${o.temperatura ?? "—"}`);
  lines.push(`  produto: ${o.produto ?? "—"}  origem: ${o.origem ?? "—"}  fonte: ${o.fonte ?? "—"}`);
  lines.push(`  scores: opp=${o.opportunity_score ?? "—"} engagement=${o.engagement_score ?? "—"} velocity=${o.velocity_score ?? "—"} risk=${o.risk_score ?? "—"}  win_prob_ai=${o.win_probability_ai ?? "—"}`);
  lines.push(`  vibe: ${o.vibe_state ?? "—"} (energy=${o.energy_score ?? "—"} timing=${o.timing_score ?? "—"})  nrhs=${o.nrhs_score ?? "—"} (${o.nrhs_tier ?? "—"})`);
  lines.push(`  next_followup: ${o.next_followup_date ?? "—"}  last_contact: ${o.last_contact_date ?? "—"}  days_since_contact: ${o.days_since_contact ?? "—"}`);

  lines.push(`ACCOUNT:`);
  lines.push(`  razao_social: ${a.razao_social ?? "—"}`);
  lines.push(`  nome_fantasia: ${a.nome_fantasia ?? "—"}`);
  lines.push(`  segmento: ${a.segmento ?? "—"}  porte: ${a.porte ?? "—"}  cidade/uf: ${a.cidade ?? "—"}/${a.uf ?? "—"}`);
  lines.push(`  lifecycle: ${a.lifecycle_stage ?? "—"}  lead_score: ${a.lead_score ?? "—"}  fit: ${a.fit_score ?? "—"}  intent: ${a.intent_score ?? "—"}`);
  lines.push(`  observacoes: ${a.observacoes ?? "—"}`);

  lines.push(`PRIMARY_CONTACT:`);
  const _contactName = c.nome ?? (`${c.primeiro_nome ?? ""} ${c.ultimo_nome ?? ""}`.trim() || "—");
  lines.push(`  nome: ${_contactName}`);
  lines.push(`  cargo: ${c.cargo ?? "—"}  departamento: ${c.departamento ?? "—"}`);
  lines.push(`  email: ${c.email ?? "—"}  telefone: ${c.telefone ?? "—"}`);

  if (brief.other_contacts.length > 0) {
    lines.push(`OTHER_CONTACTS:`);
    for (const oc of brief.other_contacts) lines.push(`  - ${oc.nome ?? "—"} (${oc.cargo ?? "—"}) ${oc.email ?? ""}`);
  }

  if (Object.keys(brief.custom_fields).length > 0) {
    lines.push(`CUSTOM_FIELDS:`);
    for (const [k, v] of Object.entries(brief.custom_fields)) {
      lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    }
  }

  if (brief.proposals.length > 0) {
    lines.push(`PROPOSALS:`);
    for (const p of brief.proposals) {
      lines.push(`  - "${p.title ?? "(sem título)"}" status=${p.status ?? "—"} valor_liquido=${p.net_value ?? "—"} sent=${p.sent_at ?? "—"} viewed=${p.viewed_at ?? "—"} expires=${p.expires_at ?? "—"} accepted=${p.accepted_at ?? "—"} declined=${p.declined_at ?? "—"}`);
      for (const it of p.items_summary) lines.push(`     · ${it}`);
    }
  } else {
    lines.push(`PROPOSALS: (nenhuma)`);
  }

  // === Engajamento com a proposta ===
  if (brief.proposal_analytics && brief.proposal_analytics.length > 0) {
    const anyView = brief.proposal_analytics.some((p) => p.view_count > 0);
    if (anyView) {
      lines.push(`PROPOSAL_ENGAGEMENT (analytics reais — use estes números literalmente):`);
      for (const pa of brief.proposal_analytics) {
        if (pa.view_count === 0) continue;
        const cities = pa.cities.length > 0 ? ` cidades=${pa.cities.join("/")}` : "";
        const sec = pa.sections_viewed.length > 0 ? ` seções=${pa.sections_viewed.join(",")}` : "";
        lines.push(`  - "${pa.proposal_title ?? pa.proposal_id}" aberturas=${pa.view_count} última=${pa.last_viewed_at ?? "—"} tempo_total=${pa.total_seconds}s scroll_max=${pa.max_scroll_pct ?? "—"}% device=${pa.dominant_device ?? "—"}${cities}${sec}`);
      }
    }
  }

  // === Histórico da conta ===
  const ac = brief.account_context;
  if (ac && (ac.other_opportunities.length > 0 || ac.contracts.length > 0 || ac.account_notes.length > 0 || ac.revenue_history.won_count > 0)) {
    lines.push(`ACCOUNT_HISTORY (mesma conta — pode mencionar; NÃO use nomes de outras contas):`);
    const r = ac.revenue_history;
    lines.push(`  resumo: won=${r.won_count} lost=${r.lost_count} open=${r.open_count} valor_ganho_total=${r.total_won_value} mrr_ativo=${r.active_mrr} one_time_ativo=${r.total_one_time}`);
    if (ac.other_opportunities.length > 0) {
      lines.push(`  outras_oportunidades:`);
      for (const o of ac.other_opportunities) {
        lines.push(`    - "${o.title ?? "—"}" status=${o.status ?? "—"} valor=${o.valor_previsto ?? "—"} fechado=${o.closed_at ?? "—"}`);
      }
    }
    if (ac.contracts.length > 0) {
      lines.push(`  contratos:`);
      for (const c of ac.contracts) {
        lines.push(`    - "${c.title ?? "—"}" status=${c.status ?? "—"} tipo=${c.contract_type ?? "—"} mrr=${c.monthly_value ?? "—"} avulso=${c.one_time_value ?? "—"} inicio=${c.start_date ?? "—"} fim=${c.end_date ?? "—"}`);
      }
    }
    if (ac.account_notes.length > 0) {
      lines.push(`  anotacoes_da_conta:`);
      for (const n of ac.account_notes) lines.push(`    - ${n.content}`);
    }
  }

  // === Saúde do deal (NRHS por pilar / eventos) ===
  if (brief.nrhs_detail && (brief.nrhs_detail.score != null || (brief.nrhs_detail.recent_events || []).length > 0)) {
    lines.push(`NRHS_DETAIL (saúde do deal):`);
    lines.push(`  score=${brief.nrhs_detail.score ?? "—"} tier=${brief.nrhs_detail.tier ?? "—"}`);
    if (brief.nrhs_detail.blockers) {
      lines.push(`  blockers: ${typeof brief.nrhs_detail.blockers === "object" ? JSON.stringify(brief.nrhs_detail.blockers).slice(0, 400) : String(brief.nrhs_detail.blockers).slice(0, 400)}`);
    }
    for (const e of brief.nrhs_detail.recent_events) {
      lines.push(`  evento: ${e.event_type} @ ${e.created_at ?? "—"}`);
    }
  }

  // === Estado emocional / vibe ===
  const v = brief.vibe;
  if (v && (v.last_emotional_state || v.last_interaction_summary || v.recent_alerts.length > 0)) {
    lines.push(`VIBE (use para calibrar tom — NUNCA invente sentimentos):`);
    lines.push(`  estado=${v.last_emotional_state ?? "—"} risco_break=${v.risk_of_vibe_break ?? "—"} motivo=${v.vibe_break_reason ?? "—"}`);
    lines.push(`  tom_ideal=${v.ideal_tone ?? "—"} ritmo=${v.response_rhythm ?? "—"} canal_pref=${v.preferred_channel ?? "—"} melhor_horario=${v.best_contact_time ?? "—"}`);
    if (v.dominant_objection_type) lines.push(`  objecao_dominante=${v.dominant_objection_type}`);
    if (v.last_interaction_summary) lines.push(`  ultima_interacao: ${v.last_interaction_summary.slice(0, 240)}`);
    for (const al of v.recent_alerts) {
      lines.push(`  alerta[${al.priority ?? "—"}]: ${al.title ?? "—"} — ${al.recommendation ?? al.message ?? "—"}`);
    }
  }

  if (brief.recent_activities.length > 0) {
    lines.push(`RECENT_ACTIVITIES (mais recentes primeiro):`);
    for (const a of brief.recent_activities) {
      const desc = a.description ? ` — ${String(a.description).replace(/\s+/g, " ").slice(0, 240)}` : "";
      lines.push(`  - [${a.type}] "${a.title ?? "—"}" status=${a.status ?? "—"} sched=${a.scheduled_date ?? "—"} done=${a.completed_at ?? "—"}${desc}`);
    }
  } else {
    lines.push(`RECENT_ACTIVITIES: (nenhuma)`);
  }

  if (brief.manual_emails.length > 0) {
    lines.push(`MANUAL_EMAILS (vendedor → cliente):`);
    for (const m of brief.manual_emails) {
      lines.push(`  - "${m.subject ?? "(sem assunto)"}" dir=${m.direction ?? "—"} from=${m.from_email ?? "—"} sent=${m.sent_at ?? "—"}`);
      if (m.body_excerpt) lines.push(`     trecho: ${m.body_excerpt}`);
    }
  } else {
    lines.push(`MANUAL_EMAILS: (nenhum)`);
  }

  // === Linha do tempo unificada ===
  if (brief.timeline_highlights && brief.timeline_highlights.length > 0) {
    lines.push(`TIMELINE_HIGHLIGHTS (eventos cross-entity, 15 mais recentes):`);
    for (const t of brief.timeline_highlights) {
      lines.push(`  - [${t.type}/${t.activity_type ?? "—"}] ${t.title ?? "—"} @ ${t.timestamp ?? "—"}`);
    }
  }

  lines.push(`</opportunity_brief>`);
  return lines.join("\n");
}
