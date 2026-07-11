/**
 * Fase 2.3 — RPCs e Edge Functions
 * Tenta invocar RPCs privilegiadas com IDs de ORG_B autenticado como ORG_A.
 * Nenhuma RPC pode devolver dados cross-org, mesmo que o input seja forjado.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

runDesc('Fase 2.3 — RPC cross-org resistance', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it('get_user_organization_id() returns own org, never other org', async () => {
    const salesA = f.orgA.users.sales.client;
    const { data, error } = await salesA.rpc('get_user_organization_id');
    expect(error).toBeNull();
    expect(data).toBe(f.orgA.id);
  });

  it('RPCs that accept p_organization_id must reject foreign org id', async () => {
    const salesA = f.orgA.users.sales.client;
    // Pick a set of RPCs known to accept p_organization_id
    const rpcs: Array<{ name: string; args: Record<string, any> }> = [
      { name: 'calculate_forecast_accuracy_v2', args: { p_organization_id: f.orgB.id, p_pipeline_id: null, p_period_start: null, p_period_end: null, p_seller_id: null } },
      { name: 'get_forecast_snapshots_v2', args: { p_organization_id: f.orgB.id } },
      { name: 'get_forecast_v2_health_check', args: { p_organization_id: f.orgB.id } },
      { name: 'get_org_seat_metrics', args: { p_organization_id: f.orgB.id } },
    ];

    for (const r of rpcs) {
      const { data, error } = await (salesA.rpc as any)(r.name, r.args);
      // Aceitável: erro OU dados vazios / não pertencentes ao ORG_B
      if (error) {
        expect(error.message).toBeDefined();
      } else if (Array.isArray(data)) {
        for (const row of data) {
          if (row && typeof row === 'object' && 'organization_id' in row) {
            expect(row.organization_id).not.toBe(f.orgB.id);
          }
        }
      }
    }
  });

  it('anon cannot call authenticated-only RPCs', async () => {
    const { error } = await f.anon.rpc('get_user_organization_id');
    expect(error).not.toBeNull();
  });
});
