import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import type { ProductInventoryRequirement } from '@/hooks/products/useProductInventoryRequirements';
import {
  buildProposalInventoryDemandPreview,
  type ProposalInventoryDemandInputItem,
  type ProposalInventoryDemandInputProposal,
  type ProposalInventoryDemandPreview,
} from '@/lib/proposals/inventoryDemandPreview';

export function useProposalInventoryDemandPreview(
  proposal: ProposalInventoryDemandInputProposal | null | undefined,
  proposalItems: ProposalInventoryDemandInputItem[],
): {
  preview: ProposalInventoryDemandPreview;
  loading: boolean;
  productRequirements: ProductInventoryRequirement[];
} {
  const { organization } = useCurrentOrganization();

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

  const orgId = organization?.id ?? proposal?.organization_id ?? null;

  const query = useQuery({
    queryKey: ['proposal-inventory-requirements', orgId, productIds.sort().join(',')],
    enabled: !!orgId && productIds.length > 0,
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

  const preview = useMemo(
    () =>
      buildProposalInventoryDemandPreview({
        proposal: proposal
          ? { ...proposal, organization_id: proposal.organization_id ?? orgId ?? null }
          : { organization_id: orgId ?? null },
        proposalItems: proposalItems ?? [],
        productRequirements: query.data ?? [],
      }),
    [proposal, proposalItems, query.data, orgId],
  );

  return { preview, loading: query.isLoading, productRequirements: query.data ?? [] };
}
