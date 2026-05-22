import { supabase } from '@/integrations/supabase/client';
import { formatPersonName } from '@/lib/contactFormat';

export interface CreatePersonAccountInput {
  firstName: string;
  lastName?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  organizationId: string;
}

export interface CreatePersonAccountResult {
  account_id: string;
  contact_id: string;
  account_name: string;
  reused: boolean;
}

/**
 * Find or create a PF (pessoa física) account + linked contact.
 * - If CPF is provided and an existing PF account matches, it is reused.
 * - Otherwise creates a new account with tipo_pessoa='PF' and an associated contact.
 */
export async function findOrCreatePersonAccount(
  input: CreatePersonAccountInput
): Promise<CreatePersonAccountResult> {
  const firstName = formatPersonName(input.firstName.trim());
  const lastName = formatPersonName((input.lastName || '').trim());
  const fullName = (firstName + (lastName ? ' ' + lastName : '')).trim();

  if (!fullName) {
    throw new Error('Nome é obrigatório');
  }

  const cpfClean = input.cpf?.replace(/\D/g, '') || '';

  // Try to find existing PF account by CPF
  if (cpfClean) {
    const { data: existing } = await supabase
      .from('accounts')
      .select('id, razao_social')
      .eq('organization_id', input.organizationId)
      .eq('tipo_pessoa', 'PF')
      .eq('cpf', cpfClean)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      // Find or create linked contact
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('account_id', existing.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingContact) {
        return {
          account_id: existing.id,
          contact_id: existingContact.id,
          account_name: existing.razao_social,
          reused: true,
        };
      }

      const contactId = await createLinkedContact({
        accountId: existing.id,
        firstName,
        lastName,
        email: input.email,
        phone: input.phone,
        organizationId: input.organizationId,
      });

      return {
        account_id: existing.id,
        contact_id: contactId,
        account_name: existing.razao_social,
        reused: true,
      };
    }
  }

  // Create new PF account
  const accountInsert: any = {
    organization_id: input.organizationId,
    tipo_pessoa: 'PF',
    razao_social: fullName,
    nome_fantasia: fullName,
  };
  if (cpfClean) accountInsert.cpf = cpfClean;
  if (input.email?.trim()) accountInsert.emails = [input.email.trim()];
  if (input.phone?.trim()) accountInsert.telefones = [input.phone.trim()];

  const { data: newAccount, error: accountErr } = await supabase
    .from('accounts')
    .insert(accountInsert)
    .select('id, razao_social')
    .single();

  if (accountErr) throw accountErr;

  const contactId = await createLinkedContact({
    accountId: newAccount.id,
    firstName,
    lastName,
    email: input.email,
    phone: input.phone,
    organizationId: input.organizationId,
  });

  return {
    account_id: newAccount.id,
    contact_id: contactId,
    account_name: newAccount.razao_social,
    reused: false,
  };
}

async function createLinkedContact(args: {
  accountId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organizationId: string;
}): Promise<string> {
  const contactInsert: any = {
    organization_id: args.organizationId,
    account_id: args.accountId,
    primeiro_nome: args.firstName,
    ultimo_nome: args.lastName || null,
    nome: (args.firstName + (args.lastName ? ' ' + args.lastName : '')).trim(),
    is_primary: true,
  };
  if (args.email?.trim()) contactInsert.emails = [args.email.trim()];
  if (args.phone?.trim()) contactInsert.telefones = [args.phone.trim()];

  const { data, error } = await supabase
    .from('contacts')
    .insert(contactInsert)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
