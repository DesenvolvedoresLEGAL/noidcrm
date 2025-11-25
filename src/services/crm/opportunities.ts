// Re-export functions from Supabase service
export { 
  listOpportunities, 
  getOpportunity, 
  createOpportunity, 
  advanceOpportunity, 
  moveOpportunity, 
  updateOpportunityStatus,
  updateOpportunity,
  markOpportunityAsLost
} from '../supabase/opportunities';
