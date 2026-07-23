// NOID-VERTICAL-1.0-VERT-01.2E-0
// Ensures INSERT and UPDATE of Eventrix settings BOTH trigger the canonical
// inventory_provider_settings sync. Previously the UPDATE branch returned early
// and skipped the sync, causing drift between legacy Eventrix config and the
// canonical provider selection.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const ORG_ID = 'org-under-test';
const USER_ID = 'user-under-test';

// ---- Mocks ----
const upsertCanonicalMock = vi.fn(async () => ({ id: 'canonical-row' }));
vi.mock('@/inventory/hooks/useInventoryProviderSettings', () => ({
  upsertInventoryProviderSettings: (...args: any[]) => upsertCanonicalMock(...args),
}));

vi.mock('@/hooks/useCurrentOrganization', () => ({
  useCurrentOrganization: () => ({ organization: { id: ORG_ID } }),
}));
vi.mock('@/hooks/useSupabaseAuth', () => ({
  useSupabaseAuth: () => ({ user: { id: USER_ID } }),
}));

// Programmable supabase mock — one queued response per .from(...) chain.
type Response = { data: any; error: any };
const responseQueue: Response[] = [];
function queueResponse(r: Response) {
  responseQueue.push(r);
}
function nextResponse(): Response {
  const r = responseQueue.shift();
  if (!r) throw new Error('supabase mock: no queued response');
  return r;
}
function makeChain() {
  const chain: any = {};
  const passthrough = () => chain;
  ['select', 'update', 'insert', 'eq', 'order'].forEach((m) => (chain[m] = passthrough));
  chain.maybeSingle = async () => nextResponse();
  chain.single = async () => nextResponse();
  return chain;
}
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => makeChain(),
  },
}));

// Import AFTER mocks
import { useUpsertEventrixInventorySettings } from '../useEventrixInventory';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  responseQueue.length = 0;
  upsertCanonicalMock.mockClear();
  upsertCanonicalMock.mockImplementation(async () => ({ id: 'canonical-row' }));
});

const baseInput = {
  environment: 'sandbox' as const,
  base_url: 'https://example.test',
  api_key_secret_name: 'SECRET',
  is_enabled: true,
};

describe('useUpsertEventrixInventorySettings — canonical sync consistency', () => {
  it('INSERT enabled: persists Eventrix and syncs canonical eventrix', async () => {
    queueResponse({ data: null, error: null }); // existing check
    queueResponse({ data: { id: 'new', is_enabled: true }, error: null }); // insert

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync(baseInput);

    expect(upsertCanonicalMock).toHaveBeenCalledTimes(1);
    expect(upsertCanonicalMock.mock.calls[0][0]).toMatchObject({
      organizationId: ORG_ID,
      userId: USER_ID,
      input: {
        provider_type: 'eventrix',
        is_enabled: true,
        selection_source: 'legacy_eventrix_settings',
      },
    });
  });

  it('UPDATE enabled: persists Eventrix AND syncs canonical (no early return)', async () => {
    queueResponse({ data: { id: 'existing' }, error: null }); // existing check
    queueResponse({ data: { id: 'existing', is_enabled: true }, error: null }); // update

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync(baseInput);

    expect(upsertCanonicalMock).toHaveBeenCalledTimes(1);
    expect(upsertCanonicalMock.mock.calls[0][0].input.provider_type).toBe('eventrix');
  });

  it('INSERT disabled: canonical resolves to native', async () => {
    queueResponse({ data: null, error: null });
    queueResponse({ data: { id: 'new', is_enabled: false }, error: null });

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync({ ...baseInput, is_enabled: false });

    expect(upsertCanonicalMock).toHaveBeenCalledTimes(1);
    expect(upsertCanonicalMock.mock.calls[0][0].input).toMatchObject({
      provider_type: 'native',
      is_enabled: true,
      selection_source: 'legacy_eventrix_settings',
    });
  });

  it('UPDATE disabled: canonical resolves to native', async () => {
    queueResponse({ data: { id: 'existing' }, error: null });
    queueResponse({ data: { id: 'existing', is_enabled: false }, error: null });

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync({ ...baseInput, is_enabled: false });

    expect(upsertCanonicalMock).toHaveBeenCalledTimes(1);
    expect(upsertCanonicalMock.mock.calls[0][0].input.provider_type).toBe('native');
  });

  it('Eventrix persistence failure prevents canonical sync', async () => {
    queueResponse({ data: { id: 'existing' }, error: null });
    queueResponse({ data: null, error: new Error('db down') });

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await expect(result.current.mutateAsync(baseInput)).rejects.toThrow('db down');
    expect(upsertCanonicalMock).not.toHaveBeenCalled();
  });

  it('Canonical failure surfaces as rejection (no silent success)', async () => {
    queueResponse({ data: null, error: null });
    queueResponse({ data: { id: 'new', is_enabled: true }, error: null });
    upsertCanonicalMock.mockRejectedValueOnce(new Error('canonical boom'));

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await expect(result.current.mutateAsync(baseInput)).rejects.toThrow(
      /Configuração Eventrix salva.*canonical boom/,
    );
  });

  it('Canonical sync runs exactly once per mutation', async () => {
    queueResponse({ data: { id: 'existing' }, error: null });
    queueResponse({ data: { id: 'existing', is_enabled: true }, error: null });

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync(baseInput);
    await waitFor(() => expect(upsertCanonicalMock).toHaveBeenCalledTimes(1));
  });

  it('organization_id used comes from current org context (no hardcoded tenant)', async () => {
    queueResponse({ data: null, error: null });
    queueResponse({ data: { id: 'new' }, error: null });

    const { result } = renderHook(() => useUpsertEventrixInventorySettings(), { wrapper });
    await result.current.mutateAsync(baseInput);

    expect(upsertCanonicalMock.mock.calls[0][0].organizationId).toBe(ORG_ID);
  });
});
