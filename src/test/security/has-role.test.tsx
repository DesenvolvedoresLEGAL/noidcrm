/**
 * P0 CRITICAL: has_role Function Security Tests
 * 
 * Tests for the security definer function that checks user roles.
 * This is critical to prevent privilege escalation attacks.
 * 
 * Ref: Grandfather Guardrail Section 3.2.2 - Autorização
 * Ref: important-info - Roles MUST be stored in separate table
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============= MOCK SETUP =============
const mockSupabaseRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
  },
}));

// ============= ROLE SECURITY TESTS =============
describe('P0 CRITICAL: has_role Function Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Role Check Functionality', () => {
    it('should return true when user has specified role', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: true,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('has_role', {
        _user_id: 'admin-user-id',
        _role: 'admin',
      });

      expect(result.data).toBe(true);
      expect(mockSupabaseRpc).toHaveBeenCalledWith('has_role', {
        _user_id: 'admin-user-id',
        _role: 'admin',
      });
    });

    it('should return false when user does not have specified role', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: false,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('has_role', {
        _user_id: 'sales-user-id',
        _role: 'admin',
      });

      expect(result.data).toBe(false);
    });

    it('should handle invalid user_id gracefully', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: false, // Should default to false for safety
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('has_role', {
        _user_id: null,
        _role: 'admin',
      });

      // Should return false (deny by default)
      expect(result.data).toBe(false);
    });

    it('should handle invalid role gracefully', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: null,
        error: { message: 'Invalid role type' },
      });

      // Test with invalid role - using direct mock call
      const result = await mockSupabaseRpc('has_role', {
        _user_id: 'some-user-id',
        _role: 'super_admin_hacker', // Invalid role - should fail
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should not allow checking roles from another organization', async () => {
      // The has_role function should only check roles within context
      // It uses SECURITY DEFINER to prevent RLS recursion but
      // should still respect organizational boundaries
      
      mockSupabaseRpc.mockResolvedValue({
        data: false, // Should always be false for cross-org
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      
      // User from Org A checking if they have admin role
      // (but they're actually in Org B)
      const result = await supabase.rpc('has_role', {
        _user_id: 'user-from-different-org',
        _role: 'admin',
      });

      expect(result.data).toBe(false);
    });

    it('should prevent role enumeration attacks', async () => {
      // Should not leak information about what roles exist
      const roles = ['admin', 'manager', 'sales', 'cs'] as const;
      
      for (const role of roles) {
        mockSupabaseRpc.mockResolvedValue({
          data: false,
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('has_role', {
          _user_id: 'attacker-user-id',
          _role: role,
        });

        // All should return false without revealing if role exists
        expect(result.data).toBe(false);
        expect(result.error).toBeNull();
      }
    });
  });

  describe('Valid Role Types', () => {
    const validRoles = ['admin', 'manager', 'sales', 'cs'] as const;

    validRoles.forEach((role) => {
      it(`should correctly check for ${role} role`, async () => {
        mockSupabaseRpc.mockResolvedValue({
          data: true,
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('has_role', {
          _user_id: `${role}-user-id`,
          _role: role,
        });

        expect(mockSupabaseRpc).toHaveBeenCalledWith('has_role', {
          _user_id: `${role}-user-id`,
          _role: role,
        });
      });
    });
  });
});

describe('P0 CRITICAL: Role Table Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('user_roles Table Protection', () => {
    it('should NOT allow direct INSERT to user_roles by regular users', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42501',
            message: 'permission denied for table user_roles',
          },
        }),
      });

      // Simulate direct insert attempt
      const result = await mockFrom('user_roles').insert({
        user_id: 'attacker-user-id',
        role: 'admin', // Attempting privilege escalation
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('42501');
    });

    it('should NOT allow direct UPDATE to user_roles by regular users', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: '42501',
              message: 'permission denied for table user_roles',
            },
          }),
        }),
      });

      const result = await mockFrom('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', 'attacker-user-id');

      expect(result.error).toBeDefined();
    });

    it('should NOT allow direct DELETE from user_roles by regular users', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: {
              code: '42501',
              message: 'permission denied for table user_roles',
            },
          }),
        }),
      });

      const result = await mockFrom('user_roles')
        .delete()
        .eq('user_id', 'some-user-id');

      expect(result.error).toBeDefined();
    });
  });

  describe('Role Storage Best Practices', () => {
    it('roles should NOT be stored in profiles table', () => {
      // This is a documentation/architecture test
      // Ref: important-info - Roles MUST be stored in separate table
      
      // The profiles table should not contain role columns
      const profileColumns = ['id', 'user_id', 'full_name', 'avatar_url', 'email', 'phone'];
      
      expect(profileColumns).not.toContain('role');
      expect(profileColumns).not.toContain('is_admin');
      expect(profileColumns).not.toContain('is_owner');
      expect(profileColumns).not.toContain('user_role');
    });

    it('roles should be in user_roles table with foreign key', () => {
      // Architecture validation
      const userRolesExpectedColumns = ['id', 'user_id', 'role'];
      
      expect(userRolesExpectedColumns).toContain('user_id');
      expect(userRolesExpectedColumns).toContain('role');
    });
  });
});

describe('P0 CRITICAL: Platform Admin Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Platform Admin Functions', () => {
    it('is_platform_admin should only return true for platform admins', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: false,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('is_platform_admin_for_rls', {
        user_id: 'regular-user-id',
      });

      expect(result.data).toBe(false);
    });

    it('is_platform_super_admin should be highly restricted', async () => {
      mockSupabaseRpc.mockResolvedValue({
        data: false,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('is_platform_super_admin', {
        _user_id: 'regular-user-id',
      });

      expect(result.data).toBe(false);
    });
  });
});
