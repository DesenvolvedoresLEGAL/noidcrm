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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { sellerId } = await req.json();

    // Fetch seller data
    const { data: seller } = await supabaseClient
      .from('sellers')
      .select('*')
      .eq('id', sellerId)
      .single();

    // Fetch recent roleplay sessions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions } = await supabaseClient
      .from('roleplay_sessions')
      .select('*')
      .eq('seller_id', sellerId)
      .gte('started_at', thirtyDaysAgo.toISOString())
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false });

    // Fetch performance insights
    const { data: insights } = await supabaseClient
      .from('performance_insights')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch video recommendations
    const { data: videoRecs } = await supabaseClient
      .from('video_recommendations')
      .select('*, video_library(*)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate skill dimensions from sessions
    const skillDimensions: Record<string, number[]> = {};
    sessions?.forEach((session: any) => {
      if (session.score_dimensions) {
        Object.entries(session.score_dimensions).forEach(([dimension, score]) => {
          if (!skillDimensions[dimension]) {
            skillDimensions[dimension] = [];
          }
          skillDimensions[dimension].push(score as number);
        });
      }
    });

    const averageSkills = Object.entries(skillDimensions).map(([name, scores]) => ({
      dimension: name,
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
      totalSessions: scores.length,
    }));

    // Calculate trends
    const weeklyData: Record<string, { scores: number[], count: number }> = {};
    sessions?.forEach((session: any) => {
      const week = new Date(session.started_at).toISOString().slice(0, 10);
      if (!weeklyData[week]) {
        weeklyData[week] = { scores: [], count: 0 };
      }
      if (session.score_overall) {
        weeklyData[week].scores.push(session.score_overall);
        weeklyData[week].count++;
      }
    });

    const trendData = Object.entries(weeklyData)
      .map(([date, data]) => ({
        date,
        avgScore: data.scores.length > 0 
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
          : 0,
        sessions: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Prepare context for AI
    const context = {
      seller: seller ? { name: seller.name, email: seller.email } : null,
      totalSessions: sessions?.length || 0,
      averageScore: sessions?.filter((s: any) => s.score_overall)
        .reduce((acc: number, s: any) => acc + s.score_overall, 0) / 
        (sessions?.filter((s: any) => s.score_overall).length || 1),
      passRate: (sessions?.filter((s: any) => s.passed).length || 0) / (sessions?.length || 1) * 100,
      skills: averageSkills,
      recentInsights: insights?.slice(0, 5).map((i: any) => ({
        type: i.insight_type,
        content: i.content,
      })),
      strengths: insights?.filter((i: any) => i.insight_type === 'strength').map((i: any) => i.content),
      improvements: insights?.filter((i: any) => i.insight_type === 'improvement').map((i: any) => i.content),
    };

    // Generate AI insights
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um Sales Coach AI especializado em desenvolvimento de vendedores. 
Analise os dados de performance e gere insights personalizados em português brasileiro.
Seja específico, prático e motivador. Foque em ações concretas.`
          },
          {
            role: 'user',
            content: `Analise os dados deste vendedor e gere um plano de desenvolvimento personalizado:

${JSON.stringify(context, null, 2)}

Retorne um JSON com esta estrutura:
{
  "greeting": "Saudação personalizada baseada na performance",
  "overallAssessment": "Avaliação geral em 2-3 frases",
  "topStrengths": ["força 1", "força 2", "força 3"],
  "priorityImprovements": ["melhoria 1", "melhoria 2", "melhoria 3"],
  "weeklyGoals": [
    { "goal": "meta específica", "metric": "como medir", "priority": "alta/média/baixa" }
  ],
  "coachingTips": ["dica prática 1", "dica prática 2", "dica prática 3"],
  "motivationalMessage": "Mensagem motivacional personalizada",
  "predictedProgress": "Previsão de progresso se seguir o plano"
}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_coach_insights',
              description: 'Generate personalized coaching insights',
              parameters: {
                type: 'object',
                properties: {
                  greeting: { type: 'string' },
                  overallAssessment: { type: 'string' },
                  topStrengths: { type: 'array', items: { type: 'string' } },
                  priorityImprovements: { type: 'array', items: { type: 'string' } },
                  weeklyGoals: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        goal: { type: 'string' },
                        metric: { type: 'string' },
                        priority: { type: 'string', enum: ['alta', 'média', 'baixa'] }
                      },
                      required: ['goal', 'metric', 'priority']
                    }
                  },
                  coachingTips: { type: 'array', items: { type: 'string' } },
                  motivationalMessage: { type: 'string' },
                  predictedProgress: { type: 'string' }
                },
                required: ['greeting', 'overallAssessment', 'topStrengths', 'priorityImprovements', 'weeklyGoals', 'coachingTips', 'motivationalMessage', 'predictedProgress']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_coach_insights' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error('Failed to generate AI insights');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let coachInsights = {
      greeting: 'Olá! Vamos analisar seu desenvolvimento.',
      overallAssessment: 'Continue praticando para melhorar seus resultados.',
      topStrengths: ['Dedicação aos treinos'],
      priorityImprovements: ['Técnicas de fechamento'],
      weeklyGoals: [{ goal: 'Completar 3 treinos', metric: 'Sessões finalizadas', priority: 'alta' }],
      coachingTips: ['Pratique diariamente', 'Revise seus pontos fracos'],
      motivationalMessage: 'Cada treino te aproxima do sucesso!',
      predictedProgress: 'Com dedicação, você verá melhorias em 2 semanas.'
    };

    if (toolCall?.function?.arguments) {
      try {
        coachInsights = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Error parsing AI response:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        seller,
        stats: {
          totalSessions: sessions?.length || 0,
          averageScore: context.averageScore,
          passRate: context.passRate,
        },
        skills: averageSkills,
        trends: trendData,
        videoRecommendations: videoRecs || [],
        coachInsights,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-sales-coach:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
