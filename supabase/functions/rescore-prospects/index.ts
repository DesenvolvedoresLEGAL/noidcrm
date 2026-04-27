// Re-pontua prospects existentes aplicando o learning_adjustment atual.
// NÃO refaz scraping nem chamada de IA. Apenas:
//   1. Lê signals já coletados (prospect_signals + enrichment_signals)
//   2. Cruza com learning_signals atual (impacto + confiança)
//   3. Recalcula priority_score = base + signal_score + learning_adjustment
//   4. Atualiza prospect_scores e prospects.priority_score
//
// Modos:
//   - { run_id }                → re-pontua todos prospects daquela run
//   - { prospect_ids: [...] }   → re-pontua prospects específicos

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  run_id?: string;
  prospect_ids?: string[];
  organization_id?: string;
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

    // 1. Resolve prospects alvo
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

    if (targets.length === 0) return json({ rescored: 0, message: "Nenhum prospect encontrado" });

    const orgId = targets[0].organization_id;

    // 2. Carrega learning signals da org (cache em memória)
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

    // 3. Processa em lotes de 50
    for (let i = 0; i < targets.length; i += 50) {
      const batch = targets.slice(i, i + 50);
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

          await supabase
            .from("prospect_scores")
            .update({
              priority_score: Math.max(0, newTotal),
              grade: newGrade,
              reasoning: {
                ...(score.reasoning || {}),
                learning_adjustment: learningAdjustment,
                rescored_at: new Date().toISOString(),
              },
            })
            .eq("id", score.id);

          await supabase
            .from("prospects")
            .update({ priority_score: Math.max(0, newTotal) })
            .eq("id", score.prospect_id);

          adjustments.push(learningAdjustment);
          rescored++;
        } catch (e) {
          console.error("[rescore] failed for prospect", score.prospect_id, e);
          failed++;
        }
      }
    }

    return json({
      rescored,
      unchanged,
      failed,
      total: targets.length,
      avg_adjustment: adjustments.length > 0 ? adjustments.reduce((a, b) => a + b, 0) / adjustments.length : 0,
      learning_signals_active: learnMap.size,
      message:
        learnMap.size === 0
          ? "Nenhum learning signal com confiança >= 0.2 ainda. Re-pontuação não alterou scores."
          : `Re-pontuados ${rescored} de ${targets.length} prospects.`,
    });
  } catch (e: any) {
    console.error("[rescore-prospects]", e);
    return json({ error: e.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
