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

// Map dimension keys to video tags
const DIMENSION_TO_TAGS: { [key: string]: string[] } = {
  'Discovery': ['Discovery', 'SPIN', 'Perguntas'],
  'ObjectionHandling': ['Objections', 'Objeções'],
  'ValueArticulation': ['ROI', 'Valor', 'Storytelling'],
  'NextStep': ['Closing', 'Fechamento'],
  'ProfessionalTone': ['Comunicação', 'Rapport'],
  'Metrics': ['ROI', 'Métricas'],
  'EconomicBuyer': ['Discovery', 'Decisores'],
  'DecisionCriteria': ['Qualificação', 'MEDDIC'],
  'IdentifyPain': ['Discovery', 'Dores'],
  'Champion': ['Relacionamento', 'Networking']
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sessionId, sellerId, scoresJson } = await req.json();

    console.log(`Recommending videos for session ${sessionId}, seller ${sellerId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get organization_id from seller
    const { data: seller } = await supabase
      .from('sellers')
      .select('organization_id')
      .eq('id', sellerId)
      .single();

    if (!seller) {
      throw new Error('Seller not found');
    }

    // Identify weak dimensions (score < 8.0)
    const weakDimensions = scoresJson.dimensions
      .filter((d: any) => d.score < 8.0)
      .sort((a: any, b: any) => a.score - b.score) // Weakest first
      .slice(0, 3); // Top 3 weakest

    if (weakDimensions.length === 0) {
      console.log('No weak dimensions, no videos to recommend');
      return new Response(
        JSON.stringify({ success: true, videos: [], reasoning: 'Performance excelente em todas dimensões!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Map dimensions to tags
    const relevantTags = new Set<string>();
    weakDimensions.forEach((d: any) => {
      const tags = DIMENSION_TO_TAGS[d.key] || [];
      tags.forEach(tag => relevantTags.add(tag));
    });

    console.log('Searching videos with tags:', Array.from(relevantTags));

    // Query video library
    const { data: allVideos } = await supabase
      .from('video_library')
      .select('*')
      .eq('organization_id', seller.organization_id);

    if (!allVideos || allVideos.length === 0) {
      console.log('No videos in library');
      return new Response(
        JSON.stringify({ success: true, videos: [], reasoning: 'Biblioteca de vídeos vazia' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Filter videos by tags
    const matchingVideos = allVideos.filter(video => {
      const videoTags = video.tags || [];
      return videoTags.some((tag: string) => relevantTags.has(tag));
    });

    if (matchingVideos.length === 0) {
      console.log('No matching videos found');
      return new Response(
        JSON.stringify({ success: true, videos: [], reasoning: 'Nenhum vídeo encontrado para suas áreas de desenvolvimento' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Use AI to rank top 3 videos
    const systemPrompt = `Você é um especialista em treinamento de vendas que recomenda vídeos de aprimoramento.

DIMENSÕES FRACAS DO VENDEDOR:
${weakDimensions.map((d: any) => `- ${d.key}: ${d.score}/10 - ${d.feedback || ''}`).join('\n')}

VÍDEOS DISPONÍVEIS:
${matchingVideos.map((v, i) => `${i + 1}. "${v.title}" (${v.duration_sec}s) - Nível: ${v.level} - Tags: ${v.tags?.join(', ')}`).join('\n')}

Selecione os 3 vídeos mais relevantes para este vendedor melhorar suas dimensões fracas.`;

    const userPrompt = `Retorne APENAS JSON (sem markdown):
{
  "recommendations": [
    {
      "video_id": "uuid do vídeo",
      "reasoning": "Por que este vídeo ajudará (1 frase)"
    }
  ],
  "overall_reasoning": "Resumo da estratégia de desenvolvimento (2-3 frases)"
}

Selecione no máximo 3 vídeos mais impactantes.`;

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
        temperature: 0.3,
      }),
    });

    let recommendations;
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const aiContent = aiData.choices[0].message.content;
      try {
        const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        recommendations = JSON.parse(cleanContent);
      } catch (e) {
        console.error('Failed to parse AI recommendations, using fallback');
        recommendations = null;
      }
    }

    // Fallback: simple ranking if AI fails
    if (!recommendations) {
      const topVideos = matchingVideos.slice(0, 3);
      recommendations = {
        recommendations: topVideos.map(v => ({
          video_id: v.id,
          reasoning: `Vídeo sobre ${v.tags?.[0] || 'desenvolvimento'} para melhorar sua performance`
        })),
        overall_reasoning: `Foque nestas áreas: ${weakDimensions.map((d: any) => d.key).join(', ')}`
      };
    }

    // Get full video details
    const videoIds = recommendations.recommendations.map((r: any) => r.video_id);
    const recommendedVideos = matchingVideos
      .filter(v => videoIds.includes(v.id))
      .slice(0, 3);

    // Insert recommendation record
    const { error: insertError } = await supabase
      .from('video_recommendations')
      .insert({
        seller_id: sellerId,
        session_id: sessionId,
        recommended_at: new Date().toISOString(),
        reasoning: recommendations.overall_reasoning,
        video_ids: videoIds,
        viewed: false,
        organization_id: seller.organization_id
      });

    if (insertError) {
      console.error('Error inserting recommendation:', insertError);
    }

    console.log(`Recommended ${recommendedVideos.length} videos for seller ${sellerId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        videos: recommendedVideos,
        reasoning: recommendations.overall_reasoning,
        details: recommendations.recommendations
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error recommending videos:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
