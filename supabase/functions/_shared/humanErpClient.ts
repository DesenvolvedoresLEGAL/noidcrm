// PRICE 1.2 — Human ERP adapter (pluggable, mock-fallback when secrets missing).
// Único ponto de saída para o ERP/banco. Toda chamada de cobrança/baixa passa
// por aqui para garantir um único lugar a evoluir quando o endpoint real chegar.

export type ErpChargeInput = {
  proposal_id: string;
  payment_intent_id: string;
  organization_id: string;
  amount: number;                      // SEMPRE pricing_erp_amount (ou approved_amount se aprovada)
  currency: string;
  payment_method: string;              // 'pix' | 'boleto' | ...
  due_date?: string | null;
  pricing_breakdown_snapshot: unknown; // ledger
  approval_snapshot?: unknown | null;  // se aprovada
  customer?: {
    name?: string | null;
    document?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export type ErpProvider = 'human_erp' | 'pending_provider';

export type ErpChargeResult = {
  ok: boolean;
  provider: ErpProvider;
  /** true quando os secrets do Human ERP não estão configurados — sem Pix, sem chamada externa */
  pending_provider?: boolean;
  erp_charge_id?: string;
  erp_invoice_id?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  due_date?: string | null;
  status?: string;
  raw_request?: unknown;
  raw_response?: unknown;
  http_status?: number;
  error_code?: string;
  error_message?: string;
  latency_ms?: number;
};

function normalizeBaseUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/[\r\n\t]/g, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

function normalizeKey(raw: string | null | undefined): string {
  if (!raw) return '';
  let v = raw.trim();
  if (v.toLowerCase().startsWith('bearer ')) v = v.slice(7).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/[\r\n\t]/g, '').trim();
}

export function isHumanErpConfigured(): boolean {
  const base = normalizeBaseUrl(Deno.env.get('HUMAN_ERP_BASE_URL'));
  const key = normalizeKey(Deno.env.get('HUMAN_ERP_API_KEY'));
  return Boolean(base && key);
}

export async function createErpCharge(input: ErpChargeInput): Promise<ErpChargeResult> {
  const start = Date.now();
  const base = normalizeBaseUrl(Deno.env.get('HUMAN_ERP_BASE_URL'));
  const key = normalizeKey(Deno.env.get('HUMAN_ERP_API_KEY'));

  // Payload canônico — usa SOMENTE valores do Ledger. Não envia subtotal/total bruto.
  const payload = {
    external_id: input.payment_intent_id,
    proposal_id: input.proposal_id,
    organization_id: input.organization_id,
    amount: input.amount,
    currency: input.currency,
    payment_method: input.payment_method,
    due_date: input.due_date ?? null,
    customer: input.customer ?? null,
    pricing_breakdown_snapshot: input.pricing_breakdown_snapshot,
    approval_snapshot: input.approval_snapshot ?? null,
    metadata: input.metadata ?? {},
    source: 'noid_revenueos',
  };

  if (!base || !key) {
    // Sem provider configurado: NÃO chamamos endpoint externo, NÃO geramos Pix.
    // Devolvemos um resultado controlado para o caller registrar a cobrança como
    // pending_provider (status interno) e o payload financeiro completo.
    return {
      ok: true,
      provider: 'pending_provider',
      pending_provider: true,
      status: 'pending_provider',
      due_date: input.due_date ?? null,
      raw_request: payload,
      raw_response: { pending_provider: true, reason: 'HUMAN_ERP secrets not configured' },
      latency_ms: Date.now() - start,
    };
  }

  const url = `${base}/charges`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': key,
        'X-External-Id': input.payment_intent_id,
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    if (!resp.ok) {
      return {
        ok: false, provider: 'human_erp', http_status: resp.status,
        error_code: body?.code ?? `http_${resp.status}`,
        error_message: body?.message ?? body?.error ?? `Human ERP retornou ${resp.status}`,
        raw_request: payload, raw_response: body, latency_ms: Date.now() - start,
      };
    }
    return {
      ok: true, provider: 'human_erp', http_status: resp.status,
      erp_charge_id: body.charge_id ?? body.id,
      erp_invoice_id: body.invoice_id,
      pix_qr_code: body.pix?.qr_code ?? body.pix_qr_code,
      pix_copy_paste: body.pix?.copy_paste ?? body.pix_copy_paste,
      due_date: body.due_date ?? input.due_date ?? null,
      status: body.status ?? 'pending',
      raw_request: payload, raw_response: body, latency_ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      ok: false, provider: 'human_erp',
      error_code: 'network_error',
      error_message: e?.message ?? String(e),
      raw_request: payload, latency_ms: Date.now() - start,
    };
  }
}

export type ErpStatusResult = {
  ok: boolean;
  provider: ErpProvider;
  pending_provider?: boolean;
  status?: string;
  paid_amount?: number;
  paid_at?: string | null;
  payment_reference?: string | null;
  raw_response?: unknown;
  http_status?: number;
  error_code?: string;
  error_message?: string;
  latency_ms?: number;
};

export async function getErpChargeStatus(erpChargeId: string): Promise<ErpStatusResult> {
  const start = Date.now();
  const base = normalizeBaseUrl(Deno.env.get('HUMAN_ERP_BASE_URL'));
  const key = normalizeKey(Deno.env.get('HUMAN_ERP_API_KEY'));
  if (!base || !key) {
    // Sem provider: NUNCA simula baixa. Devolve pending_provider sem paid_amount.
    return {
      ok: true,
      provider: 'pending_provider',
      pending_provider: true,
      status: 'pending_provider',
      raw_response: { pending_provider: true, reason: 'HUMAN_ERP secrets not configured' },
      latency_ms: Date.now() - start,
    };
  }
  try {
    const resp = await fetch(`${base}/charges/${encodeURIComponent(erpChargeId)}`, {
      headers: { 'X-API-Key': key },
    });
    const text = await resp.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    if (!resp.ok) {
      return {
        ok: false, provider: 'human_erp', http_status: resp.status,
        error_code: body?.code ?? `http_${resp.status}`,
        error_message: body?.message ?? `Human ERP retornou ${resp.status}`,
        raw_response: body, latency_ms: Date.now() - start,
      };
    }
    return {
      ok: true, provider: 'human_erp', http_status: resp.status,
      status: body.status,
      paid_amount: body.paid_amount != null ? Number(body.paid_amount) : undefined,
      paid_at: body.paid_at ?? null,
      payment_reference: body.payment_reference ?? body.transaction_id ?? null,
      raw_response: body, latency_ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      ok: false, provider: 'human_erp',
      error_code: 'network_error',
      error_message: e?.message ?? String(e),
      latency_ms: Date.now() - start,
    };
  }
}

/** HMAC-SHA256 sobre o corpo bruto do webhook usando HUMAN_ERP_WEBHOOK_SECRET. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = normalizeKey(Deno.env.get('HUMAN_ERP_WEBHOOK_SECRET'));
  if (!secret) {
    // Sem secret configurado: aceita mas marca como mock (logs deixam claro).
    return true;
  }
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const clean = signature.replace(/^sha256=/i, '').toLowerCase().trim();
  // timing-safe compare
  if (hex.length !== clean.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ clean.charCodeAt(i);
  return diff === 0;
}
