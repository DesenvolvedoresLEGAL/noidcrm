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

async function runRoleplayPipeline(sessionId: string, authHeader: string) {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  });

  const { data: session, error: sessionError } = await adminClient
    .from('roleplay_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.error('[finalize-roleplay-session] Session not found during pipeline:', sessionError);
    throw new Error('Session not found');
  }

  const finishedAt = session.finished_at || new Date().toISOString();
  const { error: finishError } = await adminClient
    .from('roleplay_sessions')
    .update({ finished_at: finishedAt })
    .eq('id', sessionId);

  if (finishError) {
    console.error('[finalize-roleplay-session] Failed to mark finished_at:', finishError);
    throw finishError;
  }

  const { data: messagesRaw, error: messagesError } = await adminClient
    .from('roleplay_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (messagesError) {
    console.error('[finalize-roleplay-session] Failed to load messages:', messagesError);
    throw messagesError;
  }

  const messages = (messagesRaw || []).map((m: any) => ({
    sender: m.sender,
    text: m.content,
  }));

  let evaluation = session.scores_json && session.score_overall != null
    ? session.scores_json
    : null;

  if (!evaluation) {
    console.log('[finalize-roleplay-session] Running evaluation for session:', sessionId);
    const { data, error } = await userClient.functions.invoke('ai-evaluate-session', {
      body: {
        sessionId,
        rubricId: session.rubric_id,
        messages,
      },
    });

    if (error) {
      console.error('[finalize-roleplay-session] Evaluation failed:', error);
      throw error;
    }

    evaluation = data?.evaluation ?? null;
    console.log('[finalize-roleplay-session] Evaluation completed:', {
      sessionId,
      score: evaluation?.overall_score,
    });
  }

  const backgroundTasks: Promise<any>[] = [];

  if (evaluation) {
    backgroundTasks.push(
      userClient.functions.invoke('ai-recommend-videos', {
        body: {
          sessionId,
          sellerId: session.seller_id,
          scoresJson: evaluation,
        },
      }).catch((e) => console.error('[finalize-roleplay-session] Videos error:', e))
    );

    backgroundTasks.push(
      userClient.functions.invoke('ai-generate-insights', {
        body: {
          sessionId,
          sellerId: session.seller_id,
          scoresJson: evaluation,
          messages: messagesRaw,
          organizationId: session.organization_id,
        },
      }).catch((e) => console.error('[finalize-roleplay-session] Insights error:', e))
    );
  }

  backgroundTasks.push(
    userClient.functions.invoke('gamification-engine', {
      body: { sellerId: session.seller_id, sessionId },
    }).catch((e) => console.error('[finalize-roleplay-session] Gamification error:', e))
  );

  backgroundTasks.push(
    userClient.functions.invoke('missions-engine', {
      body: {
        sellerId: session.seller_id,
        action: 'roleplay_complete',
        metadata: { sessionId },
      },
    }).catch((e) => console.error('[finalize-roleplay-session] Mission complete error:', e))
  );

  if ((evaluation as any)?.passed) {
    backgroundTasks.push(
      userClient.functions.invoke('missions-engine', {
        body: {
          sellerId: session.seller_id,
          action: 'roleplay_pass',
          metadata: { sessionId, score: (evaluation as any).overall_score },
        },
      }).catch((e) => console.error('[finalize-roleplay-session] Mission pass error:', e))
    );
  }

  await Promise.allSettled(backgroundTasks);
  console.log('[finalize-roleplay-session] Pipeline complete for session:', sessionId);

  return evaluation;
}

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

    console.log('[finalize-roleplay-session] Dispatching pipeline for session:', sessionId);

    const pipelinePromise = runRoleplayPipeline(sessionId, authHeader).catch((error) => {
      console.error('[finalize-roleplay-session] Pipeline error:', error);
    });

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(pipelinePromise);
    } else {
      await pipelinePromise;
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        evaluationStatus: 'processing',
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
