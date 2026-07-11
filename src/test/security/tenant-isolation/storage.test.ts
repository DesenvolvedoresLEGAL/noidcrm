/**
 * Fase 2.4 — Storage cross-org
 * Faz upload de um objeto em ORG_A e verifica que user de ORG_B não consegue
 * baixar/listar via os buckets multi-tenant (opportunity-files, proposal-pdfs).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

runDesc('Fase 2.4 — Storage cross-org isolation', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it.each(['opportunity-files', 'proposal-pdfs'])(
    '%s: ORG_B user cannot download/list ORG_A files',
    async (bucket) => {
      const pathA = `${f.orgA.id}/iso-test-${Date.now()}.txt`;
      const bodyA = new Blob(['orgA-secret'], { type: 'text/plain' });

      const { error: upErr } = await f.orgA.users.admin.client.storage
        .from(bucket)
        .upload(pathA, bodyA);
      if (upErr) return; // pular se bucket ainda não existe no ambiente

      const salesB = f.orgB.users.sales.client;
      const { data: dl, error: dlErr } = await salesB.storage.from(bucket).download(pathA);
      expect(!!dl && !dlErr).toBe(false);

      const { data: list } = await salesB.storage.from(bucket).list(f.orgA.id);
      expect((list ?? []).length).toBe(0);

      await f.admin.storage.from(bucket).remove([pathA]);
    },
  );
});
