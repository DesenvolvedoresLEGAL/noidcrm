import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import {
  createInventoryCategory,
  listInventoryCategories,
  toggleInventoryCategoryStatus,
  updateInventoryCategory,
  type InventoryCategoryInput,
} from '@/services/operations/inventoryCategories';

export function useInventoryCategories() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['inventory-categories', orgId],
    queryFn: () => listInventoryCategories(orgId as string),
    enabled: !!orgId,
  });
}

export function useInventoryCategoryMutations() {
  const { organization } = useCurrentOrganization();
  const { user } = useSupabaseAuth();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-categories', orgId] });

  const create = useMutation({
    mutationFn: (input: InventoryCategoryInput) =>
      createInventoryCategory(orgId as string, user?.id, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InventoryCategoryInput> }) =>
      updateInventoryCategory(id, user?.id, input),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleInventoryCategoryStatus(id, isActive, user?.id),
    onSuccess: invalidate,
  });

  return { create, update, toggle };
}
