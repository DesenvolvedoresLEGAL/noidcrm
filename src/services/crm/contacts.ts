// Re-export functions from Supabase service
export {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  searchContacts,
  linkToAccount,
  type Contact,
} from '../supabase/contacts';
