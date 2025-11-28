import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountDetails {
  id: string;
  organization_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  tamanho: string | null;
  cnae: string | null;
  origem_principal: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Métricas agregadas
  opportunities_count: number;
  opportunities_open: number;
  opportunities_won: number;
  opportunities_lost: number;
  pipeline_value: number;
  won_value: number;
  contacts_count: number;
  activities_count: number;
  contracts_count: number;
}

export function useAccountDetails(accountId: string) {
  return useQuery({
    queryKey: ['account-details', accountId],
    queryFn: async () => {
      // Buscar dados da conta
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) throw new Error('Conta não encontrada');

      // Buscar contagem de oportunidades por status
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('status, valor_previsto')
        .eq('account_id', accountId);

      const opportunitiesOpen = opportunities?.filter(o => o.status !== 'won' && o.status !== 'lost').length || 0;
      const opportunitiesWon = opportunities?.filter(o => o.status === 'won').length || 0;
      const opportunitiesLost = opportunities?.filter(o => o.status === 'lost').length || 0;
      const pipelineValue = opportunities?.filter(o => o.status !== 'won' && o.status !== 'lost').reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;
      const wonValue = opportunities?.filter(o => o.status === 'won').reduce((sum, o) => sum + (o.valor_previsto || 0), 0) || 0;

      // Buscar contagem de contatos
      const { count: contactsCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      // Buscar contagem de atividades
      const { count: activitiesCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      // Buscar contagem de contratos
      const { count: contractsCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      return {
        ...account,
        opportunities_count: (opportunities?.length || 0),
        opportunities_open: opportunitiesOpen,
        opportunities_won: opportunitiesWon,
        opportunities_lost: opportunitiesLost,
        pipeline_value: pipelineValue,
        won_value: wonValue,
        contacts_count: contactsCount || 0,
        activities_count: activitiesCount || 0,
        contracts_count: contractsCount || 0,
      } as AccountDetails;
    },
    enabled: !!accountId,
  });
}
