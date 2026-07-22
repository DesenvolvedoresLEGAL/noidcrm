// NOID-VERTICAL-1.0-VERT-01.2C
import { describe, it, expect, vi } from 'vitest';

// Smoke coverage: garante que a página nova e o painel extraído carregam
// sem erro de módulo e mantêm a API pública mínima.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          order: () => ({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

describe('InventoryProviderSettingsPage — VERT-01.2C', () => {
  it('carrega o módulo da página genérica', async () => {
    const mod = await import('@/pages/settings/InventoryProviderSettingsPage');
    expect(typeof mod.default).toBe('function');
  });

  it('re-exporta o painel Eventrix a partir da página legada', async () => {
    const mod = await import('@/pages/settings/EventrixInventorySettings');
    expect(typeof mod.EventrixInventoryProviderPanel).toBe('function');
    expect(typeof mod.default).toBe('function');
  });
});
