// Deterministic post-generation style sanitizer for AI-generated emails.
// Goal: keep the model's "telemetry dump" out of the final copy. We do NOT
// rewrite content here — we only DETECT violations and let the orchestrator
// decide whether to (a) re-run the humanize pass or (b) force human approval
// with a clear reason.

export type StyleViolationKind =
  | "iso_timestamp"
  | "timezone_marker"
  | "scroll_metric"
  | "duration_seconds"
  | "all_caps_run"
  | "blacklist_term"
  | "section_dump"
  | "boilerplate_phrase";

export interface StyleViolation {
  kind: StyleViolationKind;
  match: string;
  hint?: string;
}

export interface StyleCheckResult {
  ok: boolean;
  violations: StyleViolation[];
  /** Short human-readable summary, safe to surface in the approval card. */
  summary: string;
}

// Words that betray "I read your dashboard" energy. Match case-insensitive,
// whole-word. We keep the list intentionally narrow — these are tokens the
// model literally copied from the brief field names.
const BLACKLIST_TERMS = [
  "engajamento",
  "métrica", "metrica", "métricas", "metricas",
  "telemetria",
  "score", "scores",
  "nrhs",
  "vibe",
  "vibe_state",
  "blocker", "blockers",
  "scroll",
  "scroll_pct",
  "sections_viewed",
  "seções visualizadas", "secoes visualizadas",
  "view_count",
  "tempo_total",
  "max_scroll",
  "dominant_device",
  "proposal_engagement",
  "account_history",
  "timeline_highlights",
];

// Section names that came from proposal_views.sections_viewed. If the model
// copies these literally, that's the dump symptom we're fighting.
const TECHNICAL_SECTION_TOKENS = [
  "header", "context", "items", "payment", "cta",
];

// Boilerplate phrases the team explicitly rejected as "robotic openers".
const BOILERPLATE_PATTERNS: RegExp[] = [
  /\benvio r[áa]pido sobre\b/i,
  /\bpodemos alinhar pr[óo]ximos passos\b/i,
  /\b15\s*min(?:utos)?\s+na\s+quinta\b/i,
];

export function checkEmailStyle(input: { subject?: string | null; body_text?: string | null; body_html?: string | null }): StyleCheckResult {
  const subject = (input.subject || "").trim();
  const bodyText = (input.body_text || "").trim();
  const bodyFromHtml = (input.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const fullText = [subject, bodyText, bodyFromHtml].filter(Boolean).join("\n");
  const violations: StyleViolation[] = [];

  if (!fullText) {
    return { ok: true, violations: [], summary: "" };
  }

  // 1) ISO 8601 timestamps (with or without timezone).
  const isoRe = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+\-]\d{2}:?\d{2})?\b/g;
  for (const m of fullText.matchAll(isoRe)) {
    violations.push({ kind: "iso_timestamp", match: m[0], hint: "datas devem ser relativas em PT-BR (ex.: 'essa semana', 'antes do fim do mês')" });
  }

  // 2) Explicit timezone markers when no ISO date matched (catches "+00:00" / "BRT" leaks).
  const tzRe = /(\+\d{2}:?\d{2}|\bBRT\b|\bUTC\b)/g;
  for (const m of fullText.matchAll(tzRe)) {
    violations.push({ kind: "timezone_marker", match: m[0], hint: "remova o fuso horário do texto humano" });
  }

  // 3) Scroll percentages.
  const scrollRe = /\bscroll[^.\n]{0,12}\d{1,3}\s*%/gi;
  for (const m of fullText.matchAll(scrollRe)) {
    violations.push({ kind: "scroll_metric", match: m[0], hint: "não cite scroll/percentual de leitura" });
  }

  // 4) Duration in seconds ("924s", "tempo total 924s").
  const secRe = /\b\d{2,5}\s*s\b(?![a-zA-Z])/g;
  for (const m of fullText.matchAll(secRe)) {
    violations.push({ kind: "duration_seconds", match: m[0], hint: "não exponha tempo em segundos" });
  }
  if (/\btempo\s+total\b/i.test(fullText)) {
    violations.push({ kind: "duration_seconds", match: "tempo total", hint: "evite expor 'tempo total' literal" });
  }

  // 5) 4+ consecutive ALL-CAPS words (e.g. "COLUMBIA NA INFRAFM 2026").
  // Exception: skip pure numbers / single-letter tokens.
  const capsRunRe = /\b(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}\s+){3,}[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}\b/g;
  for (const m of fullText.matchAll(capsRunRe)) {
    violations.push({ kind: "all_caps_run", match: m[0], hint: "use Title Case, não CAPS LOCK" });
  }

  // 6) Blacklist terms (whole word, case-insensitive).
  const lowerText = fullText.toLowerCase();
  for (const term of BLACKLIST_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-záéíóúâêôãõç])${escaped}(?:$|[^a-záéíóúâêôãõç])`, "i");
    if (re.test(lowerText)) {
      violations.push({ kind: "blacklist_term", match: term, hint: "vocabulário interno — fale como vendedor, não como dashboard" });
    }
  }

  // 7) Technical section dump: 2+ technical section tokens listed close together.
  const sectionHits = TECHNICAL_SECTION_TOKENS.filter((s) => new RegExp(`\\b${s}\\b`, "i").test(fullText));
  if (sectionHits.length >= 2) {
    violations.push({ kind: "section_dump", match: sectionHits.join(", "), hint: "não enumere seções da proposta" });
  }

  // 8) Boilerplate openers/closers.
  for (const pattern of BOILERPLATE_PATTERNS) {
    const m = fullText.match(pattern);
    if (m) violations.push({ kind: "boilerplate_phrase", match: m[0], hint: "frase batida — varie a abordagem" });
  }

  if (violations.length === 0) {
    return { ok: true, violations: [], summary: "" };
  }

  const grouped: Partial<Record<StyleViolationKind, string[]>> = {};
  for (const v of violations) {
    if (!grouped[v.kind]) grouped[v.kind] = [];
    grouped[v.kind]!.push(v.match);
  }
  const labelMap: Record<StyleViolationKind, string> = {
    iso_timestamp: "timestamp ISO",
    timezone_marker: "fuso horário",
    scroll_metric: "scroll %",
    duration_seconds: "duração em segundos",
    all_caps_run: "CAPS LOCK",
    blacklist_term: "jargão interno",
    section_dump: "seções técnicas",
    boilerplate_phrase: "frase batida",
  };
  const summary = (Object.keys(grouped) as StyleViolationKind[])
    .map((k) => `${labelMap[k]} (${(grouped[k] || []).slice(0, 3).join(", ")})`)
    .join(" · ");

  return { ok: false, violations, summary };
}
