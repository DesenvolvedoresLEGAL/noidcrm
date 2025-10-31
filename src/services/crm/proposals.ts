// Re-export functions from Supabase service
export {
  sendProposal,
  getProposal,
  createProposal,
  updateProposal,
  deleteProposal,
  listProposals,
  generateProposalPDF,
  sendProposalEmail,
} from '../supabase/proposals';
