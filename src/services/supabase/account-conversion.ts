import { supabase } from '@/integrations/supabase/client';

type TipoPessoa = 'PJ' | 'PF';

export async function convertAccountType(accountId: string, newType: TipoPessoa): Promise<boolean> {
  const { data, error } = await supabase.rpc('convert_account_type', {
    p_account_id: accountId,
    p_new_type: newType,
  });

  if (error) {
    console.error('Error converting account type:', error);
    throw new Error('Erro ao converter tipo de conta');
  }

  return data as boolean;
}
