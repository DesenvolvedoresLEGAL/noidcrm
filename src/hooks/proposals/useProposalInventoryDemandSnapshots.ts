import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import type {
  CreateProposalInventoryDemandSnapshotInput,
  ProposalInventoryDemandSnapshot,
} from '@/schemas/proposalInventoryDemandSnapshot';

const TABLE = 'proposal_inventory_demand_snapshots' as const;

export function useProposalInventoryDemandSnapshots(proposalId?: string | null) {
  return useQuery({
    queryKey: ['proposal-inventory-demand-snapshots', proposalId],
    enabled: !!proposalId,
    queryFn: async (): Promise<ProposalInventoryDemandSnapshot[]> => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('proposal_id', proposalId)
        .order('snapshot_version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProposalInventoryDemandSnapshot[];
    },
  });
}

export function useCreateProposalInventoryDemandSnapshot() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (input: CreateProposalInventoryDemandSnapshotInput) => {
      const orgId = organization?.id;
      if (!orgId) throw new Error('Organização não encontrada.');

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // Determine next version
      const { data: last, error: lastErr } = await (supabase as any)
        .from(TABLE)
        .select('snapshot_version')
        .eq('proposal_id', input.proposal_id)
        .order('snapshot_version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastErr) throw lastErr;
      const nextVersion = (last?.snapshot_version ?? 0) + 1;

      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert({
          organization_id: orgId,
          proposal_id: input.proposal_id,
          snapshot_version: nextVersion,
          // NOID-VERTICAL-1.0-VERT-01.2D-C
          // Novos snapshots v2 informam explicitamente
          // `algorithm_version='inventory-demand-v2'`. Callers legados
          // sem esse campo mantêm o fallback histórico.
          algorithm_version: input.algorithm_version ?? 'noid-inv-demand-v1',
          // Preservamos o significado atual da coluna física `status`.
          // O status semântico da demanda vive no payload/serializer.
          status: 'preview_snapshot',
          summary: input.summary ?? {},
          payload: input.payload ?? {},
          lines: input.lines ?? [],
          warnings: input.warnings ?? [],
          commercial_context: input.commercial_context ?? {},
          source_products: input.source_products ?? [],
          source_requirements: input.source_requirements ?? [],
          hash: input.hash ?? null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalInventoryDemandSnapshot;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ['proposal-inventory-demand-snapshots', vars.proposal_id],
      });
    },
  });
}
