// KAI.15.1 / KAI.15.2 — Apollo Phone Quality Guard
// Classifica telefones retornados pelo Apollo em pessoa (mobile/direct/whatsapp)
// vs empresa (reception/main). Rejeita telefones herdados de organization/account.
// Também computa qualidade, confiança e prontidão WhatsApp.

export type PhoneSourceType =
  | "person_mobile"
  | "person_direct"
  | "company_main"
  | "unknown";

export type PhoneMatchQuality =
  | "person_whatsapp"
  | "person_mobile"
  | "person_direct"
  | "company_reception"
  | "company_main"
  | "unknown";

export type PhoneType =
  | "mobile"
  | "direct"
  | "whatsapp"
  | "company_main"
  | "company_reception"
  | "unknown";

export type PhoneValidationStatus =
  | "valid"
  | "likely_valid"
  | "unknown"
  | "invalid"
  | "stale";

export interface PhoneClassification {
  phone: string | null;
  sourceType: PhoneSourceType;
  rejectedCompanyPhone: string | null;
}

export interface PhoneQuality {
  phone: string | null;
  phone_source: "apollo" | "manual" | "crm" | "imported" | "unknown";
  phone_type: PhoneType;
  phone_match_quality: PhoneMatchQuality;
  phone_confidence: number;
  is_whatsapp_ready: boolean;
  phone_validation_status: PhoneValidationStatus;
  reason: string;
  rejected_company_phone: string | null;
}

const PERSON_TYPES = new Set([
  "mobile",
  "cell",
  "cellular",
  "personal",
  "person",
  "home",
]);
const DIRECT_TYPES = new Set([
  "direct",
  "direct_dial",
  "direct_phone",
  "work_direct",
  "office_direct",
]);
const COMPANY_TYPES = new Set([
  "corporate",
  "corporate_hq",
  "hq",
  "headquarters",
  "main",
  "company",
  "organization",
  "office",
  "work",
  "general",
  "switchboard",
]);

const PERSON_FIELDS = [
  "mobile_phone",
  "mobile",
  "cell_phone",
  "cellphone",
  "personal_phone",
  "personal_number",
  "direct_dial",
  "direct_phone",
  "direct_number",
  "work_direct_phone",
];

const COMPANY_FIELDS = [
  "corporate_phone",
  "corporate_hq_phone",
  "company_phone",
  "main_phone",
  "headquarters_phone",
  "hq_phone",
  "office_phone",
  "general_phone",
];

function digits(v: unknown): string {
  return String(v ?? "").replace(/\D+/g, "");
}

function isPlausiblePhone(v: unknown): boolean {
  const d = digits(v);
  return d.length >= 7 && d.length <= 20;
}

function normalizeType(t: unknown): string {
  return String(t ?? "").toLowerCase().replace(/\s+/g, "_");
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function collectCompanyPhones(person: any): Set<string> {
  const set = new Set<string>();
  const push = (v: unknown) => {
    if (!isPlausiblePhone(v)) return;
    set.add(digits(v));
  };
  const org = person?.organization ?? person?.account ?? null;
  if (org) {
    push(org.phone);
    push(org.primary_phone);
    push(org.sanitized_phone);
    push(org.corporate_phone);
    push(org.main_phone);
    if (Array.isArray(org.phone_numbers)) {
      for (const p of org.phone_numbers) {
        push(p?.sanitized_number ?? p?.raw_number ?? p?.number ?? p?.value);
      }
    }
  }
  for (const f of COMPANY_FIELDS) push(person?.[f]);
  return set;
}

/**
 * Classifica um telefone retornado pelo Apollo people/match ou webhook.
 * @param person   Registro `person` (ou payload equivalente do webhook)
 * @param extraCompanyPhones telefones conhecidos da empresa (ex.: enriched_company_profiles.phone)
 */
export function classifyApolloPhone(
  person: any,
  extraCompanyPhones: (string | null | undefined)[] = [],
): PhoneClassification {
  if (!person || typeof person !== "object") {
    return { phone: null, sourceType: "unknown", rejectedCompanyPhone: null };
  }

  const companyDigits = collectCompanyPhones(person);
  for (const p of extraCompanyPhones) {
    if (isPlausiblePhone(p)) companyDigits.add(digits(p));
  }

  const isCompanyMatch = (v: unknown) => {
    if (!isPlausiblePhone(v)) return false;
    return companyDigits.has(digits(v));
  };

  // 1) Explicit person fields
  for (const f of PERSON_FIELDS) {
    const val = person?.[f];
    if (!isPlausiblePhone(val)) continue;
    if (isCompanyMatch(val)) continue;
    const isMobile = /mobile|cell|personal/i.test(f);
    return {
      phone: String(val).trim(),
      sourceType: isMobile ? "person_mobile" : "person_direct",
      rejectedCompanyPhone: null,
    };
  }

  // 2) phone_numbers array (Apollo people/match returns typed entries)
  const arrays: any[] = [];
  if (Array.isArray(person.phone_numbers)) arrays.push(...person.phone_numbers);
  if (Array.isArray(person.phone_numbers_for_person)) arrays.push(...person.phone_numbers_for_person);
  if (Array.isArray(person.contact_phone_numbers)) arrays.push(...person.contact_phone_numbers);

  // Prefer mobile → direct → other person types; ignore company types.
  const scored: Array<{ value: string; sourceType: PhoneSourceType; rank: number }> = [];
  for (const entry of arrays) {
    const value = firstString(
      entry?.sanitized_number,
      entry?.raw_number,
      entry?.number,
      entry?.value,
      entry?.phone,
    );
    if (!isPlausiblePhone(value)) continue;
    const t = normalizeType(entry?.type ?? entry?.phone_type ?? entry?.category ?? entry?.label);
    if (COMPANY_TYPES.has(t)) continue;
    if (isCompanyMatch(value)) continue;
    if (PERSON_TYPES.has(t)) scored.push({ value: value!, sourceType: "person_mobile", rank: 100 });
    else if (DIRECT_TYPES.has(t)) scored.push({ value: value!, sourceType: "person_direct", rank: 80 });
    else if (t === "" || t === "unknown" || t === "other") {
      // Untyped Apollo entries: only accept if not equal to any company phone.
      // Treat as direct dial (person-owned) since Apollo separates org phones.
      scored.push({ value: value!, sourceType: "person_direct", rank: 40 });
    }
  }
  scored.sort((a, b) => b.rank - a.rank);
  if (scored.length > 0) {
    const best = scored[0];
    return { phone: best.value, sourceType: best.sourceType, rejectedCompanyPhone: null };
  }

  // 3) Bare sanitized_phone on person (only if != company phone)
  const bare = firstString(person.sanitized_phone, person.phone);
  if (isPlausiblePhone(bare) && !isCompanyMatch(bare)) {
    // Ambiguous — Apollo sometimes populates this from organization data.
    // Only accept when there's clearly no organization phone we could match against.
    if (companyDigits.size === 0) {
      return { phone: bare, sourceType: "person_direct", rejectedCompanyPhone: null };
    }
  }

  // 4) Nothing acceptable — surface which company phone was seen (audit only)
  const rejected = firstString(
    person?.organization?.phone,
    person?.organization?.primary_phone,
    person?.organization?.sanitized_phone,
    person?.account?.phone,
    person?.corporate_phone,
    person?.main_phone,
    person?.company_phone,
    bare,
  );
  return {
    phone: null,
    sourceType: rejected ? "company_main" : "unknown",
    rejectedCompanyPhone: rejected,
  };
}
