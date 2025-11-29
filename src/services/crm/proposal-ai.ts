// Re-export from Supabase service
export {
  generateIntroduction,
  analyzeProposal,
  suggestPricing,
  getClientSentimentAnalysis,
} from '../supabase/proposal-ai';

export type { 
  ProposalAnalysis, 
  ProposalIssue, 
  PricingSuggestion,
  ClientSentiment 
} from '../supabase/proposal-ai';
