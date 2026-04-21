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
  // The exact, lower-cased token allowlist used by the anti-hallucination
  // validator. Anything in body/subject that "looks like" a proper noun and
  // is NOT in this set will be flagged as suspicious.
  allowlist_tokens: string[];
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

  // 6. Recent activities WITH description
  const { data: activities } = await supabase
    .from("activities")
    .select("id, type, title, description, status, scheduled_date, completed_at, ai_generated, is_automated")
    .eq("opportunity_id", opportunityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  // 7. Manual emails sent by the seller (with a body excerpt)
  const { data: manualEmails } = await supabase
    .from("opportunity_emails")
    .select("subject, body, body_text, body_html, direction, sent_at, from_email")
    .eq("opportunity_id", opportunityId)
    .order("sent_at", { ascending: false })
    .limit(5);

  const manualEmailsOut = (manualEmails || []).map((m: any) => {
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
  // and proposal item names.
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
  // Manual email subjects & their content also belong to this opp -> safe to allow
  for (const m of manualEmailsOut) {
    if (m.subject) allowlistRaw.push(m.subject);
    if (m.body_excerpt) allowlistRaw.push(m.body_excerpt);
  }
  if (account.observacoes) allowlistRaw.push(account.observacoes);
  if (primaryEmail) allowlistRaw.push(String(primaryEmail).split("@")[1] || ""); // domain ok

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
  ].join("|");
  // Simple FNV-ish hash so we don't need Web Crypto here.
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
    allowlist_tokens,
  };
}

// ---------- Anti-hallucination validator ----------

export interface HallucinationCheckResult {
  ok: boolean;
  suspicious_terms: string[];
  /**
   * A short reason explaining what to surface to humans.
   * Empty when ok=true.
   */
  reason: string;
}

/**
 * Looks at the generated subject + body, extracts capitalized "name-like"
 * tokens (proper nouns), and flags any that are NOT present in the brief's
 * allowlist. Stopwords + dates/days/months are ignored.
 */
export function detectHallucinations(
  generated: { subject?: string | null; body_text?: string | null; body_html?: string | null },
  brief: OpportunityBrief,
): HallucinationCheckResult {
  const allowSet = new Set(brief.allowlist_tokens);
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
    // Allow when it is a sub-token of any allowed multi-word entry, or
    // when any allowed token contains it / vice versa (handles "Telamagica"
    // vs "Tela" + "Magica").
    let matched = false;
    for (const allowed of allowSet) {
      if (allowed.length >= 4 && (allowed.includes(lo) || lo.includes(allowed))) {
        matched = true;
        break;
      }
    }
    if (!matched) suspicious.push(cand);
  }

  if (suspicious.length === 0) {
    return { ok: true, suspicious_terms: [], reason: "" };
  }

  return {
    ok: false,
    suspicious_terms: Array.from(new Set(suspicious)).slice(0, 20),
    reason: `Termos não encontrados na oportunidade: ${Array.from(new Set(suspicious)).slice(0, 10).join(", ")}`,
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

  lines.push(`</opportunity_brief>`);
  return lines.join("\n");
}
