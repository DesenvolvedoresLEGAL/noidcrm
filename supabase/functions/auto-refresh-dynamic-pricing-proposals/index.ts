// DYNAMIC PRICING AUTO-REFRESH — cron job (a cada 5min).
// Varre propostas abertas/sent/draft com dynamic_pricing automatic e cuja
// tier vigente já virou (ou cujo snapshot está stale). Para cada uma chama
// `ensure_proposal_dynamic_pricing_current` (idempotente, SECURITY DEFINER).
//
// Nunca toca em propostas accepted/rejected (congeladas/saída do funil) nem
// em soft-deleted. Não duplica eventos quando nada mudou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startedAt = new Date().toISOString();
  let scanned = 0;
  let refreshed = 0;
  let errors = 0;

  try {
    // Escopo: propostas elegíveis. Fonte da verdade: server now() do banco.
    // Marcamos como candidatas quando:
    //  - snapshot ausente OU
    //  - dynamic_pricing_snapshot->>'current_ends_at' já no passado.
    // Cobre TODOS os status comerciais ainda editáveis (não-congelados).
    // A RPC interna trata frozen/accepted/rejected como no-op.
    const FROZEN_STATUSES = [
      "accepted",
      "rejected",
      "cancelled",
      "archived",
      "expired",
    ];

    const { data: candidates, error } = await supabase
      .from("proposals")
      .select(
        "id, status, dynamic_pricing_snapshot, dynamic_pricing_last_calculated_at, dynamic_pricing_current_amount, total_amount, payment_expected_amount",
      )
      .not("status", "in", `(${FROZEN_STATUSES.join(",")})`)
      .eq("dynamic_pricing_enabled", true)
      .eq("dynamic_pricing_applicability", "automatic")
      .neq("price_frozen_on_approval", true)
      .is("deleted_at", null)
      .limit(500);

    if (error) {
      console.error("[auto-refresh-dynamic-pricing] query error", error);
      return new Response(
        JSON.stringify({ error: error.message, startedAt }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const nowMs = Date.now();
    const stale = (candidates ?? []).filter((p: any) => {
      const snap = p?.dynamic_pricing_snapshot;
      if (!snap || typeof snap !== "object") return true;
      if (!p.dynamic_pricing_last_calculated_at) return true;
      const ends = snap?.current_ends_at
        ? new Date(snap.current_ends_at).getTime()
        : null;
      if (ends !== null && ends < nowMs) return true;
      // Drift detectado entre snapshot/card e current_amount persistido.
      const snapAmt = snap?.current_amount != null ? Number(snap.current_amount) : null;
      const cardAmt = p.payment_expected_amount ?? p.total_amount;
      const persisted = p.dynamic_pricing_current_amount;
      if (snapAmt != null && persisted != null && Math.abs(Number(persisted) - snapAmt) > 0.01) return true;
      if (snapAmt != null && cardAmt != null && Math.abs(Number(cardAmt) - snapAmt) > 0.01) return true;
      return false;
    });

    scanned = stale.length;

    for (const p of stale) {
      try {
        const { data: res, error: rpcErr } = await supabase.rpc(
          "ensure_proposal_dynamic_pricing_current",
          { p_proposal_id: p.id },
        );
        if (rpcErr) {
          errors++;
          console.error(
            "[auto-refresh-dynamic-pricing] rpc error",
            p.id,
            rpcErr.message,
          );
          continue;
        }
        if (res?.refreshed) refreshed++;
      } catch (e) {
        errors++;
        console.error("[auto-refresh-dynamic-pricing] fatal item", p.id, e);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        candidates: candidates?.length ?? 0,
        scanned,
        refreshed,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[auto-refresh-dynamic-pricing] fatal", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, startedAt }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
