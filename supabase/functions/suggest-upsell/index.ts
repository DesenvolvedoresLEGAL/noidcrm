import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpsellOpportunity {
  accountId: string;
  accountName: string;
  currentProducts: string[];
  suggestedProducts: string[];
  reasons: string[];
  estimatedValue: number;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organizationId, accountId } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[suggest-upsell] Processing for org:', organizationId, 'account:', accountId || 'all');

    // Fetch active clients
    const accountQuery = supabase
      .from('accounts')
      .select('id, nome_fantasia, razao_social, lifecycle_stage, data_tornou_cliente, pontuacao_nps, segmento, porte')
      .eq('organization_id', organizationId)
      .eq('lifecycle_stage', 'Cliente');

    if (accountId) {
      accountQuery.eq('id', accountId);
    }

    const { data: accounts, error: accountsError } = await accountQuery;

    if (accountsError) {
      console.error('[suggest-upsell] Error fetching accounts:', accountsError);
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: [], message: 'No active clients found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch products catalog
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price, category_id')
      .eq('organization_id', organizationId)
      .eq('active', true);

    // Fetch won opportunities with items
    const { data: wonOpps } = await supabase
      .from('opportunities')
      .select(`
        id,
        account_id,
        valor_previsto
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'won');

    // Fetch proposal items for won opportunities
    const wonOppIds = wonOpps?.map(o => o.id) || [];
    const { data: proposalItems } = await supabase
      .from('proposal_items')
      .select(`
        product_id,
        proposal:proposals(opportunity_id)
      `)
      .in('proposal.opportunity_id', wonOppIds.length > 0 ? wonOppIds : ['no-match']);

    // Build map of products per account
    const accountProducts: Record<string, Set<string>> = {};
    proposalItems?.forEach(item => {
      const oppId = (item.proposal as any)?.opportunity_id;
      if (oppId && item.product_id) {
        const opp = wonOpps?.find(o => o.id === oppId);
        if (opp) {
          if (!accountProducts[opp.account_id]) {
            accountProducts[opp.account_id] = new Set();
          }
          accountProducts[opp.account_id].add(item.product_id);
        }
      }
    });

    // Fetch health metrics (last NPS for each account)
    const { data: healthMetrics } = await supabase
      .from('cs_health_metrics')
      .select('account_id, score, metric_type')
      .eq('organization_id', organizationId)
      .eq('metric_type', 'nps')
      .order('survey_date', { ascending: false });

    const accountNPS: Record<string, number> = {};
    healthMetrics?.forEach(m => {
      if (!accountNPS[m.account_id]) {
        accountNPS[m.account_id] = m.score;
      }
    });

    // Fetch recent activities
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentActivities } = await supabase
      .from('activities')
      .select('account_id')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo);

    const accountActivityCount: Record<string, number> = {};
    recentActivities?.forEach(a => {
      if (a.account_id) {
        accountActivityCount[a.account_id] = (accountActivityCount[a.account_id] || 0) + 1;
      }
    });

    // Calculate upsell opportunities
    const suggestions: UpsellOpportunity[] = [];

    for (const account of accounts) {
      const reasons: string[] = [];
      let confidence = 50;
      let priority: 'high' | 'medium' | 'low' = 'low';

      // Check NPS (promoters are good upsell candidates)
      const nps = accountNPS[account.id] || account.pontuacao_nps;
      if (nps !== undefined && nps !== null) {
        if (nps >= 9) {
          reasons.push('Cliente promotor (NPS 9-10)');
          confidence += 25;
          priority = 'high';
        } else if (nps >= 7) {
          reasons.push('Cliente neutro satisfeito (NPS 7-8)');
          confidence += 10;
          if (priority === 'low') priority = 'medium';
        }
      }

      // Check engagement (activity count)
      const activityCount = accountActivityCount[account.id] || 0;
      if (activityCount >= 5) {
        reasons.push(`Alto engajamento (${activityCount} atividades em 30d)`);
        confidence += 15;
        if (priority === 'low') priority = 'medium';
      }

      // Check tenure (older clients are more stable)
      if (account.data_tornou_cliente) {
        const tenure = Math.floor((Date.now() - new Date(account.data_tornou_cliente).getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (tenure >= 6) {
          reasons.push(`Cliente há ${tenure} meses`);
          confidence += 10;
        }
      }

      // Check for cross-sell opportunities
      const currentProductIds = accountProducts[account.id] || new Set();
      const currentProductNames: string[] = [];
      const suggestedProducts: string[] = [];
      let estimatedValue = 0;

      products?.forEach(product => {
        if (currentProductIds.has(product.id)) {
          currentProductNames.push(product.name);
        } else {
          // Suggest products not yet purchased
          suggestedProducts.push(product.name);
          estimatedValue += product.price || 0;
        }
      });

      if (suggestedProducts.length > 0 && currentProductNames.length > 0) {
        reasons.push(`Possui ${currentProductNames.length} produto(s), pode expandir para +${suggestedProducts.length}`);
        confidence += 10;
      }

      // Only include if there are reasons and products to suggest
      if (reasons.length > 0 && suggestedProducts.length > 0) {
        suggestions.push({
          accountId: account.id,
          accountName: account.nome_fantasia || account.razao_social,
          currentProducts: currentProductNames.slice(0, 5),
          suggestedProducts: suggestedProducts.slice(0, 5),
          reasons,
          estimatedValue: Math.min(estimatedValue, 100000), // Cap for realism
          confidence: Math.min(confidence, 95),
          priority
        });
      }
    }

    // Sort by priority and confidence
    suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    const topSuggestions = suggestions.slice(0, 20);

    console.log('[suggest-upsell] Generated', topSuggestions.length, 'suggestions');

    return new Response(
      JSON.stringify({ 
        suggestions: topSuggestions,
        summary: {
          totalAnalyzed: accounts.length,
          totalSuggestions: suggestions.length,
          highPriority: suggestions.filter(s => s.priority === 'high').length,
          estimatedTotalValue: suggestions.reduce((sum, s) => sum + s.estimatedValue, 0)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[suggest-upsell] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
