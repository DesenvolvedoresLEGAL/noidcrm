// NOID-VERTICAL-1.0-VERT-01.2E-B2B
// Runtime real do Proposal Inventory Demand. Consome exclusivamente
// a façade genérica de Product Inventory Requirements (nunca
// consulta `product_inventory_requirements` diretamente e nunca vê
// colunas `eventrix_*`). O provider ativo determina se demand é
// suportado; requisitos de provider divergente são filtrados antes
// da normalização.
import { useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useInventoryProvider } from '@/inventory/hooks/useInventoryProvider';
import { useInventoryProductRequirementsForProducts } from '@/inventory/hooks/useInventoryProductRequirements';
import type { InventoryProductRequirement } from '@/inventory/requirements/types';
import {
  buildInventoryDemandPreview,
  normalizeInventoryProductRequirements,
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
  productRequirements: InventoryProductRequirement[];
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

  // Bulk query genérica: só executa quando provider carregou, é sadio,
  // possui capability proposal_demand e há products com id.
  const canQueryRequirements =
    !!orgId &&
    !providerLoading &&
    !providerError &&
    supportsProposalDemand &&
    productIds.length > 0;

  const requirementsQuery = useInventoryProductRequirementsForProducts({
    organizationId: orgId,
    productIds,
    activeOnly: true,
    enabled: canQueryRequirements,
  });

  const productRequirements: InventoryProductRequirement[] =
    requirementsQuery.data ?? [];

  const normalizedRequirements = useMemo(() => {
    if (!supportsProposalDemand || !providerType) return [];
    // Filtrar por provider ANTES da normalização preserva a semântica clara
    // (Eventrix consome só eventrix; nunca reinterpreta Native).
    const compatible = productRequirements.filter(
      (r) => r.provider_type === providerType,
    );
    const { normalized } = normalizeInventoryProductRequirements(compatible);
    return normalized;
  }, [productRequirements, providerType, supportsProposalDemand]);

  const preview = useMemo<InventoryDemandPreview>(() => {
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
    (canQueryRequirements && requirementsQuery.isLoading);

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
