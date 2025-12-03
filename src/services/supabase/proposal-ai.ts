import { supabase } from '@/integrations/supabase/client';

export interface ProposalIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'pricing' | 'dates' | 'content' | 'completeness';
  message: string;
  suggestion: string;
}

export interface ProposalAnalysis {
  issues: ProposalIssue[];
  score: number;
  summary: string;
}

export interface PricingSuggestion {
  minPrice: number;
  maxPrice: number;
  recommendedPrice: number;
  conversionRate: number;
  reasoning: string;
}

export interface ClientSentiment {
  viewCount: number;
  avgViewDuration: number;
  mostViewedSection: string;
  sentiment: 'positive' | 'neutral' | 'concerned';
  insights: string[];
}

/**
 * Generate professional introduction for proposal using AI
 */
export async function generateIntroduction(params: {
  accountName: string;
  segment?: string;
  product?: string;
  value?: number;
  clientName?: string;
  // Extended context for richer personalization
  companySize?: string;
  city?: string;
  state?: string;
  cnae?: string;
  contactRole?: string;
  opportunityStage?: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-generate-proposal-intro', {
    body: params,
  });

  if (error) {
    console.error('Error generating introduction:', error);
    throw new Error('Falha ao gerar introdução');
  }

  return data.introduction;
}

/**
 * Analyze proposal for inconsistencies and issues
 */
export async function analyzeProposal(
  proposalId: string,
  proposalData: any
): Promise<ProposalAnalysis> {
  const { data, error } = await supabase.functions.invoke('ai-analyze-proposal', {
    body: { proposalId, proposalData },
  });

  if (error) {
    console.error('Error analyzing proposal:', error);
    throw new Error('Falha ao analisar proposta');
  }

  return data as ProposalAnalysis;
}

/**
 * Get AI pricing suggestions based on historical data
 */
export async function suggestPricing(
  accountId: string,
  opportunityId: string,
  currentValue?: number
): Promise<PricingSuggestion> {
  try {
    // Get historical proposals for similar accounts
    const { data: account } = await supabase
      .from('accounts')
      .select('segmento, tamanho')
      .eq('id', accountId)
      .single();

    // Get organization ID
    const orgId = await supabase.rpc('get_user_organization_id');

    // Find similar accounts
    let similarQuery = supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', orgId.data)
      .limit(20);

    if (account?.segmento) {
      similarQuery = similarQuery.eq('segmento', account.segmento);
    }

    const { data: similarAccounts } = await similarQuery;
    const accountIds = similarAccounts?.map(a => a.id) || [];

    // Get opportunities from similar accounts
    const { data: opportunities } = await supabase
      .from('opportunities')
      .select('id')
      .in('account_id', accountIds);

    const opportunityIds = opportunities?.map(o => o.id) || [];

    // Get accepted proposals from those opportunities
    const { data: proposals } = await supabase
      .from('proposals')
      .select('value')
      .in('opportunity_id', opportunityIds)
      .eq('status', 'accepted')
      .not('value', 'is', null);

    if (!proposals || proposals.length === 0) {
      return {
        minPrice: currentValue ? currentValue * 0.8 : 0,
        maxPrice: currentValue ? currentValue * 1.2 : 0,
        recommendedPrice: currentValue || 0,
        conversionRate: 0,
        reasoning: 'Sem dados históricos suficientes para sugestão de preço.',
      };
    }

    // Calculate statistics
    const values = proposals.map(p => p.value).filter(Boolean) as number[];
    const sortedValues = values.sort((a, b) => a - b);
    const minPrice = sortedValues[0];
    const maxPrice = sortedValues[sortedValues.length - 1];
    const avgPrice = values.reduce((a, b) => a + b, 0) / values.length;
    const medianPrice = sortedValues[Math.floor(sortedValues.length / 2)];

    // Calculate conversion rate (simplified)
    const conversionRate = (proposals.length / (accountIds.length + 1)) * 100;

    return {
      minPrice,
      maxPrice,
      recommendedPrice: medianPrice,
      conversionRate,
      reasoning: `Baseado em ${proposals.length} propostas aceitas para clientes similares. Preço médio: R$ ${avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
    };
  } catch (error) {
    console.error('Error suggesting pricing:', error);
    throw new Error('Falha ao sugerir preços');
  }
}

/**
 * Analyze client sentiment based on proposal views
 */
export async function getClientSentimentAnalysis(proposalId: string): Promise<ClientSentiment> {
  try {
    // Get proposal views
    const { data: views } = await supabase
      .from('proposal_views')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('viewed_at', { ascending: false });

    if (!views || views.length === 0) {
      return {
        viewCount: 0,
        avgViewDuration: 0,
        mostViewedSection: 'Nenhuma',
        sentiment: 'neutral',
        insights: ['Proposta ainda não foi visualizada pelo cliente.'],
      };
    }

    const viewCount = views.length;
    const durations = views.map(v => v.duration_seconds || 0);
    const avgViewDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Determine sentiment based on patterns
    let sentiment: 'positive' | 'neutral' | 'concerned' = 'neutral';
    const insights: string[] = [];

    if (viewCount >= 5) {
      sentiment = 'concerned';
      insights.push(`Cliente visualizou a proposta ${viewCount} vezes - pode indicar dúvidas ou objeções.`);
    } else if (viewCount >= 2 && avgViewDuration > 120) {
      sentiment = 'positive';
      insights.push('Cliente dedicou tempo significativo analisando a proposta.');
    }

    if (avgViewDuration < 30) {
      insights.push('Tempo de visualização baixo - considere simplificar ou destacar pontos principais.');
    }

    // Analyze view patterns (mock data for now - would need more detailed tracking)
    const mostViewedSection = 'Preços e Condições';

    if (viewCount > 3) {
      insights.push('Múltiplas visualizações podem indicar compartilhamento interno - boa sinal!');
    }

    return {
      viewCount,
      avgViewDuration,
      mostViewedSection,
      sentiment,
      insights,
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    throw new Error('Falha ao analisar sentimento do cliente');
  }
}
