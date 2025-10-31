// Re-export functions from Supabase service
export {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  searchAccounts,
  type Account,
} from '../supabase/accounts';
