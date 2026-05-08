import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  createInventoryLocation,
  listInventoryLocations,
  toggleInventoryLocationStatus,
  updateInventoryLocation,
  type InventoryLocationInput,
} from '@/services/operations/inventoryLocations';

export function useInventoryLocations() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inventory-locations', orgId],
    queryFn: () => listInventoryLocations(orgId as string),
    enabled: !!orgId,
  });
}

export function useInventoryLocationMutations() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-locations', orgId] });

  const create = useMutation({
    mutationFn: (input: InventoryLocationInput) =>
      createInventoryLocation(orgId as string, user?.id, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InventoryLocationInput> }) =>
      updateInventoryLocation(id, user?.id, input),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleInventoryLocationStatus(id, isActive, user?.id),
    onSuccess: invalidate,
  });

  return { create, update, toggle };
}
