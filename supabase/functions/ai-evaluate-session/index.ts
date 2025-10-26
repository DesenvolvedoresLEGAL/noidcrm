import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://api.lovable.app/v1/ai/chat';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, rubricId, messages } = await req.json();

    console.log(`Evaluating session ${sessionId} with rubric ${rubricId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch evaluation rubric
    const { data: rubric, error: rubricError } = await supabase
      .from('evaluation_rubrics')
      .select('*')
      .eq('id', rubricId)
      .single();

    if (rubricError || !rubric) {
      throw new Error('Rubric not found');
    }

    // Build conversation for evaluation
    const conversation = messages
      .map((msg: any) => `${msg.sender === 'seller' ? 'VENDEDOR' : 'CLIENTE'}: ${msg.text}`)
      .join('\n\n');

    // Build evaluation prompt
    const systemPrompt = `Você é um avaliador especialista de técnicas de vendas consultiva.

RUBRICA DE AVALIAÇÃO: ${rubric.name}

DIMENSÕES (cada uma vale até 10 pontos):
${JSON.stringify(rubric.dimensions, null, 2)}

Nota de corte para aprovação: ${rubric.passing_score}

INSTRUÇÕES:
1. Avalie cada dimensão objetivamente de 0 a 10
2. Para cada dimensão, forneça feedback específico com exemplos da conversa
3. Calcule a nota final ponderada
4. Determine se passou (nota >= ${rubric.passing_score})
5. Seja rigoroso mas justo - vendedores precisam de feedback realista`;

    const userPrompt = `Avalie esta conversa de vendas:

${conversation}

Retorne APENAS um JSON com esta estrutura exata (sem markdown):
{
  "dimensions": [
    {
      "key": "nome_da_dimensao",
      "score": 8.5,
      "feedback": "Feedback específico com exemplos",
      "weight": 0.2
    }
  ],
  "overall_score": 8.3,
  "passed": true,
  "summary": "Resumo geral da performance"
}`;

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistent evaluation
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', errorText);
      throw new Error(`AI evaluation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Parse evaluation
    let evaluation;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      evaluation = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI evaluation:', aiContent);
      throw new Error('Invalid evaluation format from AI');
    }

    // Validate evaluation
    if (!evaluation.dimensions || !Array.isArray(evaluation.dimensions)) {
      throw new Error('Invalid evaluation structure');
    }

    // Calculate weighted overall score if not provided
    if (!evaluation.overall_score) {
      const totalWeight = evaluation.dimensions.reduce((sum: number, d: any) => sum + (d.weight || 0), 0);
      const weightedSum = evaluation.dimensions.reduce((sum: number, d: any) => 
        sum + (d.score * (d.weight || 0)), 0
      );
      evaluation.overall_score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    // Determine pass/fail
    evaluation.passed = evaluation.overall_score >= rubric.passing_score;

    // Update session in database
    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({
        score_overall: evaluation.overall_score,
        scores_json: evaluation,
        passed: evaluation.passed,
        finished_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw updateError;
    }

    console.log(`Session ${sessionId} evaluated: ${evaluation.overall_score}/10, Passed: ${evaluation.passed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        evaluation,
        session_id: sessionId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error evaluating session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
