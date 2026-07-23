// NOID-VERTICAL-1.0-VERT-01.2E-B1.1
// Testes dedicados do hook genérico. Supabase é mockado.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Supabase mock (query builder programável) ----
type Handler = (ctx: {
  table: string;
  op: 'select' | 'insert' | 'update';
  filters: Record<string, unknown>;
  payload?: unknown;
  single?: boolean;
}) => { data: unknown; error: unknown };

const calls: Array<{
  table: string;
  op: 'select' | 'insert' | 'update';
  filters: Record<string, unknown>;
  payload?: unknown;
  single?: boolean;
}> = [];

let handler: Handler = () => ({ data: null, error: null });

function makeBuilder(table: string) {
  const ctx: {
    table: string;
    op: 'select' | 'insert' | 'update';
    filters: Record<string, unknown>;
    payload?: unknown;
    single?: boolean;
  } = { table, op: 'select', filters: {} };
  const chain: any = {
    select: (_cols?: string) => {
      // when following insert/update, keep op
      return chain;
    },
    insert: (payload: unknown) => {
      ctx.op = 'insert';
      ctx.payload = payload;
      return chain;
    },
    update: (payload: unknown) => {
      ctx.op = 'update';
      ctx.payload = payload;
      return chain;
    },
    eq: (col: string, val: unknown) => {
      ctx.filters[col] = val;
      return chain;
    },
    order: () => chain,
    single: () => {
      ctx.single = true;
      calls.push({ ...ctx, filters: { ...ctx.filters } });
      return Promise.resolve(handler(ctx));
    },
    then: (resolve: (v: any) => void, reject?: (e: any) => void) => {
      calls.push({ ...ctx, filters: { ...ctx.filters } });
      try {
        resolve(handler(ctx));
      } catch (e) {
        reject?.(e);
      }
    },
  };
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

import {
  useCreateInventoryProductRequirement,
  useDeactivateInventoryProductRequirement,
  useInventoryProductRequirements,
  useUpdateInventoryProductRequirement,
} from '../useInventoryProductRequirements';
import { INVENTORY_PROVIDER_METADATA_KEY } from '@/inventory/requirements/types';

const SCOPE = { organizationId: 'org-1', productId: 'prod-1' };

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    organization_id: 'org-1',
    product_id: 'prod-1',
    label: 'Item',
    eventrix_category_id: 'cat-1',
    eventrix_category_name: 'Cat',
    eventrix_family_id: 'fam-1',
    eventrix_family_name: 'Fam',
    eventrix_item_kind: null,
    quantity: 1,
    unit_basis: 'per_day',
    is_required: true,
    notes: null,
    sort_order: 0,
    is_active: true,
    metadata: null,
    created_by: null,
    updated_by: null,
    created_at: 't',
    updated_at: 't',
    ...overrides,
  };
}

beforeEach(() => {
  calls.length = 0;
  handler = () => ({ data: null, error: null });
});

describe('useInventoryProductRequirements — query', () => {
  it('escopa organization_id e product_id e mapeia storage → domain', async () => {
    handler = () => ({ data: [fakeRow()], error: null });
    const { result } = renderHook(() => useInventoryProductRequirements(SCOPE), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const q = calls.find((c) => c.op === 'select' && !c.single);
    expect(q?.filters.organization_id).toBe('org-1');
    expect(q?.filters.product_id).toBe('prod-1');
    expect(result.current.data?.[0].category_ref).toBe('cat-1');
    // não expõe eventrix_*
    for (const k of Object.keys(result.current.data![0])) {
      expect(k.startsWith('eventrix_')).toBe(false);
    }
  });
});

describe('useCreateInventoryProductRequirement', () => {
  it('envia organization_id/product_id e retorna domínio genérico', async () => {
    handler = ({ op, payload }) => {
      if (op === 'insert') return { data: fakeRow(payload as any), error: null };
      return { data: null, error: null };
    };
    const { result } = renderHook(() => useCreateInventoryProductRequirement(SCOPE), {
      wrapper: wrapper(),
    });
    const created = await result.current.mutateAsync({
      label: 'X',
      provider_type: 'eventrix',
      category_ref: 'cat-1',
      category_name: 'Cat',
      family_ref: 'fam-1',
      family_name: 'Fam',
      quantity: 1,
      unit_basis: 'per_day',
    });
    const ins = calls.find((c) => c.op === 'insert')!;
    expect((ins.payload as any).organization_id).toBe('org-1');
    expect((ins.payload as any).product_id).toBe('prod-1');
    expect((ins.payload as any).eventrix_category_id).toBe('cat-1');
    expect(created.provider_type).toBe('eventrix');
  });

  it('provider Native é rejeitado antes de qualquer write', async () => {
    const { result } = renderHook(() => useCreateInventoryProductRequirement(SCOPE), {
      wrapper: wrapper(),
    });
    await expect(
      result.current.mutateAsync({
        label: 'X',
        provider_type: 'native',
        category_ref: 'cat-1',
        category_name: 'Cat',
        family_ref: 'fam-1',
        family_name: 'Fam',
        quantity: 1,
        unit_basis: 'per_day',
      }),
    ).rejects.toThrow();
    expect(calls.find((c) => c.op === 'insert')).toBeUndefined();
  });
});

describe('useUpdateInventoryProductRequirement — metadata preservation', () => {
  it('update simples (só label) NÃO faz read extra de metadata', async () => {
    handler = ({ op, payload }) => {
      if (op === 'update') return { data: fakeRow(payload as any), error: null };
      return { data: { metadata: null }, error: null };
    };
    const { result } = renderHook(() => useUpdateInventoryProductRequirement(SCOPE), {
      wrapper: wrapper(),
    });
    await result.current.mutateAsync({ id: 'req-1', input: { label: 'novo' } });
    const reads = calls.filter((c) => c.op === 'select' && c.single);
    expect(reads.length).toBe(0);
  });

  it('update com metadata parcial lê metadata existente e mescla', async () => {
    const existing = { foo: 'bar', [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix' };
    handler = ({ op }) => {
      if (op === 'select') return { data: { metadata: existing }, error: null };
      if (op === 'update') return { data: fakeRow(), error: null };
      return { data: null, error: null };
    };
    const { result } = renderHook(() => useUpdateInventoryProductRequirement(SCOPE), {
      wrapper: wrapper(),
    });
    await result.current.mutateAsync({
      id: 'req-1',
      input: { metadata: { extra: 1 } },
    });
    const read = calls.find((c) => c.op === 'select' && c.single);
    expect(read?.filters).toEqual({
      id: 'req-1',
      organization_id: 'org-1',
      product_id: 'prod-1',
    });
    const upd = calls.find((c) => c.op === 'update')!;
    expect((upd.payload as any).metadata).toEqual({
      foo: 'bar',
      extra: 1,
      [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix',
    });
  });

  it('update com provider_type lê metadata existente e preserva chaves', async () => {
    const existing = {
      foo: 'bar',
      custom: 123,
      [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix',
    };
    handler = ({ op }) => {
      if (op === 'select') return { data: { metadata: existing }, error: null };
      if (op === 'update') return { data: fakeRow(), error: null };
      return { data: null, error: null };
    };
    const { result } = renderHook(() => useUpdateInventoryProductRequirement(SCOPE), {
      wrapper: wrapper(),
    });
    await result.current.mutateAsync({
      id: 'req-1',
      input: { provider_type: 'eventrix', label: 'Novo' },
    });
    expect(calls.some((c) => c.op === 'select' && c.single)).toBe(true);
    const upd = calls.find((c) => c.op === 'update')!;
    expect((upd.payload as any).metadata).toEqual({
      foo: 'bar',
      custom: 123,
      [INVENTORY_PROVIDER_METADATA_KEY]: 'eventrix',
    });
    expect((upd.filters as any).id).toBe('req-1');
    expect((upd.filters as any).organization_id).toBe('org-1');
    expect((upd.filters as any).product_id).toBe('prod-1');
  });
});

describe('useDeactivateInventoryProductRequirement', () => {
  it('faz UPDATE is_active=false com scope tenant, nunca DELETE', async () => {
    handler = () => ({ data: null, error: null });
    const { result } = renderHook(
      () => useDeactivateInventoryProductRequirement(SCOPE),
      { wrapper: wrapper() },
    );
    await result.current.mutateAsync('req-1');
    const upd = calls.find((c) => c.op === 'update')!;
    expect((upd.payload as any).is_active).toBe(false);
    expect(upd.filters).toEqual({
      id: 'req-1',
      organization_id: 'org-1',
      product_id: 'prod-1',
    });
    expect(calls.every((c) => c.op !== ('delete' as any))).toBe(true);
  });
});
