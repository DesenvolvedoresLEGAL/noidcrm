import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: ['user-1', 'user-2'], error: null }),
  },
}));

// Mock useCurrentUser
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    user: { id: 'test-user-id' },
    isOwner: false,
    isOrgAdmin: false,
    loading: false,
  })),
}));

// Mock usePermissions
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn(() => ({
    isOwner: false,
    isAdmin: false,
    isManager: true,
    isSales: false,
    loading: false,
  })),
}));

describe('useTeamVisibility', () => {
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

  it('should return visibility data structure', async () => {
    const { useTeamVisibility } = await import('@/hooks/useTeamVisibility');
    
    const { result } = renderHook(() => useTeamVisibility(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toHaveProperty('canViewAll');
    expect(result.current).toHaveProperty('visibleUserIds');
    expect(result.current).toHaveProperty('loading');
  });

  it('should allow managers to see team members', async () => {
    const { useTeamVisibility } = await import('@/hooks/useTeamVisibility');
    
    const { result } = renderHook(() => useTeamVisibility(), {
      wrapper: createWrapper(),
    });

    // Manager should not see all, only their team
    expect(result.current.canViewAll).toBe(false);
  });
});
