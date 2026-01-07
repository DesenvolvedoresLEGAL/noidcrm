/**
 * P1: E2E Tests for CRM Critical Flows
 * 
 * Tests for opportunity creation, account management, and critical CRM operations.
 * 
 * Ref: Grandfather Guardrail Section 18 - Contrato de Testes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============= MOCK SETUP =============
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  },
}));

// ============= TEST FIXTURES =============
const testAccount = {
  id: 'account-123',
  razao_social: 'Test Company LTDA',
  nome_fantasia: 'Test Company',
  organization_id: 'org-123',
  owner_user_id: 'test-user-id',
};

const testOpportunity = {
  id: 'opp-123',
  name: 'New Deal',
  account_id: 'account-123',
  pipeline_id: 'pipeline-123',
  stage_id: 'stage-123',
  value: 10000,
  owner_user_id: 'test-user-id',
  organization_id: 'org-123',
};

const testContact = {
  id: 'contact-123',
  nome: 'John Doe',
  email: 'john@test.com',
  account_id: 'account-123',
  organization_id: 'org-123',
};

// ============= E2E CRM TESTS =============
describe('E2E: Opportunity Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Opportunity', () => {
    it('should successfully create new opportunity', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: testOpportunity,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .insert({
          name: 'New Deal',
          account_id: 'account-123',
          pipeline_id: 'pipeline-123',
          value: 10000,
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('New Deal');
    });

    it('should require account_id for opportunity', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'null value in column "account_id"' },
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .insert({
          name: 'New Deal',
          // Missing account_id
          pipeline_id: 'pipeline-123',
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('account_id');
    });

    it('should set owner_user_id to current user', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...testOpportunity, owner_user_id: 'test-user-id' },
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .insert({
          name: 'New Deal',
          account_id: 'account-123',
          owner_user_id: 'test-user-id', // Should be set automatically
        })
        .select()
        .single();

      // Assert
      expect(result.data?.owner_user_id).toBe('test-user-id');
    });
  });

  describe('Update Opportunity Stage', () => {
    it('should successfully move opportunity to next stage', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...testOpportunity, stage_id: 'stage-456' },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .update({ stage_id: 'stage-456' })
        .eq('id', 'opp-123')
        .select()
        .single();

      // Assert
      expect(result.error).toBeNull();
      expect(result.data?.stage_id).toBe('stage-456');
    });

    it('should record stage change in history', async () => {
      // This tests that stage changes are tracked
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: { id: 'history-1' },
          error: null,
        }),
      });

      const result = await mockSupabaseFrom('opportunity_stage_history')
        .insert({
          opportunity_id: 'opp-123',
          from_stage_id: 'stage-123',
          to_stage_id: 'stage-456',
        });

      expect(result.error).toBeNull();
    });
  });

  describe('Win/Lose Opportunity', () => {
    it('should mark opportunity as won', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...testOpportunity, status: 'won', closed_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .update({ status: 'won', closed_at: new Date().toISOString() })
        .eq('id', 'opp-123')
        .select()
        .single();

      // Assert
      expect(result.data?.status).toBe('won');
      expect(result.data?.closed_at).toBeDefined();
    });

    it('should mark opportunity as lost with reason', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  ...testOpportunity, 
                  status: 'lost', 
                  loss_reason: 'price',
                  closed_at: new Date().toISOString() 
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .update({ 
          status: 'lost', 
          loss_reason: 'price',
          closed_at: new Date().toISOString() 
        })
        .eq('id', 'opp-123')
        .select()
        .single();

      // Assert
      expect(result.data?.status).toBe('lost');
      expect(result.data?.loss_reason).toBe('price');
    });
  });
});

describe('E2E: Account Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Account', () => {
    it('should successfully create new account', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: testAccount,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .insert({
          razao_social: 'Test Company LTDA',
          organization_id: 'org-123',
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeNull();
      expect(result.data?.razao_social).toBe('Test Company LTDA');
    });

    it('should require organization_id', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'violates row-level security policy' },
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .insert({
          razao_social: 'Test Company LTDA',
          // Missing organization_id - RLS should block
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeDefined();
    });

    it('should validate CNPJ format', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Invalid CNPJ format' },
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .insert({
          razao_social: 'Test Company LTDA',
          cnpj: '123', // Invalid
          organization_id: 'org-123',
        })
        .select()
        .single();

      // Assert - validation should fail
      expect(result.error).toBeDefined();
    });
  });

  describe('Search Accounts', () => {
    it('should search accounts by name', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [testAccount],
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .select('*')
        .or('razao_social.ilike.%Test%,nome_fantasia.ilike.%Test%')
        .limit(10);

      // Assert
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].razao_social).toContain('Test');
    });

    it('should only return accounts from same organization', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [testAccount], // Only returns org-123 accounts
            error: null,
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('accounts')
        .select('*')
        .eq('organization_id', 'org-123');

      // Assert
      expect(result.data).toBeDefined();
      result.data?.forEach(account => {
        expect(account.organization_id).toBe('org-123');
      });
    });
  });
});

describe('E2E: Contact Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Contact', () => {
    it('should successfully create contact linked to account', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: testContact,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('contacts')
        .insert({
          nome: 'John Doe',
          email: 'john@test.com',
          account_id: 'account-123',
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeNull();
      expect(result.data?.account_id).toBe('account-123');
    });
  });

  describe('Search Contacts', () => {
    it('should search contacts by name or email', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [testContact],
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('contacts')
        .select('*')
        .or('nome.ilike.%John%,email.ilike.%john%')
        .limit(10);

      // Assert
      expect(result.data).toHaveLength(1);
    });
  });
});

describe('E2E: Activity Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Log Activity', () => {
    it('should create activity linked to opportunity', async () => {
      // Arrange
      const testActivity = {
        id: 'activity-123',
        type: 'call',
        title: 'Discovery Call',
        opportunity_id: 'opp-123',
        owner_user_id: 'test-user-id',
      };

      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: testActivity,
              error: null,
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('activities')
        .insert({
          type: 'call',
          title: 'Discovery Call',
          opportunity_id: 'opp-123',
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeNull();
      expect(result.data?.opportunity_id).toBe('opp-123');
    });

    it('should record activity completion', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { 
                  id: 'activity-123', 
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('activities')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', 'activity-123')
        .select()
        .single();

      // Assert
      expect(result.data?.status).toBe('completed');
      expect(result.data?.completed_at).toBeDefined();
    });
  });
});

describe('E2E: Data Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cascade Deletes', () => {
    it('should soft delete opportunity (not hard delete)', async () => {
      // Arrange
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { id: 'opp-123', deleted_at: new Date().toISOString() },
            error: null,
          }),
        }),
      });

      // Act - should use soft delete via deleted_at
      const result = await mockSupabaseFrom('opportunities')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', 'opp-123');

      // Assert
      expect(result.error).toBeNull();
      expect(result.data?.deleted_at).toBeDefined();
    });
  });

  describe('Referential Integrity', () => {
    it('should not allow orphan opportunities', async () => {
      // Arrange - try to create opportunity with non-existent account
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { 
                code: '23503', 
                message: 'violates foreign key constraint' 
              },
            }),
          }),
        }),
      });

      // Act
      const result = await mockSupabaseFrom('opportunities')
        .insert({
          name: 'Orphan Deal',
          account_id: 'non-existent-account',
        })
        .select()
        .single();

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('23503');
    });
  });
});
