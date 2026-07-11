/**
 * Fase 2.7 — Convite/troca de organização
 * User convidado para segunda org só vê dados dela quando trocar; nunca vaza dado
 * de A depois de trocar para B.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

runDesc('Fase 2.7 — Convite e troca de organização', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it('user pertencente a A e B lê apenas dados do org ativo', async () => {
    const dual = f.orgA.users.sales;
    // Adiciona o mesmo user_id como membro ativo de ORG_B
    await f.admin.from('organization_members').insert({
      organization_id: f.orgB.id,
      user_id: dual.id,
      org_role: 'sales',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

    // Se houver 2 memberships ativas, get_user_organization_id() retorna 1 delas.
    // O importante: sales só vê rows da org retornada e nunca da outra.
    const { data: activeOrg } = await dual.client.rpc('get_user_organization_id');
    expect([f.orgA.id, f.orgB.id]).toContain(activeOrg);

    const otherOrg = activeOrg === f.orgA.id ? f.orgB.id : f.orgA.id;

    // Cria um account em cada org e verifica que só o do org ativo aparece
    const { data: rowActive } = await f.admin
      .from('accounts')
      .insert({ organization_id: activeOrg, razao_social: 'ISO ACTIVE' } as any)
      .select('id')
      .maybeSingle();
    const { data: rowOther } = await f.admin
      .from('accounts')
      .insert({ organization_id: otherOrg, razao_social: 'ISO OTHER' } as any)
      .select('id')
      .maybeSingle();

    if (rowActive && rowOther) {
      const { data: visible } = await dual.client
        .from('accounts')
        .select('id, organization_id')
        .in('id', [rowActive.id, rowOther.id]);
      const orgs = new Set((visible ?? []).map((r: any) => r.organization_id));
      expect(orgs.has(otherOrg)).toBe(false);
      await f.admin.from('accounts').delete().in('id', [rowActive.id, rowOther.id]);
    }
  });
});
