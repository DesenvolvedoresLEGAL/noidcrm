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

function hasValidEvaluation(session: any): boolean {
  if (session?.score_overall == null) return false;
  const sj = session?.scores_json;
  if (!sj || typeof sj !== 'object') return false;
  const score = (sj as any).overall_score;
  return typeof score === 'number' && !Number.isNaN(score);
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

  if (sessionError || !session) throw new HttpError(404, 'Session not found');

  // Auth check (always required)
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

  console.log('[RoleplayFinalize] session loaded', {
    sessionId,
    organizationId: session.organization_id,
    currentPhase: session.current_phase,
    hasScore: session.score_overall != null,
  });

  // Idempotency: if a valid evaluation already exists, return it.
  if (hasValidEvaluation(session)) {
    console.log('[RoleplayFinalize] existing valid evaluation found', { sessionId, score: session.score_overall });
    return { evaluation: session.scores_json as EvaluationPayload, status: 'already_complete' as const };
  }

  if (session.current_phase === 'evaluating' && session.updated_at) {
    const evaluatingForMs = Date.now() - new Date(session.updated_at).getTime();
    if (evaluatingForMs >= 0 && evaluatingForMs < 120_000) {
      console.log('[RoleplayFinalize] evaluation already running, skipping duplicate invoke', { sessionId, evaluatingForMs });
      return { evaluation: null, status: 'processing' as const };
    }
  }

  // Load messages
  const { data: messagesRaw, error: messagesError } = await adminClient
    .from('roleplay_messages')
    .select('sender,content,timestamp')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (messagesError) throw messagesError;
  const messages = (messagesRaw || []).map((m: any) => ({ sender: m.sender, text: m.content }));
  // Cap at 100 (matches ai-evaluate-session validation). Take the last 100 to keep the most recent context.
  const cappedMessages = messages.length > 100 ? messages.slice(-100) : messages;
  console.log('[RoleplayFinalize] messages loaded', { total: messages.length, used: cappedMessages.length });

  if (cappedMessages.length < MIN_MESSAGES_FOR_EVALUATION) {
    await adminClient
      .from('roleplay_sessions')
      .update({
        finished_at: session.finished_at || new Date().toISOString(),
        current_phase: 'evaluation_error',
      })
      .eq('id', sessionId);
    throw new HttpError(422, 'Sessão não possui mensagens suficientes para avaliação.');
  }

  // Mark as evaluating + ensure finished_at. We DO NOT use this as a blocking lock anymore —
  // the previous lock-based approach left sessions permanently stuck in 'evaluating' on any failure.
  await adminClient
    .from('roleplay_sessions')
    .update({
      finished_at: session.finished_at || new Date().toISOString(),
      current_phase: 'evaluating',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  console.log('[RoleplayFinalize] invoking ai-evaluate-session', { sessionId });
  let aiData: any;
  try {
    const evalResponse = await userClient.functions.invoke('ai-evaluate-session', {
      body: { sessionId, rubricId: session.rubric_id, messages: cappedMessages },
    });
    if (evalResponse.error) {
      const { data: maybeCompleted } = await adminClient
        .from('roleplay_sessions')
        .select('score_overall,scores_json')
        .eq('id', sessionId)
        .maybeSingle();
      if (hasValidEvaluation(maybeCompleted)) {
        console.log('[RoleplayFinalize] evaluation persisted despite invoke error', { sessionId });
        aiData = { evaluation: maybeCompleted?.scores_json };
      } else {
        throw evalResponse.error;
      }
    } else {
      aiData = evalResponse.data;
    }
  } catch (err) {
    const evaluationErrorMessage = err instanceof Error ? err.message : String(err);
    console.error('[RoleplayFinalize] ai-evaluate-session failed', evaluationErrorMessage);
    // Reset phase so frontend can retry without thinking it's still evaluating.
    await adminClient
      .from('roleplay_sessions')
      .update({ current_phase: 'evaluation_error' })
      .eq('id', sessionId);
    throw new HttpError(502, `Falha na avaliação por IA: ${evaluationErrorMessage}`);
  }

  // Detect contingency fallback: ai-evaluate-session signals it via { contingency: true }
  // or via evaluation._contingencyFallback. Treat as failure so UI offers retry.
  const evaluation = (aiData?.evaluation ?? null) as (EvaluationPayload & { _contingencyFallback?: boolean }) | null;
  const isContingency = aiData?.contingency === true || evaluation?._contingencyFallback === true;

  if (isContingency) {
    console.warn('[RoleplayFinalize] contingency fallback detected, marking as evaluation_error', { sessionId });
    await adminClient
      .from('roleplay_sessions')
      .update({ current_phase: 'evaluation_error' })
      .eq('id', sessionId);
    throw new HttpError(502, 'A avaliação por IA falhou (timeout). Clique em "Reprocessar avaliação" para tentar novamente.');
  }

  if (!evaluation || typeof evaluation.overall_score !== 'number') {
    console.error('[RoleplayFinalize] invalid evaluation payload', { sessionId, aiData });
    await adminClient
      .from('roleplay_sessions')
      .update({ current_phase: 'evaluation_error' })
      .eq('id', sessionId);
    throw new HttpError(502, 'Avaliação não retornou nota válida.');
  }

  // ai-evaluate-session already persisted score_overall/scores_json/passed/finished_at.
  // We just guarantee current_phase = 'completed' here.
  const { error: persistError } = await adminClient
    .from('roleplay_sessions')
    .update({
      score_overall: evaluation.overall_score,
      passed: evaluation.passed ?? null,
      scores_json: evaluation,
      coach_notes: evaluation.summary ?? null,
      current_phase: 'completed',
      finished_at: session.finished_at || new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (persistError) {
    console.error('[RoleplayFinalize] persist error', persistError);
    throw persistError;
  }
  console.log('[RoleplayFinalize] evaluation persisted', { sessionId, score: evaluation.overall_score });

  // Background tasks: don't block the response.
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

  return { evaluation, status: 'complete' as const };
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
    return new Response(JSON.stringify({
      success: true,
      sessionId,
      evaluationStatus: result.status,
      evaluation: result.evaluation,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    console.error('[RoleplayFinalize] failed', error);
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
