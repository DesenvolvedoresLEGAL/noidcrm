// NSEC-1.2-CHG-025 — Critical UPDATE/DELETE canary (temporary, delete after sprint).
// Guard: x-nsec12-token = NSEC12_TOKEN2. Creates 6 dedicated fixtures, then runs 36 probes.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-nsec12-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

const ORG_A = 'e1c4881f-0cd4-45fb-bc50-48314ce7bca0';
const ORG_B = 'bea090a6-4c6c-45b1-92e0-83678c687578';
const PIPE_A = 'd1f1c882-6769-49d6-a9ca-9de75aeb30f5';
const STAGE_A = '18208f58-29b3-4e34-99bb-613751659bc7';
const PIPE_B = '0526054f-d41d-485c-b669-6f6235b6f992';
const STAGE_B = '7efae798-823e-4521-a9bc-959ba1551e48';

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

  const rest = async (jwt: string, path: string, init: RequestInit = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  };

  // 2) Ensure 6 fixtures exist (idempotent)
  const acc = {
    A: 'SECURITY_TEST_ACCOUNT_ORG_A_WRITE_TARGET',
    B: 'SECURITY_TEST_ACCOUNT_ORG_B_WRITE_TARGET',
  };
  const con = {
    A: 'SECURITY_TEST_CONTACT_ORG_A_WRITE_TARGET',
    B: 'SECURITY_TEST_CONTACT_ORG_B_WRITE_TARGET',
  };
  const opp = {
    A: 'SECURITY_TEST_OPPORTUNITY_ORG_A_WRITE_TARGET',
    B: 'SECURITY_TEST_OPPORTUNITY_ORG_B_WRITE_TARGET',
  };

  const findOrCreateAccount = async (jwt: string, orgId: string, name: string) => {
    const q = await rest(jwt, `accounts?razao_social=eq.${encodeURIComponent(name)}&deleted_at=is.null&select=id`);
    if (Array.isArray(q.body) && q.body.length) return q.body[0].id;
    const c = await rest(jwt, 'accounts', {
      method: 'POST',
      body: JSON.stringify({ razao_social: name, nome_fantasia: name, organization_id: orgId }),
    });
    if (c.status >= 300) throw new Error(`account create ${name}: ${c.status} ${JSON.stringify(c.body)}`);
    return Array.isArray(c.body) ? c.body[0].id : c.body.id;
  };
  const findOrCreateContact = async (jwt: string, orgId: string, name: string) => {
    const q = await rest(jwt, `contacts?nome=eq.${encodeURIComponent(name)}&deleted_at=is.null&select=id`);
    if (Array.isArray(q.body) && q.body.length) return q.body[0].id;
    const c = await rest(jwt, 'contacts', {
      method: 'POST',
      body: JSON.stringify({ nome: name, primeiro_nome: name, organization_id: orgId }),
    });
    if (c.status >= 300) throw new Error(`contact create ${name}: ${c.status} ${JSON.stringify(c.body)}`);
    return Array.isArray(c.body) ? c.body[0].id : c.body.id;
  };
  const findOrCreateOpp = async (jwt: string, orgId: string, pipeId: string, stageId: string, ownerId: string, name: string) => {
    const q = await rest(jwt, `opportunities?title=eq.${encodeURIComponent(name)}&deleted_at=is.null&select=id`);
    if (Array.isArray(q.body) && q.body.length) return q.body[0].id;
    const c = await rest(jwt, 'opportunities', {
      method: 'POST',
      body: JSON.stringify({
        title: name, organization_id: orgId, pipeline_id: pipeId, stage_id: stageId,
        owner_user_id: ownerId, status: 'new', automation_enabled: false,
      }),
    });
    if (c.status >= 300) throw new Error(`opp create ${name}: ${c.status} ${JSON.stringify(c.body)}`);
    return Array.isArray(c.body) ? c.body[0].id : c.body.id;
  };

  const ownerAId = list!.users.find((u) => u.email === EMAILS['owner-a'])!.id;
  const ownerBId = list!.users.find((u) => u.email === EMAILS['owner-b'])!.id;

  let fixtures: any;
  try {
    fixtures = {
      account_a: await findOrCreateAccount(tokens['owner-a']!, ORG_A, acc.A),
      account_b: await findOrCreateAccount(tokens['owner-b']!, ORG_B, acc.B),
      contact_a: await findOrCreateContact(tokens['owner-a']!, ORG_A, con.A),
      contact_b: await findOrCreateContact(tokens['owner-b']!, ORG_B, con.B),
      opp_a: await findOrCreateOpp(tokens['owner-a']!, ORG_A, PIPE_A, STAGE_A, ownerAId, opp.A),
      opp_b: await findOrCreateOpp(tokens['owner-b']!, ORG_B, PIPE_B, STAGE_B, ownerBId, opp.B),
    };
  } catch (e) {
    return json({ error: 'fixture setup failed', detail: (e as Error).message }, 500);
  }

  // 3) Run 36 probes
  const rpc = async (jwt: string, fn: string, args: Record<string, unknown>) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  };

  const marker = (label: string) => `SECURITY_TEST_WRITE_CANARY_CHG025_${label}`;

  type Probe = { table: string; op: 'update'|'delete'; probe: string; persona: Persona; target: string; expected: string };
  const targetMap: Record<string, { fn: string; a: string; b: string }> = {
    accounts:      { fn: 'nsec12_probe_account_write',     a: fixtures.account_a, b: fixtures.account_b },
    contacts:      { fn: 'nsec12_probe_contact_write',     a: fixtures.contact_a, b: fixtures.contact_b },
    opportunities: { fn: 'nsec12_probe_opportunity_write', a: fixtures.opp_a,     b: fixtures.opp_b },
  };
  const scenarios = (): Probe[] => {
    const out: Probe[] = [];
    for (const tbl of Object.keys(targetMap)) {
      const t = targetMap[tbl];
      // UPDATE
      out.push({ table: tbl, op: 'update', probe: 'U1', persona: 'owner-a',  target: t.a, expected: 'ALLOWED_ROLLED_BACK' });
      out.push({ table: tbl, op: 'update', probe: 'U2', persona: 'owner-b',  target: t.b, expected: 'ALLOWED_ROLLED_BACK' });
      out.push({ table: tbl, op: 'update', probe: 'U3', persona: 'viewer-a', target: t.a, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'update', probe: 'U4', persona: 'viewer-b', target: t.b, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'update', probe: 'U5', persona: 'owner-a',  target: t.b, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'update', probe: 'U6', persona: 'owner-b',  target: t.a, expected: 'BLOCKED' });
      // DELETE
      out.push({ table: tbl, op: 'delete', probe: 'D1', persona: 'admin-a',  target: t.a, expected: 'ALLOWED_ROLLED_BACK' });
      out.push({ table: tbl, op: 'delete', probe: 'D2', persona: 'admin-b',  target: t.b, expected: 'ALLOWED_ROLLED_BACK' });
      out.push({ table: tbl, op: 'delete', probe: 'D3', persona: 'viewer-a', target: t.a, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'delete', probe: 'D4', persona: 'viewer-b', target: t.b, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'delete', probe: 'D5', persona: 'admin-a',  target: t.b, expected: 'BLOCKED' });
      out.push({ table: tbl, op: 'delete', probe: 'D6', persona: 'admin-b',  target: t.a, expected: 'BLOCKED' });
    }
    return out;
  };

  const results: any[] = [];
  for (const p of scenarios()) {
    const fn = targetMap[p.table].fn;
    const m = marker(`${p.table}_${p.probe}`);
    const { status, body } = await rpc(tokens[p.persona]!, fn, {
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
    by_table: {
      accounts: { pass: results.filter((r) => r.table==='accounts' && r.pass).length, fail: results.filter((r) => r.table==='accounts' && !r.pass).length },
      contacts: { pass: results.filter((r) => r.table==='contacts' && r.pass).length, fail: results.filter((r) => r.table==='contacts' && !r.pass).length },
      opportunities: { pass: results.filter((r) => r.table==='opportunities' && r.pass).length, fail: results.filter((r) => r.table==='opportunities' && !r.pass).length },
    },
  };

  return json({ fixtures, summary, results });
});
