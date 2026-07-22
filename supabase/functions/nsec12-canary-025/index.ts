// NSEC-1.2-CHG-026 — Reprobe final (18 probes): accounts UPDATE + contacts UPDATE + contacts DELETE.
// Guard: x-nsec12-token = NSEC12_TOKEN2. Uses fixed WRITE_TARGET UUIDs (no fixture creation).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-nsec12-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const ACCOUNT_A = '6562ba86-2be7-4c10-b4f7-4d4bd6df290f';
const ACCOUNT_B = '42b62d65-f495-4afc-8174-a5ae726c1ef3';
const CONTACT_A = '394a41dd-c78d-4ae0-9736-333bcc79761d';
const CONTACT_B = '994be611-df79-4c4f-a79b-ee97e6856b4e';

type Persona = 'owner-a'|'admin-a'|'viewer-a'|'owner-b'|'admin-b'|'viewer-b';
const EMAILS: Record<Persona,string> = {
  'owner-a':'sec-test-a-owner@example.com','admin-a':'sec-test-a-admin@example.com','viewer-a':'sec-test-a-viewer@example.com',
  'owner-b':'sec-test-b-owner@example.com','admin-b':'sec-test-b-admin@example.com','viewer-b':'sec-test-b-viewer@example.com',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.headers.get('x-nsec12-token') !== Deno.env.get('NSEC12_TOKEN2')) return json({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  // 1) Mint JWTs for 6 personas
  const tokens: Partial<Record<Persona,string>> = {};
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const [p, email] of Object.entries(EMAILS) as [Persona,string][]) {
    const u = list?.users?.find((x) => x.email === email);
    if (!u) return json({ error: 'user not found', email }, 500);
    const pwd = 'SEC_TEST_' + crypto.randomUUID();
    const { error } = await admin.auth.admin.updateUserById(u.id, { password: pwd });
    if (error) return json({ error: 'pwd', email, detail: error.message }, 500);
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon },
      body: JSON.stringify({ email, password: pwd }),
    });
    const t = await r.json();
    if (!r.ok) return json({ error: 'signin', email, detail: t }, 500);
    tokens[p] = t.access_token;
  }

  // 2) Run 18 probes (no fixture creation)
  const rpc = async (jwt: string, fn: string, args: Record<string, unknown>) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  };

  const marker = (label: string) => `SECURITY_TEST_WRITE_CANARY_CHG025_CHG026_${label}`;

  type Probe = { table: string; op: 'update'|'delete'; probe: string; persona: Persona; target: string; expected: string };
  const probes: Probe[] = [
    // BLOCO 1 — ACCOUNTS UPDATE
    { table:'accounts', op:'update', probe:'A-U1', persona:'owner-a',  target: ACCOUNT_A, expected:'ALLOWED_ROLLED_BACK' },
    { table:'accounts', op:'update', probe:'A-U2', persona:'owner-b',  target: ACCOUNT_B, expected:'ALLOWED_ROLLED_BACK' },
    { table:'accounts', op:'update', probe:'A-U3', persona:'viewer-a', target: ACCOUNT_A, expected:'BLOCKED' },
    { table:'accounts', op:'update', probe:'A-U4', persona:'viewer-b', target: ACCOUNT_B, expected:'BLOCKED' },
    { table:'accounts', op:'update', probe:'A-U5', persona:'owner-a',  target: ACCOUNT_B, expected:'BLOCKED' },
    { table:'accounts', op:'update', probe:'A-U6', persona:'owner-b',  target: ACCOUNT_A, expected:'BLOCKED' },
    // BLOCO 2 — CONTACTS UPDATE
    { table:'contacts', op:'update', probe:'C-U1', persona:'owner-a',  target: CONTACT_A, expected:'ALLOWED_ROLLED_BACK' },
    { table:'contacts', op:'update', probe:'C-U2', persona:'owner-b',  target: CONTACT_B, expected:'ALLOWED_ROLLED_BACK' },
    { table:'contacts', op:'update', probe:'C-U3', persona:'viewer-a', target: CONTACT_A, expected:'BLOCKED' },
    { table:'contacts', op:'update', probe:'C-U4', persona:'viewer-b', target: CONTACT_B, expected:'BLOCKED' },
    { table:'contacts', op:'update', probe:'C-U5', persona:'owner-a',  target: CONTACT_B, expected:'BLOCKED' },
    { table:'contacts', op:'update', probe:'C-U6', persona:'owner-b',  target: CONTACT_A, expected:'BLOCKED' },
    // BLOCO 3 — CONTACTS DELETE
    { table:'contacts', op:'delete', probe:'C-D1', persona:'admin-a',  target: CONTACT_A, expected:'ALLOWED_ROLLED_BACK' },
    { table:'contacts', op:'delete', probe:'C-D2', persona:'admin-b',  target: CONTACT_B, expected:'ALLOWED_ROLLED_BACK' },
    { table:'contacts', op:'delete', probe:'C-D3', persona:'viewer-a', target: CONTACT_A, expected:'BLOCKED' },
    { table:'contacts', op:'delete', probe:'C-D4', persona:'viewer-b', target: CONTACT_B, expected:'BLOCKED' },
    { table:'contacts', op:'delete', probe:'C-D5', persona:'admin-a',  target: CONTACT_B, expected:'BLOCKED' },
    { table:'contacts', op:'delete', probe:'C-D6', persona:'admin-b',  target: CONTACT_A, expected:'BLOCKED' },
  ];

  const fnMap: Record<string,string> = {
    accounts: 'nsec12_probe_account_write',
    contacts: 'nsec12_probe_contact_write',
  };

  const results: any[] = [];
  for (const p of probes) {
    const m = marker(`${p.table}_${p.probe}`);
    const { status, body } = await rpc(tokens[p.persona]!, fnMap[p.table], {
      p_target_id: p.target, p_operation: p.op, p_marker: m,
    });
    const code = typeof body === 'string' ? body : (body?.code ?? body?.message ?? JSON.stringify(body));
    const pass = p.expected === 'ALLOWED_ROLLED_BACK'
      ? code === 'ALLOWED_ROLLED_BACK'
      : (code === 'BLOCKED_RLS' || code === 'BLOCKED_NO_VISIBLE_ROW' || code === 'BLOCKED_CHECK' || code === 'BLOCKED_CONSTRAINT');
    results.push({ ...p, http: status, code, pass });
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
  };
  return json({ summary, results });
});
