import { z } from 'zod';

export const createProposalInventoryDemandSnapshotSchema = z.object({
  proposal_id: z.string().uuid(),
  summary: z.record(z.any()).default({}),
  payload: z.record(z.any()).default({}),
  lines: z.array(z.any()).default([]),
  warnings: z.array(z.any()).default([]),
  commercial_context: z.record(z.any()).default({}),
  source_products: z.array(z.any()).default([]),
  source_requirements: z.array(z.any()).default([]),
  hash: z.string().nullable().optional(),
});

export type CreateProposalInventoryDemandSnapshotInput = z.infer<
  typeof createProposalInventoryDemandSnapshotSchema
>;

export interface ProposalInventoryDemandSnapshot {
  id: string;
  organization_id: string;
  proposal_id: string;
  snapshot_version: number;
  algorithm_version: string;
  status: string;
  summary: Record<string, any>;
  payload: Record<string, any>;
  lines: any[];
  warnings: any[];
  commercial_context: Record<string, any>;
  source_products: any[];
  source_requirements: any[];
  hash: string | null;
  created_by: string | null;
  created_at: string;
}
