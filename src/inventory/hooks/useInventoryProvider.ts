// NOID-VERTICAL-1.0-VERT-01.2A
import { useQuery } from '@tanstack/react-query';
import {
  resolveInventoryProvider,
  type InventoryProviderResolution,
} from '../providers/resolveInventoryProvider';
import type {
  InventoryCategory,
  InventoryFamily,
  InventoryProviderContext,
} from '../providers/types';

export function useInventoryProvider(organizationId?: string | null) {
  const q = useQuery({
    queryKey: ['inventory-provider', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<InventoryProviderResolution> =>
      resolveInventoryProvider({ organizationId: organizationId as string }),
    staleTime: 60_000,
  });
  return {
    resolution: q.data,
    provider: q.data?.adapter,
    providerType: q.data?.providerType,
    providerName: q.data?.adapter.getDisplayName(),
    capabilities: q.data?.adapter.getCapabilities() ?? [],
    status: q.data?.status,
    isLoading: q.isLoading,
    error: q.error,
    refresh: q.refetch,
  };
}

export function useInventoryCategories(organizationId?: string | null) {
  const { provider } = useInventoryProvider(organizationId);
  return useQuery({
    queryKey: ['inventory-categories', provider?.getType(), organizationId],
    enabled: !!provider && !!organizationId,
    queryFn: async (): Promise<InventoryCategory[]> => {
      const ctx: InventoryProviderContext = { organizationId: organizationId as string };
      return provider!.listCategories(ctx);
    },
  });
}

export function useInventoryFamilies(
  organizationId?: string | null,
  categoryId?: string | null,
) {
  const { provider } = useInventoryProvider(organizationId);
  return useQuery({
    queryKey: ['inventory-families', provider?.getType(), organizationId, categoryId ?? null],
    enabled: !!provider && !!organizationId,
    queryFn: async (): Promise<InventoryFamily[]> => {
      const ctx: InventoryProviderContext = { organizationId: organizationId as string };
      return provider!.listFamilies(ctx, categoryId ?? null);
    },
  });
}
