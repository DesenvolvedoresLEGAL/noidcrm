// NSEC-1.2-CHG-027 — Final residual smoke (activities + proposals + storage)
// TEMPORARY. Delete after CHG-027.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-nsec12-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ORG_A = 'e1c4881f-0cd4-45fb-bc50-48314ce7bca0';
const ORG_B = 'bea090a6-4c6c-45b1-92e0-83678c687578';
const OWNER_A = '58c9eb37-4ae3-4612-bbfd-e873f49b329b';
const OWNER_B = '4ac56488-9128-4ff4-b236-56e1e06e9526';
const OPP_A = 'b86abbed-d591-4add-8442-609f2db6e195';
const OPP_B = '750e4dc4-09c0-44ca-abe5-f4a9726e3837';
const OWNER_A_EMAIL = 'sec-test-a-owner@example.com';
const OWNER_B_EMAIL = 'sec-test-b-owner@example.com';
const BUCKET = 'opportunity-files';

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function issueToken(admin: any, url: string, anonKey: string, email: string): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u: any) => u.email === email);
  if (!found) throw new Error(`user not found: ${email}`);
  const password = 'SEC_TEST_' + crypto.randomUUID();
  const { error: uErr } = await admin.auth.admin.updateUserById(found.id, { password });
  if (uErr) throw new Error(`pw reset failed: ${uErr.message}`);
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  const tok = await r.json();
  if (!r.ok) throw new Error(`signin failed ${email}: ${JSON.stringify(tok)}`);
  return tok.access_token as string;
}

async function callRpc(url: string, anonKey: string, jwt: string, fn: string, args: any) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { http: r.status, body: parsed };
}

async function storageWrite(url: string, anonKey: string, jwt: string, path: string, body: string) {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'text/plain',
      'x-upsert': 'false',
    },
    body,
  });
  const text = await r.text();
  return { http: r.status, body: text };
}

async function storageRead(url: string, anonKey: string, jwt: string, path: string) {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  const text = await r.text();
  return { http: r.status, body: text };
}

async function storageDelete(url: string, anonKey: string, jwt: string, path: string) {
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  const text = await r.text();
  return { http: r.status, body: text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = req.headers.get('x-nsec12-token');
  const expected = Deno.env.get('NSEC12_TOKEN2');
  if (!expected || token !== expected) return j({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL')!;
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  const results: any[] = [];
  const record = (probe: string, expectedCode: string, out: any) => {
    const code = typeof out.body === 'string' ? out.body : (out.body?.message || JSON.stringify(out.body));
    results.push({ probe, expected: expectedCode, http: out.http, code, pass: null });
  };

  try {
    const jwtA = await issueToken(admin, url, anonKey, OWNER_A_EMAIL);
    const jwtB = await issueToken(admin, url, anonKey, OWNER_B_EMAIL);

    // ---------------- ACTIVITIES ----------------
    const actArgs = (org: string, opp: string, tag: string) => ({
      p_organization_id: org, p_opportunity_id: opp,
      p_marker: `SECURITY_TEST_ACTIVITY_CHG027_${tag}`,
    });
    record('A1', 'ALLOWED_ROLLED_BACK',
      await callRpc(url, anonKey, jwtA, 'nsec12_probe_activity_insert_smoke', actArgs(ORG_A, OPP_A, 'A1')));
    record('A2', 'ALLOWED_ROLLED_BACK',
      await callRpc(url, anonKey, jwtB, 'nsec12_probe_activity_insert_smoke', actArgs(ORG_B, OPP_B, 'A2')));
    record('A3', 'BLOCKED',
      await callRpc(url, anonKey, jwtA, 'nsec12_probe_activity_insert_smoke', actArgs(ORG_A, OPP_B, 'A3')));
    record('A4', 'BLOCKED',
      await callRpc(url, anonKey, jwtB, 'nsec12_probe_activity_insert_smoke', actArgs(ORG_B, OPP_A, 'A4')));

    // ---------------- PROPOSALS ----------------
    const propArgs = (org: string, opp: string, tag: string) => ({
      p_organization_id: org, p_opportunity_id: opp,
      p_marker: `SECURITY_TEST_PROPOSAL_CHG027_${tag}`,
    });
    record('P1', 'ALLOWED_ROLLED_BACK',
      await callRpc(url, anonKey, jwtA, 'nsec12_probe_proposal_insert_smoke', propArgs(ORG_A, OPP_A, 'P1')));
    record('P2', 'ALLOWED_ROLLED_BACK',
      await callRpc(url, anonKey, jwtB, 'nsec12_probe_proposal_insert_smoke', propArgs(ORG_B, OPP_B, 'P2')));
    record('P3', 'BLOCKED',
      await callRpc(url, anonKey, jwtA, 'nsec12_probe_proposal_insert_smoke', propArgs(ORG_A, OPP_B, 'P3')));
    record('P4', 'BLOCKED',
      await callRpc(url, anonKey, jwtB, 'nsec12_probe_proposal_insert_smoke', propArgs(ORG_B, OPP_A, 'P4')));

    // ---------------- STORAGE ----------------
    const content = 'SECURITY_TEST_STORAGE_CHG027';
    const pathA = `${ORG_A}/SECURITY_TEST_STORAGE_CHG027_A.txt`;
    const pathB = `${ORG_B}/SECURITY_TEST_STORAGE_CHG027_B.txt`;

    // S1: Owner A own-tenant full round trip
    const s1w = await storageWrite(url, anonKey, jwtA, pathA, content);
    const s1r = await storageRead(url, anonKey, jwtA, pathA);
    const s1d = await storageDelete(url, anonKey, jwtA, pathA);
    const s1r2 = await storageRead(url, anonKey, jwtA, pathA);
    results.push({
      probe: 'S1', expected: 'ALLOWED_AND_CLEANED',
      http_write: s1w.http, http_read: s1r.http, http_delete: s1d.http, http_read_after: s1r2.http,
      body_read_after: s1r2.body,
    });

    // S2: Owner B own-tenant
    const s2w = await storageWrite(url, anonKey, jwtB, pathB, content);
    const s2r = await storageRead(url, anonKey, jwtB, pathB);
    const s2d = await storageDelete(url, anonKey, jwtB, pathB);
    const s2r2 = await storageRead(url, anonKey, jwtB, pathB);
    results.push({
      probe: 'S2', expected: 'ALLOWED_AND_CLEANED',
      http_write: s2w.http, http_read: s2r.http, http_delete: s2d.http, http_read_after: s2r2.http,
      body_read_after: s2r2.body,
    });

    // S3: Owner A tries to write in Org B path
    const s3 = await storageWrite(url, anonKey, jwtA, pathB, content);
    results.push({ probe: 'S3', expected: 'BLOCKED_RLS', http: s3.http, body: s3.body });

    // S4: Owner B tries to write in Org A path
    const s4 = await storageWrite(url, anonKey, jwtB, pathA, content);
    results.push({ probe: 'S4', expected: 'BLOCKED_RLS', http: s4.http, body: s4.body });

    // Defensive cleanup of any residual cross-tenant object created by S3/S4
    // (shouldn't exist if BLOCKED; safe if it does)
    await admin.storage.from(BUCKET).remove([pathA, pathB]);

    return j({ ok: true, results });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e), results }, 500);
  }
});
