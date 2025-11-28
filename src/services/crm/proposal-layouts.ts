// Re-export from Supabase service
export {
  listLayouts,
  getLayout,
  createLayout,
  updateLayout,
  deleteLayout,
  getDefaultLayout,
  uploadLayoutPage,
  deleteLayoutPage,
  reorderPages,
} from '../supabase/proposal-layouts';

export type { ProposalLayout, ProposalLayoutPage } from '../supabase/proposal-layouts';
