import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // User-context client for RPC calls that need auth.uid()
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { accountId, opportunityId } = await req.json();

    if (!accountId) {
      throw new Error('Account ID is required');
    }

    console.log('Fetching proposal suggestions for account:', accountId);

    // Get user's organization using user-context client for auth.uid() to work
    const { data: orgId, error: orgError } = await userClient.rpc('get_user_organization_id');
    if (orgError || !orgId) {
      console.error('Organization lookup error:', orgError);
      throw new Error('User must belong to an organization');
    }

    // Fetch historical proposal items for similar accounts
    // 1. Get account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('segmento, tamanho')
      .eq('id', accountId)
      .single();

    if (accountError) {
      console.error('Error fetching account:', accountError);
    }

    // 2. Find similar accounts (same segment or size)
    let similarAccountsQuery = supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', orgId)
      .limit(20);

    if (account?.segmento) {
      similarAccountsQuery = similarAccountsQuery.eq('segmento', account.segmento);
    } else if (account?.tamanho) {
      similarAccountsQuery = similarAccountsQuery.eq('tamanho', account.tamanho);
    }

    const { data: similarAccounts, error: similarError } = await similarAccountsQuery;

    if (similarError) {
      console.error('Error fetching similar accounts:', similarError);
      throw similarError;
    }

    const similarAccountIds = similarAccounts?.map(a => a.id) || [accountId];

    // 3. Get proposal items from similar accounts
    const { data: historicalItems, error: itemsError } = await supabase
      .from('proposal_items')
      .select(`
        product_id,
        name,
        quantity,
        unit_price,
        proposals!inner(
          opportunity_id,
          status,
          opportunities!inner(
            account_id
          )
        )
      `)
      .in('proposals.opportunities.account_id', similarAccountIds)
      .in('proposals.status', ['accepted', 'sent'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (itemsError) {
      console.error('Error fetching historical items:', itemsError);
      throw itemsError;
    }

    // 4. Aggregate and rank items by frequency
    const itemFrequency: Record<string, {
      product_id: string | null;
      product_name: string;
      count: number;
      totalQuantity: number;
      totalPrice: number;
    }> = {};

    for (const item of historicalItems || []) {
      const key = item.product_id || item.name;
      if (!itemFrequency[key]) {
        itemFrequency[key] = {
          product_id: item.product_id,
          product_name: item.name,
          count: 0,
          totalQuantity: 0,
          totalPrice: 0,
        };
      }
      itemFrequency[key].count += 1;
      itemFrequency[key].totalQuantity += item.quantity || 0;
      itemFrequency[key].totalPrice += item.unit_price || 0;
    }

    // 5. Convert to suggestions array and sort by frequency
    const suggestions = Object.values(itemFrequency)
      .map(item => ({
        product_id: item.product_id || '',
        product_name: item.product_name,
        frequency: item.count,
        avg_quantity: Math.round(item.totalQuantity / item.count),
        avg_unit_price: parseFloat((item.totalPrice / item.count).toFixed(2)),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5); // Top 5 suggestions

    // 6. Generate AI-powered message using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiPrompt = `Você é um assistente de vendas. Com base no histórico de propostas para contas similares, os seguintes produtos/serviços foram frequentemente incluídos:

${suggestions.map(s => `- ${s.product_name} (usado ${s.frequency}x, quantidade média: ${s.avg_quantity})`).join('\n')}

Gere uma mensagem curta e amigável (máximo 2 frases) sugerindo ao vendedor que considere adicionar esses itens na proposta atual. Seja direto e útil.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente de vendas amigável e conciso.' },
          { role: 'user', content: aiPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      throw new Error('Failed to generate AI suggestion message');
    }

    const aiData = await aiResponse.json();
    const message = aiData.choices?.[0]?.message?.content || 
      'Propostas similares incluíram os seguintes produtos/serviços que você pode considerar adicionar.';

    return new Response(
      JSON.stringify({
        suggestions,
        message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ai-proposal-suggestions:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [],
        message: '',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
