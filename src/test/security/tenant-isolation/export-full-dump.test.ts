import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureEnabled,
  setupFixture,
  teardownFixture,
  type Fixture,
} from './fixture';

const describeIf = fixtureEnabled() ? describe : describe.skip;

describeIf('export-full-dump tenant isolation', () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await setupFixture();
  }, 120_000);

  afterAll(async () => {
    if (fixture) await teardownFixture(fixture);
  }, 120_000);

  async function callExport(jwt: string, body: Record<string, unknown>) {
    const baseUrl = process.env.TEST_SUPABASE_URL!;
    const anonKey = process.env.TEST_SUPABASE_ANON_KEY!;

    return fetch(`${baseUrl}/functions/v1/export-full-dump`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  it('owner from org A cannot export profiles or memberships from org B', async () => {
    const response = await callExport(fixture.orgA.users.owner.jwt, {
      tables: ['profiles', 'organizations', 'organization_members'],
    });

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.organization_id).toBe(fixture.orgA.id);

    const exportedOrganizations = payload.data?.organizations ?? [];
    expect(exportedOrganizations).toHaveLength(1);
    expect(exportedOrganizations[0]?.id).toBe(fixture.orgA.id);

    const orgAMemberIds = new Set(Object.values(fixture.orgA.users).map((user) => user.id));
    const orgBMemberIds = new Set(Object.values(fixture.orgB.users).map((user) => user.id));

    const exportedMemberships = payload.data?.organization_members ?? [];
    expect(exportedMemberships.length).toBeGreaterThan(0);
    for (const membership of exportedMemberships) {
      expect(membership.organization_id).toBe(fixture.orgA.id);
      expect(orgBMemberIds.has(membership.user_id)).toBe(false);
    }

    const exportedProfiles = payload.data?.profiles ?? [];
    for (const profile of exportedProfiles) {
      expect(orgAMemberIds.has(profile.user_id)).toBe(true);
      expect(orgBMemberIds.has(profile.user_id)).toBe(false);
    }
  }, 60_000);

  it('rejects caller supplied tables outside the immutable allowlist', async () => {
    const response = await callExport(fixture.orgA.users.owner.jwt, {
      tables: ['profiles', 'auth.users'],
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toContain('Unsupported export table');
  }, 30_000);

  it('non-admin member cannot export tenant data', async () => {
    const response = await callExport(fixture.orgA.users.sales.jwt, {
      tables: ['profiles'],
    });

    expect(response.status).toBe(403);
  }, 30_000);
});
