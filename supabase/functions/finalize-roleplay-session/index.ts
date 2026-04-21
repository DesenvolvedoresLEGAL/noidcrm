import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

declare const EdgeRuntime: { waitUntil(p: Promise<any>): void } | undefined;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization') || '';
    const { sessionId } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[finalize-roleplay-session] Starting for session:', sessionId);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: mark finished_at IMMEDIATELY so session leaves "active" state
    await adminClient
      .from('roleplay_sessions')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Fetch session + messages
    const { data: session, error: sessionError } = await adminClient
      .from('roleplay_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[finalize-roleplay-session] Session not found:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: messagesRaw } = await adminClient
      .from('roleplay_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    const messages = (messagesRaw || []).map((m: any) => ({
      sender: m.sender,
      text: m.content,
    }));

    const invokeOpts = {
      headers: authHeader ? { Authorization: authHeader } : {},
    };

    // Step 2: run evaluate + videos in PARALLEL (these affect the summary screen)
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { persistSession: false },
    });

    console.log('[finalize-roleplay-session] Running evaluate + videos in parallel');

    const [evalResult, videosResult] = await Promise.allSettled([
      userClient.functions.invoke('ai-evaluate-session', {
        body: {
          sessionId,
          rubricId: session.rubric_id,
          messages,
        },
      }),
      // videos can run with placeholder scores; will refresh after eval if needed
      // We just kick it off; not blocking the user
      Promise.resolve({ data: null, error: null }),
    ]);

    let evaluation: any = null;
    if (evalResult.status === 'fulfilled' && !evalResult.value.error) {
      evaluation = evalResult.value.data?.evaluation;
      console.log('[finalize-roleplay-session] Evaluation OK, score:', evaluation?.overall_score);
    } else {
      const err = evalResult.status === 'fulfilled' ? evalResult.value.error : evalResult.reason;
      console.error('[finalize-roleplay-session] Evaluation failed:', err);
    }

    // Step 3: background work — DO NOT block response
    const backgroundWork = async () => {
      try {
        const tasks: Promise<any>[] = [];

        // videos (now with real scores if available)
        tasks.push(
          userClient.functions.invoke('ai-recommend-videos', {
            body: {
              sessionId,
              sellerId: session.seller_id,
              scoresJson: evaluation,
            },
          }).catch((e) => console.error('[bg] videos error:', e))
        );

        // insights
        if (evaluation) {
          tasks.push(
            userClient.functions.invoke('ai-generate-insights', {
              body: {
                sessionId,
                sellerId: session.seller_id,
                scoresJson: evaluation,
                messages: messagesRaw,
                organizationId: session.organization_id,
              },
            }).catch((e) => console.error('[bg] insights error:', e))
          );
        }

        // gamification
        tasks.push(
          userClient.functions.invoke('gamification-engine', {
            body: { sellerId: session.seller_id, sessionId },
          }).catch((e) => console.error('[bg] gamification error:', e))
        );

        // missions
        tasks.push(
          userClient.functions.invoke('missions-engine', {
            body: {
              sellerId: session.seller_id,
              action: 'roleplay_complete',
              metadata: { sessionId },
            },
          }).catch((e) => console.error('[bg] mission complete error:', e))
        );

        if (evaluation?.passed) {
          tasks.push(
            userClient.functions.invoke('missions-engine', {
              body: {
                sellerId: session.seller_id,
                action: 'roleplay_pass',
                metadata: { sessionId, score: evaluation.overall_score },
              },
            }).catch((e) => console.error('[bg] mission pass error:', e))
          );
        }

        await Promise.allSettled(tasks);
        console.log('[finalize-roleplay-session] Background work complete');
      } catch (e) {
        console.error('[finalize-roleplay-session] Background error:', e);
      }
    };

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(backgroundWork());
    } else {
      // Fallback: fire and forget
      backgroundWork();
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        evaluation,
        evaluationStatus: evaluation ? 'complete' : 'processing',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[finalize-roleplay-session] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
