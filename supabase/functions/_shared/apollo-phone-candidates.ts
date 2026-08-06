// KAI.18.14 — Apollo Phone Candidate Classification & Parity
// Módulo ÚNICO de extração/normalização/classificação/ranking de telefones Apollo.
// Usado por: kairos-apollo-reveal-contact, reveal-apollo-contact, apollo-phone-webhook,
// kairos-apollo-reveal-status-sync e reprocessamento de payload histórico.
//
// Regras inegociáveis:
// - Processar TODOS os candidatos do payload, em qualquer profundidade.
// - Nunca descartar telefone pessoal só porque existe outro corporativo no payload.
// - `company_general` exige evidência objetiva (match E.164 exato com telefone oficial,
//   tipo explícito do provider, ou candidato vindo do objeto organization/account).
// - DDD igual, cidade igual, domínio igual, ausência de label → NÃO é evidência.

export type PhoneClassificationKind =
  | "person_mobile"
  | "person_direct"
  | "person_unclassified"
  | "company_general"
  | "invalid";

export type PhoneOutcome =
  | "revealed"
  | "rejected_company_phone"
  | "not_found"
  | "phone_only_web"
  | "pending_provider";

export interface PhoneCandidate {
  path: string;
  raw: string;
  normalized: string;
  e164: string | null;
  provider_type: string | null;
  source: string | null;
  label: string | null;
  validated: boolean;
  company_exact_match: boolean;
  classification: PhoneClassificationKind;
  eligible: boolean;
  confidence: number;
  rank_score: number;
  rejection_reason: string | null;
  evidence: string | null;
}

export interface PhoneSelection {
  outcome: PhoneOutcome;
  selected: PhoneCandidate | null;
  reason: string;
  candidates: PhoneCandidate[];
  rejected: PhoneCandidate[];
  company_phones: string[];
  provider_indicates_phone: boolean;
}

const PERSON_TYPES = new Set([
  "mobile", "cell", "cellular", "personal", "person", "home", "whatsapp", "mobile_phone",
]);
const DIRECT_TYPES = new Set([
  "direct", "direct_dial", "direct_phone", "work_direct", "office_direct", "work",
]);
const COMPANY_TYPES = new Set([
  "company", "company_main", "corporate", "corporate_hq", "hq", "headquarters",
  "main", "organization", "general", "switchboard", "reception", "other_company",
]);

const PHONE_KEY_RE =
  /(^|_)(phone|phones|phone_number|phone_numbers|mobile|cell|dial|telephone|tel|whatsapp)($|_)/i;
const COMPANY_PATH_RE = /(organization|account|company|employer|corporate|headquarters|hq)/i;

export function phoneDigits(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}

/** Normaliza para dígitos canônicos (BR: remove 55 duplicado / zeros de tronco). */
export function normalizePhone(v: unknown): string {
  let d = phoneDigits(v);
  if (!d) return "";
  d = d.replace(/^0+/, "");
  if (d.startsWith("055")) d = d.slice(1);
  return d;
}

/** Chave de deduplicação: compara pelos últimos 8-9 dígitos significativos. */
export function phoneKey(v: unknown): string {
  const d = normalizePhone(v);
  if (d.length <= 9) return d;
  return d.slice(-9);
}

export function toE164(v: unknown): string | null {
  const d = normalizePhone(v);
  if (d.length < 8 || d.length > 15) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}

export function isPlausiblePhone(v: unknown): boolean {
  const d = normalizePhone(v);
  return d.length >= 8 && d.length <= 15;
}

/** Celular brasileiro (nono dígito). Sinal fraco: nunca é evidência de corporativo. */
export function isBrazilianMobile(v: unknown): boolean {
  const d = normalizePhone(v).replace(/^55/, "");
  return d.length === 11 && d[2] === "9";
}

function normType(t: unknown): string | null {
  const s = String(t ?? "").toLowerCase().trim().replace(/\s+/g, "_");
  return s.length ? s : null;
}

interface RawHit {
  path: string;
  raw: string;
  provider_type: string | null;
  source: string | null;
  label: string | null;
  validated: boolean;
  from_company_object: boolean;
}

function pushEntry(hits: RawHit[], path: string, entry: any, inCompany: boolean) {
  if (entry == null) return;
  if (typeof entry === "string" || typeof entry === "number") {
    if (!isPlausiblePhone(entry)) return;
    hits.push({
      path, raw: String(entry), provider_type: null, source: null, label: null,
      validated: false, from_company_object: inCompany,
    });
    return;
  }
  if (typeof entry !== "object") return;
  const raw =
    entry.sanitized_number ?? entry.raw_number ?? entry.number ?? entry.value ??
    entry.phone ?? entry.phone_number ?? entry.formatted_phone ?? null;
  if (!isPlausiblePhone(raw)) return;
  hits.push({
    path,
    raw: String(raw),
    provider_type: normType(entry.type ?? entry.phone_type ?? entry.category),
    source: entry.source ? String(entry.source) : null,
    label: entry.label ? String(entry.label) : (entry.position ? String(entry.position) : null),
    validated: entry.status === "valid_number" || entry.dnc_status === "clear" ||
      entry.validated === true || entry.verified === true,
    from_company_object: inCompany,
  });
}

/** Percorre o payload inteiro coletando qualquer telefone, em qualquer profundidade. */
function walk(node: any, path: string, inCompany: boolean, hits: RawHit[], seen: Set<any>, depth = 0) {
  if (node == null || depth > 12) return;
  if (typeof node === "object") {
    if (seen.has(node)) return;
    seen.add(node);
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`, inCompany, hits, seen, depth + 1));
    return;
  }
  if (typeof node !== "object") return;

  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}.${key}` : key;
    const childInCompany = inCompany || COMPANY_PATH_RE.test(key);
    const isPhoneKey = PHONE_KEY_RE.test(key);

    if (isPhoneKey) {
      if (Array.isArray(value)) {
        value.forEach((v, i) => pushEntry(hits, `${childPath}[${i}]`, v, childInCompany));
      } else if (value && typeof value === "object") {
        pushEntry(hits, childPath, value, childInCompany);
      } else {
        pushEntry(hits, childPath, value, childInCompany);
      }
      // segue descendo: arrays de objetos podem ter estruturas aninhadas
    }
    if (value && typeof value === "object") {
      walk(value, childPath, childInCompany, hits, seen, depth + 1);
    }
  }
}

/** Telefones oficiais da organização (evidência objetiva de corporativo). */
export function collectCompanyPhones(
  payload: any,
  extra: (string | null | undefined)[] = [],
): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (isPlausiblePhone(v)) out.add(phoneKey(v));
  };
  const orgs = [payload?.organization, payload?.account, payload?.person?.organization, payload?.person?.account];
  for (const org of orgs) {
    if (!org || typeof org !== "object") continue;
    add(org.phone); add(org.primary_phone); add(org.sanitized_phone);
    add(org.corporate_phone); add(org.main_phone);
    if (Array.isArray(org.phone_numbers)) {
      for (const p of org.phone_numbers) add(p?.sanitized_number ?? p?.raw_number ?? p?.number ?? p?.value ?? p);
    }
  }
  for (const p of ["corporate_phone", "corporate_hq_phone", "company_phone", "main_phone", "headquarters_phone", "hq_phone", "general_phone"]) {
    add(payload?.[p]); add(payload?.person?.[p]);
  }
  for (const e of extra) add(e);
  return [...out];
}

function classify(hit: RawHit, companyKeys: Set<string>): PhoneCandidate {
  const normalized = normalizePhone(hit.raw);
  const e164 = toE164(hit.raw);
  const key = phoneKey(hit.raw);
  const companyExact = companyKeys.has(key);
  const t = hit.provider_type;

  const base = {
    path: hit.path,
    raw: hit.raw,
    normalized,
    e164,
    provider_type: t,
    source: hit.source,
    label: hit.label,
    validated: hit.validated,
    company_exact_match: companyExact,
  };

  if (!isPlausiblePhone(hit.raw)) {
    return { ...base, classification: "invalid", eligible: false, confidence: 0, rank_score: 0, rejection_reason: "malformed_number", evidence: "digits_out_of_range" };
  }
  if (companyExact) {
    return { ...base, classification: "company_general", eligible: false, confidence: 10, rank_score: 0, rejection_reason: "company_exact_match", evidence: "e164_exact_match_with_organization_phone" };
  }
  if (t && COMPANY_TYPES.has(t)) {
    return { ...base, classification: "company_general", eligible: false, confidence: 10, rank_score: 0, rejection_reason: "provider_type_company", evidence: `provider_type=${t}` };
  }
  if (hit.from_company_object && !(t && (PERSON_TYPES.has(t) || DIRECT_TYPES.has(t)))) {
    return { ...base, classification: "company_general", eligible: false, confidence: 10, rank_score: 0, rejection_reason: "organization_object_phone", evidence: `path=${hit.path}` };
  }
  if (t && PERSON_TYPES.has(t)) {
    const validatedBonus = hit.validated ? 10 : 0;
    return { ...base, classification: "person_mobile", eligible: true, confidence: 95, rank_score: 100 + validatedBonus, rejection_reason: null, evidence: `provider_type=${t}` };
  }
  if (t && DIRECT_TYPES.has(t)) {
    return { ...base, classification: "person_direct", eligible: true, confidence: 85, rank_score: 80 + (hit.validated ? 5 : 0), rejection_reason: null, evidence: `provider_type=${t}` };
  }
  // Sem tipo explícito: candidato pessoal não conclusivo — elegível, ranking menor.
  const brMobile = isBrazilianMobile(hit.raw);
  return {
    ...base,
    classification: "person_unclassified",
    eligible: true,
    confidence: brMobile ? 70 : 55,
    rank_score: brMobile ? 60 : 45,
    rejection_reason: null,
    evidence: brMobile ? "br_mobile_pattern_no_provider_type" : "person_scoped_no_provider_type",
  };
}

/** True quando o payload sinaliza existência de telefone sem devolver o número. */
export function providerIndicatesPhone(payload: any): boolean {
  const p = payload?.person ?? payload ?? {};
  const yes = (v: unknown) => v === true || String(v ?? "").toLowerCase() === "yes";
  if (yes(p.has_direct_phone) || yes(p.has_mobile_phone) || yes(p.phone_available)) return true;
  const arr = p.phone_numbers;
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.some((e: any) => e && typeof e === "object" &&
      !isPlausiblePhone(e.sanitized_number ?? e.raw_number ?? e.number ?? e.value));
  }
  return false;
}

export interface SelectOptions {
  extraCompanyPhones?: (string | null | undefined)[];
  /** Payloads adicionais (webhook, reconciliação, histórico) analisados em conjunto. */
  extraPayloads?: any[];
  /** Indica que o provider ainda pode entregar assincronamente. */
  allowPending?: boolean;
}

export function selectBestPhone(payload: any, opts: SelectOptions = {}): PhoneSelection {
  const payloads = [payload, ...(opts.extraPayloads ?? [])].filter((p) => p && typeof p === "object");
  const companyKeysArr = payloads.flatMap((p) => collectCompanyPhones(p, opts.extraCompanyPhones ?? []));
  const companyKeys = new Set(companyKeysArr);

  const hits: RawHit[] = [];
  payloads.forEach((p, i) => walk(p, i === 0 ? "$" : `$payload${i}`, false, hits, new Set()));

  // Dedup por chave normalizada, preservando o hit com mais informação de tipo.
  const byKey = new Map<string, RawHit>();
  for (const h of hits) {
    const k = phoneKey(h.raw);
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, h); continue; }
    const score = (x: RawHit) => (x.provider_type ? 2 : 0) + (x.validated ? 1 : 0) + (x.from_company_object ? -1 : 0);
    if (score(h) > score(prev)) byKey.set(k, h);
  }

  const candidates = [...byKey.values()]
    .map((h) => classify(h, companyKeys))
    .sort((a, b) => b.rank_score - a.rank_score || b.confidence - a.confidence);

  const eligible = candidates.filter((c) => c.eligible);
  const rejected = candidates.filter((c) => !c.eligible);
  const indicates = payloads.some((p) => providerIndicatesPhone(p));

  if (eligible.length > 0) {
    return {
      outcome: "revealed",
      selected: eligible[0],
      reason: `selected_${eligible[0].classification}`,
      candidates, rejected, company_phones: [...companyKeys], provider_indicates_phone: indicates,
    };
  }
  if (candidates.length > 0) {
    return {
      outcome: "rejected_company_phone",
      selected: null,
      reason: "all_candidates_company_general",
      candidates, rejected, company_phones: [...companyKeys], provider_indicates_phone: indicates,
    };
  }
  if (indicates) {
    return {
      outcome: opts.allowPending ? "pending_provider" : "phone_only_web",
      selected: null,
      reason: opts.allowPending ? "provider_processing" : "phone_absent_from_api_payload",
      candidates, rejected, company_phones: [...companyKeys], provider_indicates_phone: true,
    };
  }
  return {
    outcome: "not_found",
    selected: null,
    reason: "no_phone_in_payload",
    candidates, rejected, company_phones: [...companyKeys], provider_indicates_phone: false,
  };
}

/** Resumo enxuto para auditoria/RPC. */
export function auditSummary(sel: PhoneSelection) {
  return {
    outcome: sel.outcome,
    reason: sel.reason,
    selected: sel.selected
      ? {
        path: sel.selected.path, e164: sel.selected.e164,
        classification: sel.selected.classification, confidence: sel.selected.confidence,
        provider_type: sel.selected.provider_type, evidence: sel.selected.evidence,
      }
      : null,
    rejected: sel.rejected.slice(0, 10).map((c) => ({
      path: c.path, e164: c.e164, classification: c.classification,
      rejection_reason: c.rejection_reason, evidence: c.evidence,
    })),
    company_phones: sel.company_phones.slice(0, 10),
    provider_indicates_phone: sel.provider_indicates_phone,
    candidate_count: sel.candidates.length,
  };
}
