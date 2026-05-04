import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_ROLE_KEY;
const MIN_MESSAGES_FOR_EVALUATION = 6;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type EvaluationPayload = {
  overall_score?: number;
  passed?: boolean;
  dimensions?: unknown;
  summary?: string;
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function runRoleplayPipeline(sessionId: string, authHeader: string) {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  });

  console.log('[RoleplayFinalize] start', { sessionId });

  const { data: session, error: sessionError } = await adminClient
    .from('roleplay_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) throw new Error('Session not found');

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData?.user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const { data: member, error: memberError } = await adminClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', session.organization_id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!member) throw new HttpError(403, 'Forbidden');

  console.log('[RoleplayFinalize] session loaded', { sessionId, organizationId: session.organization_id, currentPhase: session.current_phase });

  if (session.score_overall != null && session.scores_json) {
    console.log('[RoleplayFinalize] existing evaluation found', { sessionId, score: session.score_overall });
    return { evaluation: session.scores_json as EvaluationPayload, status: 'complete' };
  }

  const { data: messagesRaw, error: messagesError } = await adminClient
    .from('roleplay_messages')
    .select('sender,content,timestamp')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (messagesError) throw messagesError;
  const messages = (messagesRaw || []).map((m: any) => ({ sender: m.sender, text: m.content }));
  console.log('[RoleplayFinalize] messages loaded: N', messages.length);

  if (messages.length < MIN_MESSAGES_FOR_EVALUATION) {
    await adminClient.from('roleplay_sessions').update({ finished_at: session.finished_at || new Date().toISOString(), current_phase: 'evaluation_error' }).eq('id', sessionId);
    throw new Error('Sessão não possui mensagens suficientes para avaliação.');
  }

  const { data: lockSession, error: lockError } = await adminClient
    .from('roleplay_sessions')
    .update({ finished_at: session.finished_at || new Date().toISOString(), current_phase: 'evaluating' })
    .eq('id', sessionId)
    .is('score_overall', null)
    .neq('current_phase', 'evaluating')
    .select('id,current_phase,score_overall')
    .maybeSingle();

  if (lockError) throw lockError;

  if (!lockSession) {
    const { data: refreshSession, error: refreshError } = await adminClient
      .from('roleplay_sessions')
      .select('score_overall,scores_json,current_phase')
      .eq('id', sessionId)
      .maybeSingle();

    if (refreshError || !refreshSession) throw refreshError || new Error('Session not found');

    if (refreshSession.score_overall != null && refreshSession.scores_json) {
      console.log('[RoleplayFinalize] existing evaluation found', { sessionId, score: refreshSession.score_overall });
      return { evaluation: refreshSession.scores_json as EvaluationPayload, status: 'complete' };
    }

    if (refreshSession.current_phase === 'evaluating') {
      console.log('[RoleplayFinalize] evaluation in progress', { sessionId });
      return { status: 'evaluating' };
    }

    throw new Error('Unable to acquire evaluation lock');
  }

  console.log('[RoleplayFinalize] ai evaluation started', { sessionId });
  let data: any;
  try {
    const evalResponse = await userClient.functions.invoke('ai-evaluate-session', {
      body: { sessionId, rubricId: session.rubric_id, messages },
    });
    if (evalResponse.error) throw evalResponse.error;
    data = evalResponse.data;
  } catch (err) {
    const evaluationErrorMessage = err instanceof Error ? err.message : String(err);
    await adminClient
      .from('roleplay_sessions')
      .update({
        current_phase: 'error',
        evaluation_error: evaluationErrorMessage,
        finished_at: session.finished_at || new Date().toISOString(),
      })
      .eq('id', sessionId);
    throw err;
  }

  const evaluation = (data?.evaluation ?? null) as EvaluationPayload | null;
  if (!evaluation || typeof evaluation.overall_score !== 'number') {
    await adminClient.from('roleplay_sessions').update({ current_phase: 'evaluation_error' }).eq('id', sessionId);
    throw new Error('Avaliação não retornou nota válida.');
  }

  const { error: persistError } = await adminClient.from('roleplay_sessions').update({
    score_overall: evaluation.overall_score,
    passed: evaluation.passed ?? null,
    scores_json: evaluation,
    coach_notes: evaluation.summary ?? null,
    current_phase: 'completed',
    finished_at: session.finished_at || new Date().toISOString(),
  }).eq('id', sessionId);
  if (persistError) throw persistError;
  console.log('[RoleplayFinalize] evaluation persisted', { sessionId, score: evaluation.overall_score });

  // Background tasks: don't block the response — fire-and-forget via EdgeRuntime.waitUntil
  const backgroundTasks = (async () => {
    const tasks: Promise<any>[] = [
      userClient.functions.invoke('ai-recommend-videos', { body: { sessionId, sellerId: session.seller_id, scoresJson: evaluation } })
        .catch((e) => console.error('[RoleplayFinalize] recommend-videos failed', e)),
      userClient.functions.invoke('ai-generate-insights', { body: { sessionId, sellerId: session.seller_id, scoresJson: evaluation, messages: messagesRaw, organizationId: session.organization_id } })
        .catch((e) => console.error('[RoleplayFinalize] generate-insights failed', e)),
      userClient.functions.invoke('gamification-engine', { body: { sellerId: session.seller_id, sessionId } })
        .catch((e) => console.error('[RoleplayFinalize] gamification failed', e)),
      userClient.functions.invoke('missions-engine', { body: { sellerId: session.seller_id, action: 'roleplay_complete', metadata: { sessionId } } })
        .catch((e) => console.error('[RoleplayFinalize] mission complete failed', e)),
    ];
    if (evaluation.passed) {
      tasks.push(
        userClient.functions.invoke('missions-engine', { body: { sellerId: session.seller_id, action: 'roleplay_pass', metadata: { sessionId, score: evaluation.overall_score } } })
          .catch((e) => console.error('[RoleplayFinalize] mission pass failed', e))
      );
    }
    await Promise.allSettled(tasks);
  })();
  // @ts-ignore - EdgeRuntime is available in Supabase Edge runtime
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(backgroundTasks);
  }

  return { evaluation, status: 'complete' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization') || '';
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await runRoleplayPipeline(sessionId, authHeader);
    return new Response(JSON.stringify({ success: true, sessionId, evaluationStatus: result.status, evaluation: result.evaluation }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error('[RoleplayFinalize] failed', error);
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
