// Re-pontua prospects existentes aplicando o learning_adjustment atual.
// Background pattern: responde 202 imediatamente e processa via EdgeRuntime.waitUntil.
// Status acompanhado via system_events (rescore.started / rescore.completed / rescore.failed).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  run_id?: string;
  prospect_ids?: string[];
}

interface Score {
  id: string;
  prospect_id: string;
  organization_id: string;
  icp_fit_score: number;
  signal_score: number;
  data_quality_score: number;
  source_trust_score: number;
  penalty_score: number;
  reasoning: any;
}

// @ts-ignore - EdgeRuntime exists at runtime in Supabase edge functions
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    const { run_id, prospect_ids } = body;

    if (!run_id && (!prospect_ids || prospect_ids.length === 0)) {
      return json({ error: "run_id ou prospect_ids obrigatório" }, 400);
    }

    // Resolve prospects alvo (rápido, dentro do request)
    let targets: { id: string; organization_id: string }[] = [];
    if (run_id) {
      const { data, error } = await supabase
        .from("prospects")
        .select("id, organization_id")
        .eq("playbook_run_id", run_id);
      if (error) throw error;
      targets = data ?? [];
    } else {
      const { data, error } = await supabase
        .from("prospects")
        .select("id, organization_id")
        .in("id", prospect_ids!);
      if (error) throw error;
      targets = data ?? [];
    }

    if (targets.length === 0) {
      return json({ status: "noop", rescored: 0, total: 0, message: "Nenhum prospect encontrado" });
    }

    const orgId = targets[0].organization_id;
    const entityId = run_id ?? targets[0].id;

    // Guard contra duplo-clique (last started < 60s atrás e ainda sem completed/failed depois)
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: recentStarted } = await supabase
      .from("system_events")
      .select("id, created_at")
      .eq("entity_id", entityId)
      .eq("event_type", "rescore.started")
      .gte("created_at", sixtySecondsAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentStarted && recentStarted.length > 0) {
      const startedAt = recentStarted[0].created_at;
      const { data: terminal } = await supabase
        .from("system_events")
        .select("id")
        .eq("entity_id", entityId)
        .in("event_type", ["rescore.completed", "rescore.failed"])
        .gte("created_at", startedAt)
        .limit(1);

      if (!terminal || terminal.length === 0) {
        return json(
          { status: "in_progress", total: targets.length, message: "Re-pontuação já em andamento para esta execução." },
          202,
        );
      }
    }

    // Marca início
    await supabase.from("system_events").insert({
      organization_id: orgId,
      event_type: "rescore.started",
      entity_id: entityId,
      entity_type: run_id ? "playbook_run" : "prospect_batch",
      payload: { total: targets.length, run_id, prospect_ids: prospect_ids?.length ?? null },
    } as any);

    // Background processing
    EdgeRuntime.waitUntil(processRescore(supabase, targets, orgId, entityId, run_id));

    return json(
      {
        status: "processing",
        total: targets.length,
        entity_id: entityId,
        message: "Re-pontuação iniciada em background.",
      },
      202,
    );
  } catch (e: any) {
    console.error("[rescore-prospects] enqueue error", e);
    return json({ error: e.message }, 500);
  }
});

async function processRescore(
  supabase: any,
  targets: { id: string; organization_id: string }[],
  orgId: string,
  entityId: string,
  runId?: string,
) {
  const startedAt = Date.now();
  try {
    // Carrega learning signals da org (1 query)
    const { data: learn } = await supabase
      .from("learning_signals")
      .select("signal_type, signal_value, impact_score, confidence")
      .eq("organization_id", orgId)
      .gte("confidence", 0.2);

    const learnMap = new Map<string, number>(
      (learn ?? []).map((l: any) => [`${l.signal_type}:${l.signal_value}`, Number(l.impact_score)]),
    );

    let rescored = 0;
    let unchanged = 0;
    let failed = 0;
    const adjustments: number[] = [];

    const BATCH_SIZE = 200;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map((b) => b.id);

      const [{ data: scores }, { data: pSignals }, { data: eSignals }] = await Promise.all([
        supabase.from("prospect_scores").select("*").in("prospect_id", batchIds),
        supabase
          .from("prospect_signals")
          .select("prospect_id, signal_type, signal_value")
          .in("prospect_id", batchIds)
          .eq("organization_id", orgId),
        supabase
          .from("enrichment_signals")
          .select("prospect_id, signal_type, signal_value")
          .in("prospect_id", batchIds)
          .eq("workspace_id", orgId),
      ]);

      const signalsByProspect = new Map<string, Array<{ signal_type: string; signal_value: string }>>();
      for (const s of [...(pSignals ?? []), ...(eSignals ?? [])]) {
        const arr = signalsByProspect.get((s as any).prospect_id) ?? [];
        arr.push({ signal_type: (s as any).signal_type, signal_value: (s as any).signal_value });
        signalsByProspect.set((s as any).prospect_id, arr);
      }

      const scoreUpdates: any[] = [];
      const prospectUpdates: { id: string; score: number }[] = [];

      for (const score of (scores ?? []) as Score[]) {
        try {
          const sig = signalsByProspect.get(score.prospect_id) ?? [];
          let learningAdjustment = 0;
          for (const s of sig) {
            const k = `${s.signal_type}:${s.signal_value}`;
            if (learnMap.has(k)) learningAdjustment += learnMap.get(k)!;
          }

          const previousAdj = Number(score.reasoning?.learning_adjustment ?? 0);
          if (previousAdj === learningAdjustment) {
            unchanged++;
            continue;
          }

          const newTotal =
            (score.icp_fit_score || 0) +
            (score.signal_score || 0) +
            (score.data_quality_score || 0) +
            (score.source_trust_score || 0) -
            (score.penalty_score || 0) +
            learningAdjustment;

          const newGrade = newTotal >= 280 ? "A" : newTotal >= 230 ? "B" : newTotal >= 180 ? "C" : "D";
          const finalScore = Math.max(0, newTotal);

          scoreUpdates.push({
            id: score.id,
            prospect_id: score.prospect_id,
            organization_id: score.organization_id,
            icp_fit_score: score.icp_fit_score,
            signal_score: score.signal_score,
            data_quality_score: score.data_quality_score,
            source_trust_score: score.source_trust_score,
            penalty_score: score.penalty_score,
            priority_score: finalScore,
            grade: newGrade,
            reasoning: {
              ...(score.reasoning || {}),
              learning_adjustment: learningAdjustment,
              rescored_at: new Date().toISOString(),
            },
          });
          prospectUpdates.push({ id: score.prospect_id, score: finalScore });
          adjustments.push(learningAdjustment);
          rescored++;
        } catch (e) {
          console.error("[rescore] failed for prospect", score.prospect_id, e);
          failed++;
        }
      }

      // Bulk writes (2 round-trips por lote em vez de 2*N)
      if (scoreUpdates.length > 0) {
        const { error: upErr } = await supabase
          .from("prospect_scores")
          .upsert(scoreUpdates, { onConflict: "id" });
        if (upErr) console.error("[rescore] upsert prospect_scores error", upErr);

        const { error: rpcErr } = await supabase.rpc("bulk_update_prospect_priority", {
          p_updates: prospectUpdates,
        });
        if (rpcErr) console.error("[rescore] bulk_update_prospect_priority error", rpcErr);
      }
    }

    const durationMs = Date.now() - startedAt;
    await supabase.from("system_events").insert({
      organization_id: orgId,
      event_type: "rescore.completed",
      entity_id: entityId,
      entity_type: runId ? "playbook_run" : "prospect_batch",
      payload: {
        rescored,
        unchanged,
        failed,
        total: targets.length,
        avg_adjustment:
          adjustments.length > 0 ? adjustments.reduce((a, b) => a + b, 0) / adjustments.length : 0,
        learning_signals_active: learnMap.size,
        duration_ms: durationMs,
      },
    } as any);

    console.log(
      `[rescore-prospects] done entity=${entityId} rescored=${rescored}/${targets.length} duration=${durationMs}ms`,
    );
  } catch (e: any) {
    console.error("[rescore-prospects] background error", e);
    await supabase.from("system_events").insert({
      organization_id: orgId,
      event_type: "rescore.failed",
      entity_id: entityId,
      entity_type: runId ? "playbook_run" : "prospect_batch",
      payload: { error: e.message, total: targets.length },
    } as any);
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
