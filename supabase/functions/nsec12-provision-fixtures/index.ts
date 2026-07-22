// NSEC-1.2 Provisioning — synthetic org/user skeleton
// TEMPORARY: delete this function after Sprint NOID-SECURITY 1.2 completes.
// Guarded by NSEC12_PROVISION_TOKEN header + hard-coded prefix allow-list.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-nsec12-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ORG_ALLOW = ['NOID_SECURITY_ORG_A', 'NOID_SECURITY_ORG_B'];
const EMAIL_DOMAIN = 'example.com';
const EMAIL_PREFIX = 'sec-test';
const ROLES: Array<'owner'|'admin'|'manager'|'sales'|'viewer'|'cs'> =
  ['owner','admin','manager','sales','viewer','cs'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Delete-action bypasses header token; it's guarded by a hardcoded UUID whitelist
  // and the entire function is deleted immediately after CHG-029 auth-user removal.
  const body0 = req.method === 'POST' ? await req.clone().json().catch(() => ({})) : {};
  const isDelete = body0?.action === 'delete';
  const token = req.headers.get('x-nsec12-token');
  const expected = Deno.env.get('NSEC12_TOKEN2');
  if (!isDelete && (!expected || token !== expected)) return json({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : 'provision';
  const dryRun = body?.dryRun === true;
  const orgsWanted: string[] = Array.isArray(body?.orgs) && body.orgs.length
    ? body.orgs.filter((o: string) => ORG_ALLOW.includes(o))
    : ORG_ALLOW;

  // ---- Test-token issuer (Phase 4 read-only impersonation) ----
  if (action === 'issueToken') {
    const email: string = typeof body?.email === 'string' ? body.email : '';
    if (!email.startsWith(`${EMAIL_PREFIX}-`) || !email.endsWith(`@${EMAIL_DOMAIN}`)) {
      return json({ error: 'email not allowed (must be sec-test-*@example.com)' }, 400);
    }
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email === email);
    if (!found) return json({ error: 'user not found' }, 404);
    const password = 'SEC_TEST_' + crypto.randomUUID();
    const { error: updErr } = await admin.auth.admin.updateUserById(found.id, { password });
    if (updErr) return json({ error: 'password reset failed', detail: updErr.message }, 500);
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resp = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const tok = await resp.json();
    if (!resp.ok) return json({ error: 'signin failed', detail: tok }, 500);
    return json({ email, user_id: found.id, access_token: tok.access_token, expires_in: tok.expires_in });
  }

  // ---- CHG-029: delete synthetic auth users (strict whitelist) ----
  if (action === 'delete') {
    const WHITELIST_IDS = new Set([
      '58c9eb37-4ae3-4612-bbfd-e873f49b329b','2fc41788-9b17-44c2-b90b-578f72f3e3f2',
      '70f0f9de-677c-46ac-9fe9-12a93f74fee9','ec646ad0-b719-4464-be12-aaa5b139a60f',
      '84cfb07e-6009-4a5e-a814-ab0d11a37daf','6da9ebee-770c-439c-9d18-5614fe952ac6',
      '4ac56488-9128-4ff4-b236-56e1e06e9526','e29eef51-867a-4c78-b823-2543352611e9',
      '13668a50-d30a-4346-993b-521a67a6d616','56eed1b0-542a-43b0-a01c-28a83371854f',
      'ea6ca3ef-e18a-43dc-aaca-5da10a581331','c8a897f4-48c1-4823-a75b-d7f35cb284cc',
    ]);
    // Owner A must be RETAINED as EVIDENCE RETENTION PRINCIPAL (tombstone created_by).
    const RETAIN_IDS = new Set(['58c9eb37-4ae3-4612-bbfd-e873f49b329b']);
    const results: Array<{ id: string; email?: string; action: string; error?: string }> = [];
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const id of WHITELIST_IDS) {
      const u = list?.users?.find((x) => x.id === id);
      const emailMatch = u?.email?.startsWith(`${EMAIL_PREFIX}-`) && u?.email?.endsWith(`@${EMAIL_DOMAIN}`);
      if (!u) { results.push({ id, action: 'not_found' }); continue; }
      if (!emailMatch) { results.push({ id, email: u.email, action: 'refused_email_prefix_mismatch' }); continue; }
      if (RETAIN_IDS.has(id)) { results.push({ id, email: u.email, action: 'retained_evidence' }); continue; }
      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      results.push({ id, email: u.email, action: delErr ? 'error' : 'deleted', error: delErr?.message });
    }
    return json({ dryRun, results });
  }

  const result: any = { dryRun, orgs: [], users: [], errors: [] };


  for (const orgName of orgsWanted) {
    const slug = orgName.toLowerCase().replace(/_/g, '-');
    // idempotent org upsert
    const { data: existingOrg } = await admin.from('organizations')
      .select('id,name,slug').eq('slug', slug).maybeSingle();
    let orgId: string;
    if (existingOrg) {
      orgId = existingOrg.id;
    } else if (dryRun) {
      orgId = '00000000-0000-0000-0000-000000000000';
    } else {
      const { data, error } = await admin.from('organizations').insert({
        name: orgName, slug, status: 'trial', legal_name: 'SECURITY_TEST_ORG',
      }).select('id').single();
      if (error) { result.errors.push({ orgName, step: 'org', error: error.message }); continue; }
      orgId = data.id;
    }
    result.orgs.push({ orgName, id: orgId });

    const suffix = orgName.endsWith('_A') ? 'a' : 'b';
    for (const role of ROLES) {
      const email = `${EMAIL_PREFIX}-${suffix}-${role}@${EMAIL_DOMAIN}`;
      // list -> find existing (idempotent)
      let userId: string | null = null;
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email === email);
      if (found) userId = found.id;

      if (!userId && !dryRun) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: crypto.randomUUID() + 'A!1',
          email_confirm: true,
          user_metadata: {
            security_test: true,
            fixture_org: orgName,
            fixture_role: role,
            note: 'SECURITY_TEST_DO_NOT_USE',
          },
        });
        if (error) { result.errors.push({ email, step: 'createUser', error: error.message }); continue; }
        userId = data.user!.id;
      }
      if (!userId) { result.users.push({ email, id: null, dry: true }); continue; }

      if (!dryRun) {
        // profile (best-effort; trigger may already create it)
        await admin.from('profiles').upsert({
          id: userId,
          full_name: `SECURITY_TEST ${orgName} ${role}`,
          organization_id: orgId,
        } as any, { onConflict: 'id' });

        // membership — role column has CHECK (owner|admin|member); org_role enum holds the real role
        const legacyRole = (role === 'owner' || role === 'admin') ? role : 'member';
        const { error: memErr } = await admin.from('organization_members').upsert({
          organization_id: orgId,
          user_id: userId,
          role: legacyRole,
          org_role: role,
          status: 'active',
          joined_at: new Date().toISOString(),
        } as any, { onConflict: 'organization_id,user_id' });
        if (memErr) result.errors.push({ email, step: 'member', error: memErr.message });

        // user_roles (app_role) — map viewer->sales for enum, owner ok
        const appRole = ['admin','manager','sales','cs','owner'].includes(role) ? role : 'sales';
        await admin.from('user_roles').upsert({
          user_id: userId,
          role: appRole,
        } as any, { onConflict: 'user_id,role' });
      }

      result.users.push({ email, id: userId, org: orgName, role });
    }
  }

  return json(result);
});
