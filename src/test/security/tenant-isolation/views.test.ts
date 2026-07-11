/**
 * Fase 2.6 — Views/Reports V2 cross-org
 * As views que agregam receita/pipeline não podem trazer linhas de ORG_B
 * quando consultadas como ORG_A. Cobre a correção do bloqueador da Fase 1.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fixtureEnabled, setupFixture, teardownFixture, type Fixture } from './fixture';

const runDesc = fixtureEnabled() ? describe : describe.skip;

const VIEWS = [
  'commercial_won_revenue_view',
  'commercial_won_revenue_historical_view',
  'commission_eligibility_view',
  'unified_timeline',
  'v_opportunity_accepted_proposal_v2',
  'v_proposals_normalized_v2',
  'v_unified_won_revenue_v2',
  'kairos_apollo_performance_summary',
  'kairos_gtm_performance_summary',
  'kairos_revenue_attribution_summary',
];

runDesc('Fase 2.6 — Views/Reports cross-org', () => {
  let f: Fixture;
  beforeAll(async () => { f = await setupFixture(); }, 120_000);
  afterAll(async () => { if (f) await teardownFixture(f); }, 60_000);

  it.each(VIEWS)('%s: ORG_A never returns rows with organization_id = ORG_B', async (view) => {
    const salesA = f.orgA.users.sales.client;
    const { data } = await salesA
      .from(view as any)
      .select('organization_id')
      .eq('organization_id', f.orgB.id)
      .limit(1);
    expect(data ?? []).toHaveLength(0);
  });
});
