// NOID-VERTICAL-1.0-VERT-01.2E-B2A
// Testes de ativação da façade genérica no editor de produto.
// Estratégia: mockar hooks de domínio (provider + generic requirements) —
// nenhum acesso real ao Supabase.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks de hooks de inventário ----
const createMutate = vi.fn().mockResolvedValue({});
const updateMutate = vi.fn().mockResolvedValue({});
const deactivateMutate = vi.fn().mockResolvedValue(undefined);

let providerState: {
  provider: { hasCapability: (c: string) => boolean } | null;
  providerType: 'native' | 'eventrix' | null;
  providerName: string | null;
  status: { code: string } | null;
  isLoading: boolean;
} = {
  provider: { hasCapability: (c) => c === 'product_requirements' },
  providerType: 'eventrix',
  providerName: 'Eventrix',
  status: { code: 'available' },
  isLoading: false,
};

let categoriesState: unknown[] = [
  { id: 'cat-1', name: 'Conectividade', active: true },
];
let familiesState: unknown[] = [
  { id: 'fam-1', name: 'Roteador 5G', categoryId: 'cat-1', itemKind: 'serialized', active: true },
];
let requirementsState: unknown[] = [];
let requirementsError: Error | null = null;

vi.mock('@/inventory/hooks/useInventoryProvider', () => ({
  useInventoryProvider: () => providerState,
  useInventoryCategories: () => ({ data: categoriesState, isLoading: false }),
  useInventoryFamilies: () => ({ data: familiesState, isLoading: false }),
}));

const useInventoryProductRequirementsSpy = vi.fn();
vi.mock('@/inventory/hooks/useInventoryProductRequirements', () => ({
  useInventoryProductRequirements: (scope: unknown) => {
    useInventoryProductRequirementsSpy(scope);
    return { data: requirementsState, isLoading: false, error: requirementsError };
  },
  useCreateInventoryProductRequirement: () => ({
    mutateAsync: createMutate,
    isPending: false,
  }),
  useUpdateInventoryProductRequirement: () => ({
    mutateAsync: updateMutate,
    isPending: false,
  }),
  useDeactivateInventoryProductRequirement: () => ({
    mutateAsync: deactivateMutate,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { ProductInventoryRequirementsEditor } from '../ProductInventoryRequirementsEditor';
import type { ResolvedInventoryProductRequirementsPolicy } from '@/vertical/composition/inventoryProductRequirementsComposition';

const TEST_POLICY: ResolvedInventoryProductRequirementsPolicy = Object.freeze({
  providerSupportedByPack: true,
  defaultUnitBasis: 'per_point',
  presentation: Object.freeze({
    consumptionExample: 'A quantidade representa o consumo físico por base comercial. Ex.: 1 roteador por ponto.',
    requirementLabelPlaceholder: 'Ex: Roteador 5G Indoor',
    notesPlaceholder: 'Ex: Usado em pontos de conectividade indoor.',
  }),
});

const NATIVE_POLICY: ResolvedInventoryProductRequirementsPolicy = Object.freeze({
  ...TEST_POLICY,
  providerSupportedByPack: false,
});

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

function buildReq(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req-1',
    organization_id: 'org-1',
    product_id: 'prod-1',
    label: 'Roteador principal',
    provider_type: 'eventrix',
    category_ref: 'cat-1',
    category_name: 'Conectividade',
    family_ref: 'fam-1',
    family_name: 'Roteador 5G',
    item_kind: 'serialized',
    quantity: 2,
    unit_basis: 'per_point',
    is_required: true,
    notes: null,
    sort_order: 0,
    is_active: true,
    metadata: {},
    created_by: null,
    updated_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  createMutate.mockClear();
  updateMutate.mockClear();
  deactivateMutate.mockClear();
  useInventoryProductRequirementsSpy.mockClear();
  providerState = {
    provider: { hasCapability: (c) => c === 'product_requirements' },
    providerType: 'eventrix',
    providerName: 'Eventrix',
    status: { code: 'available' },
    isLoading: false,
  };
  categoriesState = [{ id: 'cat-1', name: 'Conectividade', active: true }];
  familiesState = [
    { id: 'fam-1', name: 'Roteador 5G', categoryId: 'cat-1', itemKind: 'serialized', active: true },
  ];
  requirementsState = [];
  requirementsError = null;
});

describe('ProductInventoryRequirementsEditor (generic façade)', () => {
  it('passa scope {organizationId, productId} ao hook genérico', () => {
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={NATIVE_POLICY}
        />,
      ),
    );
    expect(useInventoryProductRequirementsSpy).toHaveBeenCalledWith({
      organizationId: 'org-1',
      productId: 'prod-1',
    });
  });

  it('renderiza rows usando category_name/family_name/item_kind genéricos', () => {
    requirementsState = [buildReq()];
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    expect(screen.getByText('Conectividade')).toBeInTheDocument();
    expect(screen.getByText('Roteador 5G')).toBeInTheDocument();
    expect(screen.getByText('Serializado')).toBeInTheDocument();
  });

  it('Native bloqueia botão de criar composição', () => {
    providerState = {
      provider: { hasCapability: () => false },
      providerType: 'native',
      providerName: 'Inventário nativo',
      status: { code: 'available' },
      isLoading: false,
    };
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: /nova composição/i })).toBeNull();
  });

  it('Eventrix configurado exibe botão de criação disponível', () => {
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    expect(screen.getByRole('button', { name: /nova composição/i })).toBeEnabled();
  });


  it('desabilita edição quando provider_type do requirement diverge do provider ativo', () => {
    requirementsState = [buildReq({ provider_type: 'native' })];
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    const editBtn = screen.getByRole('button', { name: /editar/i });
    expect(editBtn).toBeDisabled();
  });

  it('deactivate chama mutation genérica', async () => {
    const user = userEvent.setup();
    requirementsState = [buildReq()];
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /desativar/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^desativar$/i }));
    expect(deactivateMutate).toHaveBeenCalledWith('req-1');
  });

  it('erro de leitura exibe estado controlado sem quebrar', () => {
    requirementsError = new Error('boom');
    render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    expect(
      screen.getByText(/não foi possível carregar a composição de inventário/i),
    ).toBeInTheDocument();
  });

  it('componente não referencia chaves eventrix_* no output renderizado', () => {
    requirementsState = [buildReq()];
    const { container } = render(
      wrap(
        <ProductInventoryRequirementsEditor
          organizationId="org-1"
          productId="prod-1"
          canEdit
          verticalPolicy={TEST_POLICY}
        />,
      ),
    );
    expect(container.innerHTML).not.toContain('eventrix_');
  });
});
