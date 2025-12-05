import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the useCurrentUser hook
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    user: { id: 'test-user-id' },
    isOwner: false,
    isOrgAdmin: false,
    loading: false,
  })),
}));

// Mock useCurrentOrganization
vi.mock('@/hooks/useCurrentOrganization', () => ({
  useCurrentOrganization: vi.fn(() => ({
    organization: { id: 'test-org-id' },
    membership: { org_role: 'sales' },
    isOwner: false,
    isAdmin: false,
    loading: false,
  })),
}));

describe('usePermissions', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return permission checking function', async () => {
    // Import after mocks are set up
    const { usePermissions } = await import('@/hooks/usePermissions');
    
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.can).toBeDefined();
    expect(typeof result.current.can).toBe('function');
  });

  it('should identify user roles correctly', async () => {
    const { usePermissions } = await import('@/hooks/usePermissions');
    
    const { result } = renderHook(() => usePermissions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isOwner).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });
});
