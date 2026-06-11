// Sprint REL V2.11 — Qualidade de Qualificação SDR
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  organizationId?: string;
  dateRange?: { start?: string; end?: string };
  sdrUserIds?: string[];
  closerUserIds?: string[];
  status?: string[]; // won | lost | open
  proposalStatus?: "with" | "without" | "any";
  includeRemovedUsers?: boolean;
  pipelineIds?: string[];
  includeDrilldown?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const {
      organizationId, dateRange, sdrUserIds, closerUserIds, status,
      proposalStatus = "any", includeRemovedUsers = false,
      pipelineIds, includeDrilldown = false,
    } = body;

    let q = supabase.from("v_report_qualification_quality_v2").select("*");

    if (organizationId) q = q.eq("organization_id", organizationId);
    if (dateRange?.start) q = q.gte("qualified_at", dateRange.start);
    if (dateRange?.end) q = q.lte("qualified_at", `${dateRange.end.slice(0, 10)}T23:59:59.999Z`);
    if (sdrUserIds?.length) q = q.in("sdr_user_id", sdrUserIds);
    if (closerUserIds?.length) q = q.in("closer_user_id", closerUserIds);
    if (pipelineIds?.length) q = q.in("pipeline_id", pipelineIds);
    if (proposalStatus === "with") q = q.eq("has_proposal", true);
    if (proposalStatus === "without") q = q.eq("has_proposal", false);
    if (status?.length) {
      const map = (s: string) => s === "open" ? "neg.in.(won,lost)" : `eq.${s}`;
      // simpler: filter client-side after fetch for status
    }

    const { data: rows, error } = await q.limit(10000);
    if (error) throw error;

    let filtered = rows ?? [];
    if (status?.length) {
      filtered = filtered.filter((r: any) => {
        const s = r.status === "won" || r.status === "lost" ? r.status : "open";
        return status.includes(s);
      });
    }

    // Resolver
    const userIds = Array.from(new Set(
      filtered.flatMap((r: any) => [r.sdr_user_id, r.closer_user_id]).filter(Boolean),
    ));
    const { data: resolverRows } = await supabase
      .from("v_user_display_resolver_v2")
      .select("user_id, display_name, user_status, is_active, is_deleted")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const resolver = new Map<string, any>((resolverRows ?? []).map((r: any) => [r.user_id, r]));
    const resolve = (id: string | null) => {
      if (!id) return { display_name: "Sem responsável", is_active: false, is_deleted: false, user_status: "none" };
      return resolver.get(id) ?? { display_name: "Usuário removido", is_active: false, is_deleted: true, user_status: "unknown" };
    };

    // Group by SDR
    const map = new Map<string, any>();
    for (const r of filtered) {
      const sdrId = r.sdr_user_id ?? "__null__";
      if (!map.has(sdrId)) {
        const info = resolve(r.sdr_user_id);
        map.set(sdrId, {
          sdr_user_id: r.sdr_user_id,
          sdr_name: info.display_name,
          sdr_status: info.user_status,
          sdr_is_active: info.is_active,
          sdr_is_deleted: info.is_deleted,
          qualified_count: 0, with_proposal_count: 0, without_proposal_count: 0,
          won_count: 0, lost_count: 0, open_count: 0,
          valid_revenue_amount: 0,
          _hoursToProposal: [], _daysToClose: [],
        });
      }
      const a = map.get(sdrId);
      a.qualified_count++;
      if (r.has_proposal) a.with_proposal_count++; else a.without_proposal_count++;
      if (r.status === "won") a.won_count++;
      else if (r.status === "lost") a.lost_count++;
      else a.open_count++;
      a.valid_revenue_amount += Number(r.valid_revenue_amount ?? 0);
      if (r.hours_qualification_to_proposal != null) a._hoursToProposal.push(Number(r.hours_qualification_to_proposal));
      if (r.days_qualification_to_close != null) a._daysToClose.push(Number(r.days_qualification_to_close));
    }

    const avg = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    const rate = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 100 : 0;

    let groupRows = Array.from(map.values()).map((a) => ({
      sdr_user_id: a.sdr_user_id,
      sdr_name: a.sdr_name,
      sdr_status: a.sdr_status,
      sdr_is_active: a.sdr_is_active,
      sdr_is_deleted: a.sdr_is_deleted,
      qualified_count: a.qualified_count,
      with_proposal_count: a.with_proposal_count,
      without_proposal_count: a.without_proposal_count,
      won_count: a.won_count, lost_count: a.lost_count, open_count: a.open_count,
      valid_revenue_amount: Math.round(a.valid_revenue_amount * 100) / 100,
      sql_to_proposal_rate: rate(a.with_proposal_count, a.qualified_count),
      proposal_to_won_rate: rate(a.won_count, a.with_proposal_count),
      sql_to_won_rate: rate(a.won_count, a.qualified_count),
      post_qualification_loss_rate: rate(a.lost_count, a.qualified_count),
      avg_hours_qualification_to_proposal: avg(a._hoursToProposal),
      avg_days_qualification_to_close: avg(a._daysToClose),
    }));

    if (!includeRemovedUsers) {
      groupRows = groupRows.filter((r) => r.sdr_is_active || r.qualified_count > 0 && r.sdr_user_id);
      // keep historical contributors but flag is_deleted true
    }

    // Summary
    const sum = (k: string) => groupRows.reduce((s, r: any) => s + (r[k] ?? 0), 0);
    const summary = {
      qualified_count: sum("qualified_count"),
      with_proposal_count: sum("with_proposal_count"),
      without_proposal_count: sum("without_proposal_count"),
      won_count: sum("won_count"),
      lost_count: sum("lost_count"),
      open_count: sum("open_count"),
      valid_revenue_amount: Math.round(sum("valid_revenue_amount") * 100) / 100,
      sql_to_proposal_rate: rate(sum("with_proposal_count"), sum("qualified_count")),
      proposal_to_won_rate: rate(sum("won_count"), sum("with_proposal_count")),
      sql_to_won_rate: rate(sum("won_count"), sum("qualified_count")),
      post_qualification_loss_rate: rate(sum("lost_count"), sum("qualified_count")),
    };

    // Confidence
    const totalRows = filtered.length;
    const missingNames = filtered.filter((r: any) => r.sdr_user_id && !resolver.get(r.sdr_user_id)).length;
    const withoutProp = filtered.filter((r: any) => !r.has_proposal).length;
    let confidence: "trusted" | "partial" | "warning" = "trusted";
    if (totalRows > 0 && missingNames / totalRows > 0.1) confidence = "partial";
    if (totalRows > 0 && withoutProp / totalRows > 0.6) confidence = "warning";

    const drilldown = includeDrilldown
      ? filtered.map((r: any) => {
          const sdr = resolve(r.sdr_user_id);
          const closer = resolve(r.closer_user_id);
          return {
            opportunity_id: r.opportunity_id,
            opportunity_title: r.opportunity_title,
            account_id: r.account_id,
            account_name: r.account_name,
            qualified_at: r.qualified_at,
            sdr_user_id: r.sdr_user_id,
            sdr_name: sdr.display_name,
            sdr_is_deleted: sdr.is_deleted,
            closer_user_id: r.closer_user_id,
            closer_name: closer.display_name,
            closer_is_deleted: closer.is_deleted,
            has_proposal: r.has_proposal,
            proposal_number: r.proposal_number,
            proposal_status: r.proposal_status,
            status: r.status,
            loss_reason_name: r.loss_reason_name,
            valid_revenue_amount: r.valid_revenue_amount,
            has_cancelled_sale: r.has_cancelled_sale,
            days_since_qualification: r.days_since_qualification,
            days_qualification_to_close: r.days_qualification_to_close,
            hours_qualification_to_proposal: r.hours_qualification_to_proposal,
          };
        })
      : undefined;

    return new Response(JSON.stringify({
      summary,
      rows: groupRows.sort((a, b) => b.qualified_count - a.qualified_count),
      drilldown,
      meta: {
        total_opportunities: totalRows,
        generated_at: new Date().toISOString(),
        filters_applied: { organizationId, dateRange, sdrUserIds, closerUserIds, status, proposalStatus, includeRemovedUsers, pipelineIds },
      },
      confidence,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[report-qualification-quality-v2] error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
