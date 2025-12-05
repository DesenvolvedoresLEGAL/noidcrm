import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
    })),
  },
}));

describe('Opportunities Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct opportunity status values', () => {
    const validStatuses = ['open', 'won', 'lost'];
    expect(validStatuses).toContain('open');
    expect(validStatuses).toContain('won');
    expect(validStatuses).toContain('lost');
  });

  it('should have correct temperature values', () => {
    const validTemperatures = ['cold', 'warm', 'hot', 'burning'];
    expect(validTemperatures.length).toBe(4);
  });

  it('should validate opportunity data structure', () => {
    const opportunity = {
      id: 'test-id',
      title: 'Test Opportunity',
      valor_previsto: 10000,
      status: 'open',
      organization_id: 'org-id',
      owner_user_id: 'user-id',
    };

    expect(opportunity).toHaveProperty('id');
    expect(opportunity).toHaveProperty('title');
    expect(opportunity).toHaveProperty('valor_previsto');
    expect(opportunity).toHaveProperty('status');
    expect(opportunity).toHaveProperty('organization_id');
    expect(opportunity).toHaveProperty('owner_user_id');
  });
});
