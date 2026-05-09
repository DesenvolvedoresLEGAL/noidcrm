// Helpers to safely display contact emails/phones that may come as string, object, or array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContactValue = any;

/**
 * Normalizes a person name to display/storage format:
 * Capitalizes the first letter of each whitespace/hyphen-separated token,
 * lowercases the rest. Preserves Portuguese particles (de, da, do, dos, das, e) in lowercase.
 * Examples: "DANILO" -> "Danilo", "maria DA silva" -> "Maria da Silva".
 */
export function formatPersonName(value: string | null | undefined): string {
  if (!value) return '';
  const particles = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'di', 'du']);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((word, idx) => {
      const lower = word.toLocaleLowerCase('pt-BR');
      if (idx > 0 && particles.has(lower)) return lower;
      // Handle hyphenated parts (e.g., "Maria-Clara")
      return lower
        .split('-')
        .map((part) =>
          part.length === 0
            ? part
            : part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1),
        )
        .join('-');
    })
    .join(' ');
}


export function extractEmail(value: ContactValue): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    // Prefer the item marked as primary
    const primary = value.find((v: any) => v && typeof v === 'object' && v.is_primary);
    const first = primary || value.find(Boolean);
    return extractEmail(first as any);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate = obj.email ?? obj.value ?? obj.address;
    return typeof candidate === 'string' ? candidate : null;
  }

  return null;
}

export function extractPhone(value: ContactValue): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    // Prefer the item marked as primary
    const primary = value.find((v: any) => v && typeof v === 'object' && v.is_primary);
    const first = primary || value.find(Boolean);
    return extractPhone(first as any);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Support multiple key variations including 'numero' from DFS-style JSONB
    const candidate = obj.numero ?? obj.phone ?? obj.value ?? obj.number;
    return typeof candidate === 'string' ? candidate : null;
  }

  return null;
}

export function truncateEmailDisplay(value: ContactValue): string | null {
  const email = extractEmail(value);
  if (!email) return null;
  if (email.length <= 18) return email;
  const [local, domain] = email.split('@');
  if (!domain) return email.slice(0, 15) + '...';
  const truncatedLocal = local.length > 8 ? local.slice(0, 6) + '..' : local;
  return `${truncatedLocal}@${domain}`;
}

export function formatPhoneDisplay(value: ContactValue): string | null {
  const phone = extractPhone(value);
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
