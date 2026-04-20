import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { proposalId, proposalData } = await req.json();

    console.log('Analyzing proposal:', proposalId);

    // Get proposal items and payment terms
    const { data: items } = await supabase
      .from('proposal_items')
      .select('*')
      .eq('proposal_id', proposalId);

    const { data: paymentTerms } = await supabase
      .from('proposal_payment_terms')
      .select('*')
      .eq('proposal_id', proposalId);

    // Calculate totals
    const itemsTotal = items?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const paymentTotal = paymentTerms?.reduce((sum, term) => sum + (term.amount || 0), 0) || 0;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `Analise esta proposta comercial e identifique inconsistências, erros ou melhorias necessárias:

Dados da Proposta:
- Título: ${proposalData.title}
- Valor Total Declarado: R$ ${proposalData.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
- Data de Expiração: ${proposalData.expires_at || 'não definida'}
- Número de Itens: ${items?.length || 0}
- Soma dos Itens: R$ ${itemsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Número de Parcelas: ${paymentTerms?.length || 0}
- Soma das Parcelas: R$ ${paymentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Tem Introdução: ${proposalData.introduction ? 'Sim' : 'Não'}
- Tem Termos: ${proposalData.terms ? 'Sim' : 'Não'}

Verifique:
1. Se valor total confere com soma dos itens
2. Se soma das parcelas confere com valor total
3. Se data de validade já passou ou está muito próxima
4. Se faltam campos importantes (introdução, termos)
5. Se há itens sem descrição ou preço
6. Se proposta está completa e profissional

Responda em formato JSON com:
{
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "category": "pricing" | "dates" | "content" | "completeness",
      "message": "Descrição do problema",
      "suggestion": "Como corrigir"
    }
  ],
  "score": 0-100,
  "summary": "Resumo geral da análise"
}`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: 'Você é um auditor especializado em propostas comerciais. Sempre responda em JSON válido.' },
          { role: 'user', content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_proposal",
              description: "Analisa uma proposta comercial e retorna problemas encontrados",
              parameters: {
                type: "object",
                properties: {
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        severity: { type: "string", enum: ["error", "warning", "info"] },
                        category: { type: "string", enum: ["pricing", "dates", "content", "completeness"] },
                        message: { type: "string" },
                        suggestion: { type: "string" }
                      },
                      required: ["severity", "category", "message", "suggestion"]
                    }
                  },
                  score: { type: "number", minimum: 0, maximum: 100 },
                  summary: { type: "string" }
                },
                required: ["issues", "score", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_proposal" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error('Failed to analyze proposal');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let analysis;
    if (toolCall?.function?.arguments) {
      analysis = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback se não usar tool calling
      const content = aiData.choices?.[0]?.message?.content || '{}';
      analysis = JSON.parse(content);
    }

    return new Response(
      JSON.stringify(analysis),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in ai-analyze-proposal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao analisar proposta',
        issues: [],
        score: 0,
        summary: 'Erro na análise'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
