import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  createInventoryFamily,
  listInventoryFamilies,
  toggleInventoryFamilyStatus,
  updateInventoryFamily,
  type InventoryFamilyInput,
} from '@/services/operations/inventoryFamilies';

export function useInventoryFamilies(categoryId?: string) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inventory-families', orgId, categoryId ?? 'all'],
    queryFn: () => listInventoryFamilies(orgId as string, categoryId),
    enabled: !!orgId,
  });
}

export function useInventoryFamilyMutations() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['inventory-families', orgId] });

  const create = useMutation({
    mutationFn: (input: InventoryFamilyInput) =>
      createInventoryFamily(orgId as string, user?.id, input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InventoryFamilyInput> }) =>
      updateInventoryFamily(id, user?.id, input),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleInventoryFamilyStatus(id, isActive, user?.id),
    onSuccess: invalidate,
  });

  return { create, update, toggle };
}
