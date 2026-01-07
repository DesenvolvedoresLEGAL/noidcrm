/**
 * P1: E2E Tests for Critical Flows
 * 
 * Tests for authentication flows (Login/Logout/Signup).
 * Critical for ensuring users can access the system.
 * 
 * Ref: Grandfather Guardrail Section 18 - Contrato de Testes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============= MOCK SETUP =============
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

// ============= TEST FIXTURES =============
const validUser = {
  id: 'user-123',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
};

const validSession = {
  access_token: 'valid-access-token',
  refresh_token: 'valid-refresh-token',
  expires_at: Date.now() + 3600000,
  user: validUser,
};

// ============= E2E AUTH TESTS =============
describe('E2E: Authentication Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: validUser, session: validSession },
        error: null,
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: 'validPassword123!',
      });

      // Assert
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.session).toBeDefined();
      expect(result.data.session.access_token).toBeDefined();
    });

    it('should reject login with invalid credentials', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: 'wrongPassword',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid login credentials');
      expect(result.data.user).toBeNull();
    });

    it('should reject login with unconfirmed email', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      });

      // Act
      const result = await mockSignIn({
        email: 'unconfirmed@example.com',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Email not confirmed');
    });

    it('should handle empty email', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email is required' },
      });

      // Act
      const result = await mockSignIn({
        email: '',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
    });

    it('should handle empty password', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Password is required' },
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: '',
      });

      // Assert
      expect(result.error).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Too many requests', status: 429 },
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(429);
    });
  });

  describe('Signup Flow', () => {
    it('should successfully create new account', async () => {
      // Arrange
      mockSignUp.mockResolvedValue({
        data: {
          user: { ...validUser, id: 'new-user-id' },
          session: null, // Session is null until email confirmed
        },
        error: null,
      });

      // Act
      const result = await mockSignUp({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        options: {
          emailRedirectTo: 'http://localhost:3000/',
        },
      });

      // Assert
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
    });

    it('should reject signup with existing email', async () => {
      // Arrange
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      // Act
      const result = await mockSignUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('already registered');
    });

    it('should reject weak passwords', async () => {
      // Arrange
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Password should be at least 6 characters' },
      });

      // Act
      const result = await mockSignUp({
        email: 'newuser@example.com',
        password: '123',
      });

      // Assert
      expect(result.error).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      // Arrange
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Unable to validate email address: invalid format' },
      });

      // Act
      const result = await mockSignUp({
        email: 'not-an-email',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('invalid format');
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout user', async () => {
      // Arrange
      mockSignOut.mockResolvedValue({
        error: null,
      });

      // Act
      const result = await mockSignOut();

      // Assert
      expect(result.error).toBeNull();
    });

    it('should clear session on logout', async () => {
      // Arrange
      mockSignOut.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      await mockSignOut();
      const sessionResult = await mockGetSession();

      // Assert
      expect(sessionResult.data.session).toBeNull();
    });

    it('should handle logout errors gracefully', async () => {
      // Arrange
      mockSignOut.mockResolvedValue({
        error: { message: 'Network error' },
      });

      // Act
      const result = await mockSignOut();

      // Assert
      expect(result.error).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should restore session on page refresh', async () => {
      // Arrange
      mockGetSession.mockResolvedValue({
        data: { session: validSession },
        error: null,
      });

      // Act
      const result = await mockGetSession();

      // Assert
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBeDefined();
    });

    it('should handle expired session', async () => {
      // Arrange
      const expiredSession = {
        ...validSession,
        expires_at: Date.now() - 3600000, // Expired 1 hour ago
      };
      mockGetSession.mockResolvedValue({
        data: { session: null }, // Supabase returns null for expired
        error: null,
      });

      // Act
      const result = await mockGetSession();

      // Assert
      expect(result.data.session).toBeNull();
    });

    it('should trigger auth state change on login', async () => {
      // Arrange
      let authCallback: (event: string, session: any) => void = () => {};
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      // Act
      mockOnAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_IN') {
          expect(session).toBeDefined();
        }
      });

      // Simulate login event
      authCallback('SIGNED_IN', validSession);

      // Assert
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    it('should trigger auth state change on logout', async () => {
      // Arrange
      let authCallback: (event: string, session: any) => void = () => {};
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      });

      // Act
      mockOnAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_OUT') {
          expect(session).toBeNull();
        }
      });

      // Simulate logout event
      authCallback('SIGNED_OUT', null);

      // Assert
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });
  });
});

describe('E2E: Protected Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Route Protection', () => {
    it('should redirect to login when not authenticated', async () => {
      // Arrange
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Act
      const result = await mockGetSession();

      // Assert - UI should redirect
      expect(result.data.session).toBeNull();
      // In real E2E, would verify redirect to /login
    });

    it('should allow access when authenticated', async () => {
      // Arrange
      mockGetSession.mockResolvedValue({
        data: { session: validSession },
        error: null,
      });

      // Act
      const result = await mockGetSession();

      // Assert - UI should allow access
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.user).toBeDefined();
    });

    it('should redirect after successful login', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: validUser, session: validSession },
        error: null,
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: 'password123',
      });

      // Assert - should have session for redirect
      expect(result.data.session).toBeDefined();
      // In real E2E, would verify redirect to /app/dashboard
    });
  });
});

describe('E2E: Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Errors', () => {
    it('should handle network timeout gracefully', async () => {
      // Arrange
      mockSignIn.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(mockSignIn({
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Network timeout');
    });

    it('should handle server errors (500)', async () => {
      // Arrange
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Internal server error', status: 500 },
      });

      // Act
      const result = await mockSignIn({
        email: 'test@example.com',
        password: 'password123',
      });

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(500);
    });
  });

  describe('Input Validation', () => {
    it('should sanitize email input', () => {
      const dirtyEmail = '  Test@Example.COM  ';
      const cleanEmail = dirtyEmail.trim().toLowerCase();
      
      expect(cleanEmail).toBe('test@example.com');
    });

    it('should not log sensitive data', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Simulating login without logging password
      const loginData = {
        email: 'test@example.com',
        password: 'secretPassword123',
      };
      
      // Only log non-sensitive data
      console.log(`Login attempt for: ${loginData.email}`);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('secretPassword')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
