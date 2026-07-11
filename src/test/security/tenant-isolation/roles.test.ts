/**
 * Fase 2.2 — Matriz de roles dentro da mesma organização
 * Valida que cada papel tem exatamente a visibilidade prevista no ADR-002.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, ROLES, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

runDesc('Fase 2.2 — Role visibility matrix', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it.each(ROLES)('role %s: can_view_all returns expected boolean', async (role) => {
    const client = f.orgA.users[role].client;
    const { data, error } = await client.rpc('can_view_all', { p_user_id: f.orgA.users[role].id });
    expect(error).toBeNull();
    const expected = role === 'owner' || role === 'admin' || role === 'manager';
    expect(!!data).toBe(expected);
  });

  it.each(['sales', 'viewer', 'cs'] as const)(
    'role %s: cannot escalate own role via user_roles UPDATE',
    async (role) => {
      const client = f.orgA.users[role].client;
      const { error } = await client
        .from('organization_members')
        .update({ org_role: 'admin' } as any)
        .eq('user_id', f.orgA.users[role].id);
      // Either RLS blocks (error) or 0 rows updated
      const { data: after } = await f.admin
        .from('organization_members')
        .select('org_role')
        .eq('user_id', f.orgA.users[role].id)
        .single();
      expect(after?.org_role).toBe(role);
      // presence of error also acceptable
      if (error) expect(error.message).toBeDefined();
    },
  );

  it('admin of ORG_A cannot mutate organization_members of ORG_B', async () => {
    const adminA = f.orgA.users.admin.client;
    const { data: bMember } = await f.admin
      .from('organization_members')
      .select('id, org_role')
      .eq('organization_id', f.orgB.id)
      .eq('org_role', 'sales')
      .single();
    if (!bMember) return;

    await adminA
      .from('organization_members')
      .update({ org_role: 'admin' } as any)
      .eq('id', bMember.id);

    const { data: after } = await f.admin
      .from('organization_members')
      .select('org_role')
      .eq('id', bMember.id)
      .single();
    expect(after?.org_role).toBe(bMember.org_role);
  });
});
