import { supabase } from '@/integrations/supabase/client';

export interface ProposalVersion {
  id: string;
  proposal_number: string;
  proposal_version: number;
  title: string;
  status: string;
  created_at: string;
  parent_proposal_id?: string;
}

/**
 * Create a new version of an existing proposal
 */
export const createProposalVersion = async (proposalId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('create_proposal_version', {
      p_proposal_id: proposalId,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating proposal version:', error);
    throw error;
  }
};

/**
 * Get all versions of a proposal
 */
export const getProposalVersions = async (proposalId: string): Promise<ProposalVersion[]> => {
  try {
    // First, get the proposal to check if it's a parent or child
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, parent_proposal_id')
      .eq('id', proposalId)
      .single();

    if (!proposal) return [];

    // Determine the root proposal ID
    const rootId = proposal.parent_proposal_id || proposalId;

    // Get all versions (root + children)
    const { data, error } = await supabase
      .from('proposals')
      .select('id, proposal_number, proposal_version, title, status, created_at, parent_proposal_id')
      .or(`id.eq.${rootId},parent_proposal_id.eq.${rootId}`)
      .order('proposal_version', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching proposal versions:', error);
    return [];
  }
};

/**
 * Get the latest version of a proposal
 */
export const getLatestProposalVersion = async (proposalId: string): Promise<ProposalVersion | null> => {
  try {
    const versions = await getProposalVersions(proposalId);
    if (versions.length === 0) return null;
    
    return versions[versions.length - 1];
  } catch (error) {
    console.error('Error fetching latest proposal version:', error);
    return null;
  }
};
