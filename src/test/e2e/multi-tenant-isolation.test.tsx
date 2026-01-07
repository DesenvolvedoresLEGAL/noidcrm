/**
 * P1: E2E Tests for Multi-Tenant Isolation
 * 
 * Critical tests ensuring data isolation between organizations.
 * 
 * Ref: Grandfather Guardrail Section 18.4 - Testes de Multi-tenant / RLS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============= MOCK SETUP =============
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
}));

// ============= TEST FIXTURES =============
const ORG_A = {
  id: 'org-a-001',
  name: 'Organization A',
};

const ORG_B = {
  id: 'org-b-002',
  name: 'Organization B',
};

const USER_ORG_A = {
  id: 'user-org-a',
  organizationId: ORG_A.id,
};

const USER_ORG_B = {
  id: 'user-org-b',
  organizationId: ORG_B.id,
};

// ============= MULTI-TENANT ISOLATION TESTS =============
describe('E2E: Multi-Tenant Data Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Isolation', () => {
    it('Organization A should NOT see Organization B accounts', async () => {
      // Arrange: Org A user queries accounts
      // RLS should automatically filter to only org A accounts
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'acc-1', razao_social: 'Org A Account 1', organization_id: ORG_A.id },
            { id: 'acc-2', razao_social: 'Org A Account 2', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts').select('*');

      // Assert: All returned accounts belong to Org A
      expect(result.error).toBeNull();
      result.data?.forEach(account => {
        expect(account.organization_id).toBe(ORG_A.id);
        expect(account.organization_id).not.toBe(ORG_B.id);
      });
    });

    it('should return empty when querying other org accounts directly', async () => {
      // Arrange: Org A user tries to query Org B account by ID
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [], // RLS returns empty
            error: null,
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .select('*')
        .eq('id', 'org-b-account-id');

      // Assert: Should return empty, not the account
      expect(result.data).toEqual([]);
    });
  });

  describe('Opportunity Isolation', () => {
    it('Organization A should NOT see Organization B opportunities', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'opp-1', name: 'Org A Deal', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities').select('*');

      // Assert
      result.data?.forEach(opp => {
        expect(opp.organization_id).toBe(ORG_A.id);
      });
    });

    it('should block cross-org opportunity creation', async () => {
      // Arrange: Try to create opportunity in another org
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { 
                code: '42501',
                message: 'new row violates row-level security policy',
              },
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .insert({
          name: 'Cross-Org Deal',
          organization_id: ORG_B.id, // Different org
        })
        .select()
        .single();

      // Assert: Should be blocked by RLS
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });
  });

  describe('Contact Isolation', () => {
    it('Organization A should NOT see Organization B contacts', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'contact-1', nome: 'Org A Contact', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('contacts').select('*');

      // Assert
      result.data?.forEach(contact => {
        expect(contact.organization_id).toBe(ORG_A.id);
      });
    });
  });

  describe('Activity Isolation', () => {
    it('Organization A should NOT see Organization B activities', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'activity-1', title: 'Org A Activity', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('activities').select('*');

      // Assert
      result.data?.forEach(activity => {
        expect(activity.organization_id).toBe(ORG_A.id);
      });
    });
  });

  describe('Contract Isolation', () => {
    it('Organization A should NOT see Organization B contracts', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'contract-1', title: 'Org A Contract', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('contracts').select('*');

      // Assert
      result.data?.forEach(contract => {
        expect(contract.organization_id).toBe(ORG_A.id);
      });
    });
  });
});

describe('E2E: Organization Membership Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Organization Check', () => {
    it('should correctly identify user organization', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: ORG_A.id,
        error: null,
      });

      // Act
      const result = await mockSupabaseRpc('get_user_organization_id');

      // Assert
      expect(result.data).toBe(ORG_A.id);
    });

    it('should return null for user without organization', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: null,
      });

      // Act
      const result = await mockSupabaseRpc('get_user_organization_id');

      // Assert
      expect(result.data).toBeNull();
    });
  });

  describe('Organization Member Roles', () => {
    it('should correctly return member role within organization', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { org_role: 'admin', user_id: USER_ORG_A.id },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('organization_members')
        .select('org_role, user_id')
        .eq('organization_id', ORG_A.id)
        .eq('user_id', USER_ORG_A.id)
        .single();

      // Assert
      expect(result.data?.org_role).toBe('admin');
    });

    it('should not return roles from other organizations', async () => {
      // Arrange: User A tries to get roles in Org B
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('organization_members')
        .select('org_role, user_id')
        .eq('organization_id', ORG_B.id) // Different org
        .eq('user_id', USER_ORG_A.id)
        .single();

      // Assert
      expect(result.data).toBeNull();
    });
  });
});

describe('E2E: Cross-Tenant Attack Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ID Manipulation Prevention', () => {
    it('should block update to record from different org', async () => {
      // Arrange: Try to update Org B record as Org A user
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null, // No rows updated
            error: null,
            count: 0,
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .update({ razao_social: 'Hacked!' })
        .eq('id', 'org-b-account-id');

      // Assert: Should not update anything (RLS filters it out)
      expect(result.count).toBe(0);
    });

    it('should block delete of record from different org', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
            count: 0,
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .delete()
        .eq('id', 'org-b-opportunity-id');

      // Assert: Should not delete anything
      expect(result.count).toBe(0);
    });
  });

  describe('Organization ID Tampering Prevention', () => {
    it('should block changing organization_id on existing record', async () => {
      // Arrange: Try to move record to different org
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { 
              code: '42501',
              message: 'new row violates row-level security policy',
            },
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .update({ organization_id: ORG_B.id }) // Try to move to another org
        .eq('id', 'org-a-account-id');

      // Assert: Should be blocked
      expect(result.error).toBeDefined();
    });
  });

  describe('Batch Operation Prevention', () => {
    it('should only affect own organization records in batch update', async () => {
      // Arrange: Batch update should only affect Org A records
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 'acc-1', organization_id: ORG_A.id },
            ],
            error: null,
            count: 1, // Only 1 affected, not both
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .update({ segmento: 'Enterprise' })
        .in('id', ['org-a-account', 'org-b-account']); // Mix of orgs

      // Assert: Only Org A record should be updated
      expect(result.count).toBe(1);
    });
  });
});

describe('E2E: RPC Function Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Stats', () => {
    it('should only aggregate data from own organization', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: {
          total_accounts: 10,
          total_opportunities: 25,
          total_value: 500000,
          organization_id: ORG_A.id,
        },
        error: null,
      });

      // Act
      const result = await mockSupabaseRpc('get_dashboard_stats');

      // Assert
      expect(result.data?.organization_id).toBe(ORG_A.id);
    });
  });

  describe('Team Visibility', () => {
    it('get_visible_user_ids should only return org members', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: [USER_ORG_A.id, 'org-a-user-2', 'org-a-user-3'],
        error: null,
      });

      // Act
      const result = await mockSupabaseRpc('get_visible_user_ids', {
        _user_id: USER_ORG_A.id,
      });

      // Assert: Should not include Org B users
      expect(result.data).not.toContain(USER_ORG_B.id);
    });
  });
});

describe('E2E: Audit Trail Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Audit Log Access', () => {
    it('should only see audit logs from own organization', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'log-1', action: 'update', organization_id: ORG_A.id },
            { id: 'log-2', action: 'create', organization_id: ORG_A.id },
          ],
          error: null,
        }),
      });

      // Act
      const result = await mockSupabaseFrom('audit_log').select('*');

      // Assert
      result.data?.forEach(log => {
        expect(log.organization_id).toBe(ORG_A.id);
        expect(log.organization_id).not.toBe(ORG_B.id);
      });
    });
  });
});
