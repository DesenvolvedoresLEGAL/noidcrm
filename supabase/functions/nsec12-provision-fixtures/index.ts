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

  const token = req.headers.get('x-nsec12-token');
  const expected = Deno.env.get('NSEC12_TOKEN2');
  if (!expected || token !== expected) return json({ error: 'forbidden' }, 403);

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;
  const orgsWanted: string[] = Array.isArray(body?.orgs) && body.orgs.length
    ? body.orgs.filter((o: string) => ORG_ALLOW.includes(o))
    : ORG_ALLOW;

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

        // membership
        await admin.from('organization_members').upsert({
          organization_id: orgId,
          user_id: userId,
          role: role,
          org_role: role,
          status: 'active',
          joined_at: new Date().toISOString(),
        } as any, { onConflict: 'organization_id,user_id' });

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
