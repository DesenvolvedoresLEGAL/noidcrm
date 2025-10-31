// Re-export all from Supabase service
export {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  getDefaultTemplate,
} from '../supabase/proposal-templates';

export type { ProposalTemplate } from '../supabase/proposal-templates';
