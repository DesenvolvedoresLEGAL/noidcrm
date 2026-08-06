// KAI.15.1 / KAI.15.2 / KAI.18.14 — Apollo Phone Quality Guard
// Fachada de compatibilidade: TODA a lógica de extração/classificação/ranking vive em
// `apollo-phone-candidates.ts`. Este módulo apenas traduz a seleção para o contrato
// legado (PhoneQuality) consumido pelas edge functions.

import {
  auditSummary,
  isBrazilianMobile,
  type PhoneCandidate,
  type PhoneOutcome,
  type PhoneSelection,
  selectBestPhone,
} from "./apollo-phone-candidates.ts";

export type PhoneSourceType = "person_mobile" | "person_direct" | "company_main" | "unknown";

export type PhoneMatchQuality =
  | "person_whatsapp" | "person_mobile" | "person_direct"
  | "company_reception" | "company_main" | "unknown";

export type PhoneType = "mobile" | "direct" | "whatsapp" | "company_main" | "company_reception" | "unknown";

export type PhoneValidationStatus = "valid" | "likely_valid" | "unknown" | "invalid" | "stale";

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
  /** KAI.18.14 — resultado determinístico do seletor de candidatos. */
  outcome: PhoneOutcome;
  selection: PhoneSelection;
  audit: ReturnType<typeof auditSummary>;
}

/** Compat: classificação simples (usa o seletor oficial). */
export function classifyApolloPhone(
  person: any,
  extraCompanyPhones: (string | null | undefined)[] = [],
): PhoneClassification {
  const sel = selectBestPhone(person, { extraCompanyPhones });
  const sourceType: PhoneSourceType = sel.selected
    ? (sel.selected.classification === "person_mobile" ? "person_mobile" : "person_direct")
    : (sel.outcome === "rejected_company_phone" ? "company_main" : "unknown");
  return {
    phone: sel.selected?.raw ?? null,
    sourceType,
    rejectedCompanyPhone: sel.outcome === "rejected_company_phone"
      ? (sel.rejected[0]?.e164 ?? sel.rejected[0]?.raw ?? null)
      : null,
  };
}

function qualityFromCandidate(c: PhoneCandidate): Pick<PhoneQuality, "phone_type" | "phone_match_quality" | "phone_confidence" | "is_whatsapp_ready" | "phone_validation_status" | "reason"> {
  const brMobile = isBrazilianMobile(c.raw);
  if (c.classification === "person_mobile") {
    return {
      phone_type: "mobile", phone_match_quality: "person_mobile", phone_confidence: c.confidence,
      is_whatsapp_ready: brMobile, phone_validation_status: c.validated ? "valid" : "likely_valid",
      reason: "person_mobile_detected",
    };
  }
  if (c.classification === "person_direct") {
    return {
      phone_type: "direct", phone_match_quality: "person_direct", phone_confidence: c.confidence,
      is_whatsapp_ready: brMobile, phone_validation_status: c.validated ? "valid" : "likely_valid",
      reason: "person_direct_detected",
    };
  }
  // person_unclassified
  return {
    phone_type: brMobile ? "mobile" : "unknown",
    phone_match_quality: brMobile ? "person_mobile" : "unknown",
    phone_confidence: c.confidence,
    is_whatsapp_ready: brMobile,
    phone_validation_status: "unknown",
    reason: brMobile ? "person_mobile_pattern_unclassified" : "person_phone_unclassified",
  };
}

export function computePhoneQualityFromSelection(
  sel: PhoneSelection,
  source: PhoneQuality["phone_source"] = "apollo",
): PhoneQuality {
  const audit = auditSummary(sel);
  if (sel.selected) {
    return {
      phone: sel.selected.e164 ?? sel.selected.raw,
      phone_source: source,
      ...qualityFromCandidate(sel.selected),
      rejected_company_phone: null,
      outcome: sel.outcome,
      selection: sel,
      audit,
    };
  }
  if (sel.outcome === "rejected_company_phone") {
    return {
      phone: null, phone_source: source, phone_type: "company_main",
      phone_match_quality: "company_main", phone_confidence: 10, is_whatsapp_ready: false,
      phone_validation_status: "invalid", reason: "company_phone_rejected",
      rejected_company_phone: sel.rejected[0]?.e164 ?? sel.rejected[0]?.raw ?? null,
      outcome: sel.outcome, selection: sel, audit,
    };
  }
  const reason = sel.outcome === "phone_only_web"
    ? "phone_absent_from_api_payload"
    : sel.outcome === "pending_provider"
    ? "provider_processing"
    : "no_person_phone_returned";
  return {
    phone: null, phone_source: source, phone_type: "unknown", phone_match_quality: "unknown",
    phone_confidence: 0, is_whatsapp_ready: false, phone_validation_status: "unknown",
    reason, rejected_company_phone: null, outcome: sel.outcome, selection: sel, audit,
  };
}

export function computePhoneQuality(
  person: any,
  extraCompanyPhones: (string | null | undefined)[] = [],
  source: PhoneQuality["phone_source"] = "apollo",
  opts: { extraPayloads?: any[]; allowPending?: boolean } = {},
): PhoneQuality {
  const sel = selectBestPhone(person, { extraCompanyPhones, ...opts });
  return computePhoneQualityFromSelection(sel, source);
}
