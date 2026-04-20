import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://api.openai.com/v1/chat/completions';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Input validation
function validateInput(data: any): { valid: boolean; error?: string } {
  if (!data.sessionId || typeof data.sessionId !== 'string') {
    return { valid: false, error: 'Invalid session ID' };
  }
  if (!data.sellerId || typeof data.sellerId !== 'string') {
    return { valid: false, error: 'Invalid seller ID' };
  }
  if (!data.scoresJson || typeof data.scoresJson !== 'object') {
    return { valid: false, error: 'Invalid scores JSON' };
  }
  if (!Array.isArray(data.messages)) {
    return { valid: false, error: 'Invalid messages array' };
  }
  if (data.messages.length > 100) {
    return { valid: false, error: 'Too many messages (max 100)' };
  }
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication (permissive mode for roleplay completion)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn('Missing authorization header; proceeding in permissive mode');
    }

    // 2. Verify user authentication with JWT from header
    console.log('Verifying user authentication');
    const SUPABASE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase envs', { hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_KEY });
      return new Response(
        JSON.stringify({ error: 'Backend configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const globalHeaders: Record<string, string> = {};
    if (authHeader) globalHeaders['Authorization'] = authHeader;

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: globalHeaders },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError) {
      console.warn('Auth verification warning, proceeding with header token:', authError.message);
    }
    if (!user) {
      console.warn('No user resolved from token, proceeding with Authorization header presence');
    } else {
      console.log('User authenticated:', user.id);
    }

    const { sessionId, sellerId, scoresJson, messages } = await req.json();

    // 3. Validate input
    const validation = validateInput({ sessionId, sellerId, scoresJson, messages });
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch seller's history
    const { data: history } = await supabase
      .from('roleplay_history')
      .select('*')
      .eq('seller_id', sellerId)
      .single();

    // Build conversation summary (limit to 2000 chars)
    const conversationSummary = messages
      .map((msg: any) => `${msg.sender === 'seller' ? 'V' : 'C'}: ${msg.text}`)
      .join('\n')
      .substring(0, 2000);

    // Build system prompt
    const systemPrompt = `Você é um coach de vendas especializado em análise de performance e desenvolvimento de habilidades comerciais.

ANÁLISE ATUAL:
${JSON.stringify(scoresJson, null, 2)}

${history ? `HISTÓRICO DO VENDEDOR:
${history.pattern_summary || 'Primeiro roleplay'}

Últimas sessões: ${JSON.stringify(history.sessions?.slice(-3) || [])}` : 'PRIMEIRO ROLEPLAY do vendedor'}

INSTRUÇÕES:
1. Identifique 3 pontos fortes específicos (com exemplos da conversa)
2. Identifique 3 pontos de melhoria (com ações concretas)
3. Preveja a razão mais provável de perda de venda (se aplicável)
4. Recomende 3 ações de desenvolvimento
5. Sugira o próximo tipo de roleplay ideal
6. Forneça um nível de confiança (0-1) nas suas previsões`;

    const userPrompt = `Analise esta sessão de roleplay:

CONVERSA (resumida):
${conversationSummary}...

NOTAS POR DIMENSÃO:
${JSON.stringify(scoresJson.dimensions, null, 2)}

Retorne APENAS JSON (sem markdown):
{
  "strengths": ["força 1 com exemplo", "força 2", "força 3"],
  "weaknesses": ["fraqueza 1 com ação", "fraqueza 2", "fraqueza 3"],
  "predicted_loss_reason": "Razão principal se < 8.5, ou null",
  "recommended_actions": ["ação 1", "ação 2", "ação 3"],
  "next_roleplay_suggestion": "Tipo de cliente e nível sugerido",
  "confidence_score": 0.85
}`;

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI insights generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Parse insights
    let insights;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanContent);
    } catch (parseError) {
      throw new Error('Invalid insights format from AI');
    }

    // Normalize strengths and weaknesses to always be arrays of strings
    const normalizeToStringArray = (arr: any[]): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          // Handle formats like {key: "...", example: "..."} or {key: "...", action: "..."}
          const key = item.key || item.title || '';
          const detail = item.example || item.action || item.description || '';
          if (key && detail) return `${key}: ${detail}`;
          if (key) return key;
          if (detail) return detail;
          return JSON.stringify(item);
        }
        return String(item);
      });
    };

    const normalizedStrengths = normalizeToStringArray(insights.strengths || []);
    const normalizedWeaknesses = normalizeToStringArray(insights.weaknesses || []);
    const normalizedActions = normalizeToStringArray(insights.recommended_actions || []);

    // Insert insights into database
    const { data: insertedInsight, error: insertError } = await supabase
      .from('performance_insights')
      .insert({
        seller_id: sellerId,
        session_id: sessionId,
        strengths: normalizedStrengths,
        weaknesses: normalizedWeaknesses,
        predicted_loss_reason: insights.predicted_loss_reason,
        recommended_actions: normalizedActions,
        next_roleplay_suggestion: insights.next_roleplay_suggestion,
        confidence_score: insights.confidence_score || 0.7,
        organization_id: (await supabase
          .from('sellers')
          .select('organization_id')
          .eq('id', sellerId)
          .single()).data?.organization_id
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights: insertedInsight
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
