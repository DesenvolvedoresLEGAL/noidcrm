/**
 * Fase 2 — Suíte de Isolamento Multi-Tenant
 * ==========================================
 * Fixture: cria 2 organizações isoladas com 6 usuários cada (12 no total)
 * em um ambiente Supabase de TESTE/STAGING, executa asserts de isolamento,
 * e destrói tudo no afterAll.
 *
 * NUNCA rode contra produção. A suíte se auto-desliga se as variáveis
 * TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY e TEST_SUPABASE_ANON_KEY
 * não estiverem definidas, ou se TEST_SUPABASE_URL apontar para o mesmo host
 * de VITE_SUPABASE_URL (guarda anti-produção).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type OrgRole = 'owner' | 'admin' | 'manager' | 'sales' | 'viewer' | 'cs';

export const ROLES: OrgRole[] = ['owner', 'admin', 'manager', 'sales', 'viewer', 'cs'];

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: OrgRole;
  orgId: string;
  jwt: string;
  client: SupabaseClient;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
  users: Record<OrgRole, TestUser>;
}

export interface Fixture {
  admin: SupabaseClient;
  anon: SupabaseClient;
  orgA: TestOrg;
  orgB: TestOrg;
  runId: string;
}

const SUFFIX = () =>
  `iso-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function fixtureEnabled(): boolean {
  const url = process.env.TEST_SUPABASE_URL;
  const svc = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.TEST_SUPABASE_ANON_KEY;
  const prodUrl = process.env.VITE_SUPABASE_URL;

  if (!url || !svc || !anon) return false;
  // Guarda anti-produção: se o host de teste coincide com o de produção, aborta.
  try {
    if (prodUrl && new URL(url).host === new URL(prodUrl).host) {
      // eslint-disable-next-line no-console
      console.error(
        '[tenant-isolation] TEST_SUPABASE_URL coincide com VITE_SUPABASE_URL — abortando por segurança.',
      );
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

async function createOrg(admin: SupabaseClient, runId: string, tag: 'A' | 'B'): Promise<TestOrg> {
  const slug = `iso-${runId}-${tag.toLowerCase()}`;
  const { data: org, error } = await admin
    .from('organizations')
    .insert({ name: `Isolation Test ${tag}`, slug, status: 'active' })
    .select('id, name, slug')
    .single();
  if (error) throw new Error(`org ${tag} insert failed: ${error.message}`);

  const users = {} as Record<OrgRole, TestUser>;
  for (const role of ROLES) {
    const email = `iso-${runId}-${tag}-${role}@example.test`;
    const password = `Iso!${runId}-${tag}-${role}-secret`;
    const { data: created, error: uerr } =
      await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (uerr || !created.user) throw new Error(`create user failed ${email}: ${uerr?.message}`);

    const { error: memErr } = await admin.from('organization_members').insert({
      organization_id: org.id,
      user_id: created.user.id,
      org_role: role,
      status: 'active',
      joined_at: new Date().toISOString(),
    });
    if (memErr) throw new Error(`member ${role} failed: ${memErr.message}`);

    // Login para pegar JWT
    const anonClient = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_ANON_KEY!,
    );
    const { data: session, error: sErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (sErr || !session.session) throw new Error(`signin ${email}: ${sErr?.message}`);

    users[role] = {
      id: created.user.id,
      email,
      password,
      role,
      orgId: org.id,
      jwt: session.session.access_token,
      client: anonClient,
    };
  }

  return { id: org.id, name: org.name, slug: org.slug, users };
}

export async function setupFixture(): Promise<Fixture> {
  const url = process.env.TEST_SUPABASE_URL!;
  const svc = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY!;

  const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = SUFFIX();
  const orgA = await createOrg(admin, runId, 'A');
  const orgB = await createOrg(admin, runId, 'B');
  return { admin, anon, orgA, orgB, runId };
}

export async function teardownFixture(f: Fixture) {
  const allUsers = [
    ...Object.values(f.orgA.users),
    ...Object.values(f.orgB.users),
  ];
  // Delete auth users (cascades via triggers ideally; membership cleanup below as safety)
  await f.admin.from('organization_members').delete().in(
    'user_id',
    allUsers.map((u) => u.id),
  );
  for (const u of allUsers) {
    try {
      await f.admin.auth.admin.deleteUser(u.id);
    } catch {
      /* ignore */
    }
  }
  await f.admin.from('organizations').delete().in('id', [f.orgA.id, f.orgB.id]);
}
