import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { accountKeys } from '@/lib/query-keys';

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
  // Novos campos
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  natureza_juridica: string | null;
  porte: string | null;
  situacao_cadastral: string | null;
  data_situacao_cadastral: string | null;
  data_fundacao: string | null;
  capital_social: number | null;
  matriz_filial: string | null;
  cnaes_secundarios: string[] | null;
  opcao_simples: boolean | null;
  opcao_mei: boolean | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  telefones: any;
  emails: string[] | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  owner_user_id: string | null;
  cs_user_id: string | null;
  pre_sales_user_id: string | null;
  tipo_empresa: string | null;
  data_tornou_cliente: string | null;
  pontuacao_nps: number | null;
  email_nota_fiscal: string | null;
  codigo_externo: string | null;
  logo_url: string | null;
  observacoes: string | null;
  // Scoring fields
  lead_score: number | null;
  fit_score: number | null;
  intent_score: number | null;
  lead_grade: string | null;
  score_updated_at: string | null;
  scoring_factors: any;
  // Financial scoring (ERP)
  score_financeiro: number | null;
  risco_financeiro: string | null;
  score_fatores: Record<string, unknown> | null;
  score_calculado_em: string | null;
  total_titulos: number | null;
  titulos_pagos: number | null;
  titulos_vencidos: number | null;
  taxa_pagamento_pct: number | null;
  valor_total: number | null;
  valor_vencido: number | null;
  erp_sync_at: string | null;
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
  // Métricas separadas por tipo de pipeline
  sales_opportunities_open: number;
  sales_opportunities_won: number;
  sales_pipeline_value: number;
  sales_won_value: number;
  cs_opportunities_open: number;
  cs_opportunities_count: number;
}

export function useAccountDetails(accountId: string) {
  return useQuery({
    queryKey: accountKeys.detailExtended(accountId),
    queryFn: async () => {
      // PERF 0.6D: campos JSONB pesados (`scoring_factors`, `score_fatores`)
      // saíram do payload principal e agora são carregados sob demanda via
      // `useAccountFinancialDetails`. Os demais escalares de score/ERP
      // permanecem aqui porque a aba Overview os exibe por padrão.
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id, organization_id, razao_social, nome_fantasia, cnpj, segmento, tamanho, cnae, origem_principal, created_at, updated_at, inscricao_estadual, inscricao_municipal, natureza_juridica, porte, situacao_cadastral, data_situacao_cadastral, data_fundacao, capital_social, matriz_filial, cnaes_secundarios, opcao_simples, opcao_mei, logradouro, numero, complemento, bairro, cidade, uf, cep, latitude, longitude, telefones, emails, website, linkedin, instagram, facebook, owner_user_id, cs_user_id, pre_sales_user_id, tipo_empresa, data_tornou_cliente, pontuacao_nps, email_nota_fiscal, codigo_externo, logo_url, observacoes, lead_score, fit_score, intent_score, lead_grade, score_updated_at, score_financeiro, risco_financeiro, score_calculado_em, total_titulos, titulos_pagos, titulos_vencidos, taxa_pagamento_pct, valor_total, valor_vencido, erp_sync_at')
        .eq('id', accountId)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!account) throw new Error('Conta não encontrada');


      // Buscar contagem de oportunidades por status COM pipeline_type
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('status, valor_previsto, origem, qualified_by_user_id, created_at, pipeline:pipelines(pipeline_type)')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      // Hidratação dinâmica: se a conta não tiver origem ou pré-vendedor,
      // herdar do registro mais recente da oportunidade que tiver valor.
      const accountAny = account as Record<string, unknown>;
      let hydratedOrigem = (accountAny.origem_principal as string | null) ?? null;
      let hydratedPreSales = (accountAny.pre_sales_user_id as string | null) ?? null;
      if (!hydratedOrigem) {
        const opWithOrigin = opportunities?.find((o) => !!(o as any).origem);
        if (opWithOrigin) hydratedOrigem = (opWithOrigin as any).origem;
      }
      if (!hydratedPreSales) {
        const opWithSdr = opportunities?.find((o) => !!(o as any).qualified_by_user_id);
        if (opWithSdr) hydratedPreSales = (opWithSdr as any).qualified_by_user_id;
      }

      // Filtrar apenas oportunidades de pipelines de vendas (sales) para métricas de valor
      const salesOpportunities = opportunities?.filter(o => o.pipeline?.pipeline_type === 'sales') || [];
      
      // Contagens incluem todas as oportunidades (para visibilidade geral)
      const opportunitiesOpen = opportunities?.filter(o => o.status !== 'won' && o.status !== 'lost').length || 0;
      const opportunitiesWon = opportunities?.filter(o => o.status === 'won').length || 0;
      const opportunitiesLost = opportunities?.filter(o => o.status === 'lost').length || 0;
      
      // Valores de pipeline = apenas de pipelines de vendas (não CS/onboarding)
      const pipelineValue = salesOpportunities
        .filter(o => o.status !== 'won' && o.status !== 'lost')
        .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);
      const wonValue = salesOpportunities
        .filter(o => o.status === 'won')
        .reduce((sum, o) => sum + (o.valor_previsto || 0), 0);

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

      // Buscar contagem de contratos (excluir soft-deletados)
      const { count: contractsCount } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .is('deleted_at', null);

      // Métricas CS/Onboarding (pipelines não-vendas)
      const csOpportunities = opportunities?.filter(o => o.pipeline?.pipeline_type !== 'sales') || [];
      const csOpportunitiesOpen = csOpportunities.filter(o => o.status !== 'won' && o.status !== 'lost').length;

      return {
        ...account,
        // PERF 0.6D: JSONBs pesados resolvidos via `useAccountFinancialDetails` sob demanda.
        scoring_factors: null,
        score_fatores: null,
        origem_principal: hydratedOrigem,
        pre_sales_user_id: hydratedPreSales,
        opportunities_count: (opportunities?.length || 0),
        opportunities_open: opportunitiesOpen,
        opportunities_won: opportunitiesWon,
        opportunities_lost: opportunitiesLost,
        pipeline_value: pipelineValue,
        won_value: wonValue,
        contacts_count: contactsCount || 0,
        activities_count: activitiesCount || 0,
        contracts_count: contractsCount || 0,
        // Métricas separadas
        sales_opportunities_open: salesOpportunities.filter(o => o.status !== 'won' && o.status !== 'lost').length,
        sales_opportunities_won: salesOpportunities.filter(o => o.status === 'won').length,
        sales_pipeline_value: pipelineValue,
        sales_won_value: wonValue,
        cs_opportunities_open: csOpportunitiesOpen,
        cs_opportunities_count: csOpportunities.length,
      } as AccountDetails;
    },
    enabled: !!accountId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

