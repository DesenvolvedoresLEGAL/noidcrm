// KAG / Feedback loop:
// Recalcula benchmarks por segmento na organização. Acionado:
//   - Manualmente (UI) com { organization_id, segment? }
//   - Automaticamente por trigger pg após won/lost (notify_segment_benchmark_refresh)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OppRow {
  id: string;
  status: string;
  valor_previsto: number | null;
  created_at: string;
  closed_at: string | null;
  account_id: string;
  owner_user_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_WORKFLOW_SECRET');
  const authHeader = req.headers.get('authorization');
  const hasInternal = expectedSecret && internalSecret === expectedSecret;
  const hasAuth = !!authHeader && authHeader.toLowerCase().startsWith('bearer ');
  if (!hasInternal && !hasAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const organizationId: string | undefined = body.organization_id || body.organizationId;
    const onlySegment: string | undefined = body.segment;

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull all opportunities (won/lost) joined with account segment
    let query = supabase
      .from("opportunities")
      .select(
        "id, status, valor_previsto, created_at, closed_at, account_id, owner_user_id, accounts!inner(segmento, organization_id)",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", ["won", "lost"]);

    const { data: opps, error: oppErr } = await query;
    if (oppErr) throw oppErr;

    // Group by segment
    const bySegment = new Map<string, any[]>();
    for (const o of (opps as any[]) || []) {
      const seg = o.accounts?.segmento;
      if (!seg) continue;
      if (onlySegment && seg !== onlySegment) continue;
      if (!bySegment.has(seg)) bySegment.set(seg, []);
      bySegment.get(seg)!.push(o);
    }

    // Pull win_loss_records for the org once
    const { data: wlRecords } = await supabase
      .from("win_loss_records")
      .select("opportunity_id, outcome, reason_category, reason_text")
      .eq("organization_id", organizationId);

    const wlByOpp = new Map<string, any>();
    for (const r of (wlRecords as any[]) || []) {
      wlByOpp.set(r.opportunity_id, r);
    }

    const upserts: any[] = [];
    for (const [segment, items] of bySegment.entries()) {
      const won = items.filter((i) => i.status === "won");
      const lost = items.filter((i) => i.status === "lost");
      const total = items.length;
      const winRate = total > 0 ? +((won.length / total) * 100).toFixed(2) : 0;

      const wonValues = won
        .map((w) => Number(w.valor_previsto))
        .filter((v) => Number.isFinite(v) && v > 0);
      const avgTicket = wonValues.length
        ? +(wonValues.reduce((a, b) => a + b, 0) / wonValues.length).toFixed(2)
        : 0;
      const sortedVals = [...wonValues].sort((a, b) => a - b);
      const medianTicket = sortedVals.length
        ? +sortedVals[Math.floor(sortedVals.length / 2)].toFixed(2)
        : 0;

      const cycles = won
        .map((w) => {
          if (!w.closed_at || !w.created_at) return null;
          const ms = new Date(w.closed_at).getTime() - new Date(w.created_at).getTime();
          return ms > 0 ? ms / (1000 * 60 * 60 * 24) : null;
        })
        .filter((d): d is number => d !== null);
      const avgCycleDays = cycles.length
        ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
        : 0;

      // Top win/loss factors from win_loss_records
      const winFactorCount: Record<string, number> = {};
      const lossFactorCount: Record<string, number> = {};
      for (const w of won) {
        const wl = wlByOpp.get(w.id);
        const cat = wl?.reason_category;
        if (cat) winFactorCount[cat] = (winFactorCount[cat] || 0) + 1;
      }
      for (const l of lost) {
        const wl = wlByOpp.get(l.id);
        const cat = wl?.reason_category;
        if (cat) lossFactorCount[cat] = (lossFactorCount[cat] || 0) + 1;
      }

      const topWinFactors = topN(winFactorCount, 5).map(([factor, n]) => ({
        factor,
        count: n,
      }));
      const topLossFactors = topN(lossFactorCount, 5).map(([factor, n]) => ({
        factor,
        count: n,
      }));

      // Best owner role: owner that won most in this segment
      const ownerWins: Record<string, number> = {};
      for (const w of won) {
        if (w.owner_user_id) ownerWins[w.owner_user_id] = (ownerWins[w.owner_user_id] || 0) + 1;
      }
      const topOwner = topN(ownerWins, 1)[0]?.[0];
      let bestRole: string | null = null;
      if (topOwner) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", topOwner)
          .limit(1)
          .maybeSingle();
        bestRole = roles?.role || null;
      }

      upserts.push({
        organization_id: organizationId,
        segmento: segment,
        total_deals: total,
        won_deals: won.length,
        lost_deals: lost.length,
        win_rate: winRate,
        avg_ticket: avgTicket,
        median_ticket: medianTicket,
        avg_cycle_days: avgCycleDays,
        avg_touches: 0, // reserved for next iteration (count activities)
        top_win_factors: topWinFactors,
        top_loss_factors: topLossFactors,
        best_owner_role: bestRole,
        sample_size: total,
        computed_at: new Date().toISOString(),
      });
    }

    if (upserts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, segments_updated: 0, note: "no won/lost data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: upErr } = await supabase
      .from("lead_segment_benchmarks")
      .upsert(upserts, { onConflict: "organization_id,segmento" });
    if (upErr) throw upErr;

    // Update org weights training timestamp
    await supabase
      .from("lead_score_org_weights")
      .upsert(
        {
          organization_id: organizationId,
          last_trained_at: new Date().toISOString(),
          trained_from_sample: upserts.reduce((s, u) => s + u.sample_size, 0),
        },
        { onConflict: "organization_id" },
      );

    return new Response(
      JSON.stringify({
        success: true,
        segments_updated: upserts.length,
        segments: upserts.map((u) => u.segmento),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[refresh-segment-benchmarks] Error:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function topN(map: Record<string, number>, n: number): Array<[string, number]> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
