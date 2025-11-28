// Re-export functions from Supabase service
export {
  autoFillProposal,
  suggestProposalItems,
  syncAccountDataToProposal,
} from '../supabase/proposal-autofill';

export type { AutoFillProposalData } from '../supabase/proposal-autofill';
