// Re-export functions from Supabase service
export { 
  listOpportunities, 
  getOpportunity, 
  createOpportunity, 
  advanceOpportunity, 
  moveOpportunity, 
  updateOpportunityStatus,
  updateOpportunity,
  markOpportunityAsLost,
  markOpportunityAsWon,
  deleteOpportunity
} from '../supabase/opportunities';
