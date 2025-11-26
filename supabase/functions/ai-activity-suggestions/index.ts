import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

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

    const aiPrompt = `Based on the following context, suggest improvements for a ${activityType} activity:

Historical Data:
- Average successful duration: ${avgDuration} minutes
- Best time for this type: ${bestHour}:00
- Common titles: ${commonTitles.slice(0, 5).join(', ')}
- Sample descriptions: ${commonDescriptions.slice(0, 3).join(' | ')}

Current Context:
${JSON.stringify(context, null, 2)}

Provide concise suggestions in JSON format:
{
  "suggestedTime": "HH:mm (based on success patterns)",
  "suggestedDuration": number (in minutes),
  "titleSuggestion": "string (if applicable)",
  "descriptionTemplate": "string (helpful template)",
  "tips": ["string", "string"]
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
            content: 'You are an AI assistant that analyzes activity patterns and provides intelligent suggestions for CRM activities. Always respond with valid JSON only.'
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
    return new Response(
      JSON.stringify({ error: 'Failed to generate suggestions' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
