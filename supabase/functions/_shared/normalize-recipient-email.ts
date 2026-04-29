// Shared helper to normalize a recipient email coming from heterogeneous sources.
//
// Why: contact records may store emails as a plain string (legacy) OR as an
// array of structured objects `{type, value, is_primary}` (new format). When
// edge functions persisted the raw value into `ai_email_messages.recipient_email`,
// the JSON object reached SMTP and broke sending with "No valid emails provided".
//
// This helper accepts ANY of the following and returns a clean email string,
// or `null` if it cannot extract a valid one:
//   - "user@x.com"
//   - { value: "user@x.com" } (or { email })
//   - [{ value: "...", is_primary: true }, { value: "..." }]
//   - JSON-stringified versions of any of the above (defensive against legacy rows)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRecipientEmail(input: unknown): string | null {
  if (input == null) return null;

  // Defensive: if it's a string that *looks* like JSON, try parsing first.
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return normalizeRecipientEmail(JSON.parse(trimmed));
      } catch {
        // fall through to plain-string handling
      }
    }
    return EMAIL_RE.test(trimmed) ? trimmed.toLowerCase() : null;
  }

  if (Array.isArray(input)) {
    // Prefer is_primary, then first valid
    const primary = input.find(
      (e) => e && typeof e === "object" && (e as any).is_primary === true,
    );
    const candidates = primary ? [primary, ...input] : input;
    for (const c of candidates) {
      const r = normalizeRecipientEmail(c);
      if (r) return r;
    }
    return null;
  }

  if (typeof input === "object") {
    const o = input as Record<string, unknown>;
    const candidate =
      (typeof o.value === "string" && o.value) ||
      (typeof o.email === "string" && o.email) ||
      (typeof o.address === "string" && o.address) ||
      null;
    if (candidate) return normalizeRecipientEmail(candidate);
    return null;
  }

  return null;
}
