// NOID-VERTICAL-1.0-VERT-01.2D-C
// Runtime real do Proposal Inventory Demand — conecta o provider
// resolver ao domínio genérico (`src/inventory/demand`) e substitui
// o builder legado como implementação principal.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useInventoryProvider } from '@/inventory/hooks/useInventoryProvider';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import {
  buildInventoryDemandPreview,
  normalizeProductInventoryRequirements,
  type InventoryDemandInputItem,
  type InventoryDemandInputProposal,
  type InventoryDemandPreview,
  type NormalizedProductInventoryRequirement,
} from '@/inventory/demand';
import type { InventoryProviderType } from '@/inventory/providers/types';

export interface UseProposalInventoryDemandPreviewResult {
  preview: InventoryDemandPreview;
  loading: boolean;
  error: Error | null;
  provider: ReturnType<typeof useInventoryProvider>['provider'];
  providerType: InventoryProviderType | undefined;
  providerName: string | undefined;
  capabilities: ReturnType<typeof useInventoryProvider>['capabilities'];
  supportsProposalDemand: boolean;
  productRequirements: ProductInventoryRequirement[];
  normalizedRequirements: NormalizedProductInventoryRequirement[];
  refreshProvider: ReturnType<typeof useInventoryProvider>['refresh'];
}

function emptyUnsupportedPreview(
  proposal: InventoryDemandInputProposal | null | undefined,
  providerType: InventoryProviderType,
  orgId: string | null,
): InventoryDemandPreview {
  return buildInventoryDemandPreview({
    proposal: proposal
      ? { ...proposal, organization_id: proposal.organization_id ?? orgId ?? null }
      : { organization_id: orgId ?? null },
    proposalItems: [],
    requirements: [],
    providerType,
    supportsProposalDemand: false,
  });
}

export function useProposalInventoryDemandPreview(
  proposal: InventoryDemandInputProposal | null | undefined,
  proposalItems: InventoryDemandInputItem[],
): UseProposalInventoryDemandPreviewResult {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? proposal?.organization_id ?? null;

  const providerResult = useInventoryProvider(orgId);
  const {
    provider,
    providerType,
    providerName,
    capabilities,
    isLoading: providerLoading,
    error: providerError,
    refresh: refreshProvider,
  } = providerResult;

  const supportsProposalDemand =
    provider?.hasCapability('proposal_demand') === true;

  const productIds = useMemo(
    () =>
      Array.from(
        new Set(
          (proposalItems ?? [])
            .map((it) => it.product_id)
            .filter((id): id is string => !!id),
        ),
      ),
    [proposalItems],
  );

  const requirementsQuery = useQuery({
    queryKey: [
      'proposal-inventory-requirements',
      orgId,
      providerType,
      productIds.slice().sort().join(','),
    ],
    enabled:
      !!orgId &&
      !providerLoading &&
      !providerError &&
      supportsProposalDemand &&
      productIds.length > 0,
    queryFn: async (): Promise<ProductInventoryRequirement[]> => {
      const { data, error } = await (supabase as any)
        .from('product_inventory_requirements')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .in('product_id', productIds)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProductInventoryRequirement[];
    },
  });

  const productRequirements = requirementsQuery.data ?? [];

  const normalizedRequirements = useMemo(() => {
    if (!supportsProposalDemand || !providerType) return [];
    // Requisitos físicos legados carregam colunas Eventrix. Normalizar
    // apenas quando o provider ativo os aceita — nunca reinterpretar
    // referências Eventrix como Native.
    const { normalized } = normalizeProductInventoryRequirements(
      productRequirements,
      { providerType },
    );
    return normalized;
  }, [productRequirements, providerType, supportsProposalDemand]);

  const preview = useMemo<InventoryDemandPreview>(() => {
    // Enquanto o provider ainda carrega, evitar cálculos precipitados
    // (retorna unsupported placeholder — a UI mostra estado de loading).
    if (providerLoading || !providerType) {
      return emptyUnsupportedPreview(proposal, 'native', orgId);
    }
    if (!supportsProposalDemand) {
      return emptyUnsupportedPreview(proposal, providerType, orgId);
    }
    return buildInventoryDemandPreview({
      proposal: proposal
        ? { ...proposal, organization_id: proposal.organization_id ?? orgId ?? null }
        : { organization_id: orgId ?? null },
      proposalItems: proposalItems ?? [],
      requirements: normalizedRequirements,
      providerType,
      supportsProposalDemand: true,
    });
  }, [
    proposal,
    proposalItems,
    normalizedRequirements,
    providerType,
    providerLoading,
    supportsProposalDemand,
    orgId,
  ]);

  const loading =
    providerLoading ||
    (supportsProposalDemand && productIds.length > 0 && requirementsQuery.isLoading);

  const error =
    (providerError as Error | null) ??
    (requirementsQuery.error as Error | null) ??
    null;

  return {
    preview,
    loading,
    error,
    provider,
    providerType,
    providerName,
    capabilities,
    supportsProposalDemand,
    productRequirements,
    normalizedRequirements,
    refreshProvider,
  };
}
