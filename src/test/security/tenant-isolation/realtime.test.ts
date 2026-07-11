/**
 * Fase 2.5 — Realtime cross-org
 * ORG_B subscriber não pode receber events de mudanças em opportunities da ORG_A.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

runDesc('Fase 2.5 — Realtime cross-org isolation', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it('opportunities INSERT in ORG_A does not reach ORG_B subscriber', async () => {
    const salesB = f.orgB.users.sales.client;
    const received: any[] = [];

    const channel = salesB
      .channel(`iso-${f.runId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'opportunities' }, (p) => {
        received.push(p);
      })
      .subscribe();
    await new Promise((r) => setTimeout(r, 1500));

    const { data: opp } = await f.admin
      .from('opportunities')
      .insert({
        organization_id: f.orgA.id,
        title: 'ISO REALTIME TEST',
        status: 'draft',
      } as any)
      .select('id')
      .single();

    await new Promise((r) => setTimeout(r, 2500));
    await salesB.removeChannel(channel);

    // Nenhum evento recebido com organization_id de ORG_A
    for (const e of received) {
      expect(e?.new?.organization_id).not.toBe(f.orgA.id);
    }

    if (opp?.id) await f.admin.from('opportunities').delete().eq('id', opp.id);
  }, 30_000);
});
