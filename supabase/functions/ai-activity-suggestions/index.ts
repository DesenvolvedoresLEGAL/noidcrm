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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[ai-activity-suggestions] No authorization header');
      throw new Error('No authorization header');
    }

    // Use service role key and validate JWT token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[ai-activity-suggestions] Auth error:', userError);
      throw new Error('User not authenticated');
    }

    console.log('[ai-activity-suggestions] User authenticated:', user.id);

    const { activityType, context } = await req.json();

    // Get user's historical activity data
    const { data: historicalActivities } = await supabase
      .from('activities')
      .select('type, title, description, scheduled_date, status, duration_minutes')
      .eq('owner_user_id', user.id)
      .eq('type', activityType)
      .order('created_at', { ascending: false })
      .limit(20);

    // Calculate success patterns
    const completedActivities = historicalActivities?.filter(a => a.status === 'completed') || [];
    const avgDuration = completedActivities.length > 0
      ? Math.round(completedActivities.reduce((sum, a) => sum + (a.duration_minutes || 30), 0) / completedActivities.length)
      : 30;

    // Analyze successful time patterns
    const timePatterns = completedActivities
      .filter(a => a.scheduled_date)
      .map(a => {
        const date = new Date(a.scheduled_date);
        return {
          hour: date.getHours(),
          dayOfWeek: date.getDay(),
        };
      });

    const hourCounts: { [key: number]: number } = {};
    timePatterns.forEach(t => {
      hourCounts[t.hour] = (hourCounts[t.hour] || 0) + 1;
    });

    const bestHour = Object.entries(hourCounts).length > 0
      ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
      : 9; // Default to 9 AM

    // Get common titles and descriptions
    const commonTitles = historicalActivities?.map(a => a.title).filter(Boolean) || [];
    const commonDescriptions = historicalActivities?.map(a => a.description).filter(Boolean) || [];

    // Call Lovable AI for intelligent suggestions
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiPrompt = `Com base no seguinte contexto, sugira melhorias para uma atividade do tipo ${activityType}:

Dados Históricos:
- Duração média de sucesso: ${avgDuration} minutos
- Melhor horário para este tipo: ${bestHour}:00
- Títulos comuns: ${commonTitles.slice(0, 5).join(', ')}
- Exemplos de descrições: ${commonDescriptions.slice(0, 3).join(' | ')}

Contexto Atual:
${JSON.stringify(context, null, 2)}

Forneça sugestões concisas em formato JSON (responda em português do Brasil):
{
  "suggestedTime": "HH:mm (baseado em padrões de sucesso)",
  "suggestedDuration": número (em minutos),
  "titleSuggestion": "string (se aplicável)",
  "descriptionTemplate": "string (template útil em português)",
  "tips": ["dica em português", "dica em português"]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de IA que analisa padrões de atividades e fornece sugestões inteligentes para atividades de CRM. Sempre responda em português do Brasil com JSON válido apenas.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ai-activity-suggestions] AI error:', aiResponse.status, errorText);
      throw new Error('AI suggestion failed');
    }

    const aiData = await aiResponse.json();
    const suggestions = JSON.parse(aiData.choices[0].message.content);

    console.log('[ai-activity-suggestions] Generated suggestions for user:', user.id);

    return new Response(
      JSON.stringify({
        suggestions: {
          ...suggestions,
          historicalAvgDuration: avgDuration,
          historicalBestHour: bestHour,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[ai-activity-suggestions] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate suggestions';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
