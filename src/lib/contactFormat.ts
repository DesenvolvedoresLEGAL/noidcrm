// Helpers to safely display contact emails/phones that may come as string, object, or array

export type ContactValue =
  | string
  | null
  | undefined
  | Record<string, unknown>
  | Array<string | Record<string, unknown> | null | undefined>;

export function extractEmail(value: ContactValue): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    const first = value.find(Boolean);
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
    const first = value.find(Boolean);
    return extractPhone(first as any);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate = obj.phone ?? obj.value ?? obj.number;
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
