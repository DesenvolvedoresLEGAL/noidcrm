// kairos-generate-gtm-recommendations — KAI.17
// Lê kairos_gtm_performance_summary e gera recomendações automáticas.
// Idempotente via dedup_key. Não duplica recomendações abertas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Row {
  organization_id: string;
  event_id: string | null;
  event_name: string | null;
  icp_cluster_id: string | null;
  icp_cluster_name: string | null;
  batch_run_id: string | null;
  owner_id: string | null;
  sdr_id: string | null;
  primary_contact_department: string | null;
  captured_count: number;
  sdr_ready_count: number;
  promoted_to_crm_count: number;
  opportunities_created_count: number;
  proposals_created_count: number;
  proposals_sent_count: number;
  won_count: number;
  lost_count: number;
  valid_revenue_amount: number | string;
  apollo_credits_used: number;
  apollo_dm_found_count: number;
}

function n(v: unknown): number { return Number(v ?? 0); }

type Rec = {
  organization_id: string;
  recommendation_type: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  title: string;
  description: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  impact_estimate: number;
  confidence_score: number;
  metric_snapshot: Record<string, unknown>;
  dedup_key: string;
  status: "open";
};

function buildRecommendations(rows: Row[]): Rec[] {
  const recs: Rec[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Aggregate per organization for averages
  const byOrg = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byOrg.get(r.organization_id) ?? [];
    arr.push(r);
    byOrg.set(r.organization_id, arr);
  }

  for (const [orgId, orgRows] of byOrg) {
    // Per event
    const byEvent = new Map<string, Row>();
    for (const r of orgRows) {
      const key = (r.event_id ?? r.event_name ?? "__none__") as string;
      const cur = byEvent.get(key);
      if (!cur) byEvent.set(key, { ...r });
      else {
        cur.captured_count += n(r.captured_count);
        cur.sdr_ready_count += n(r.sdr_ready_count);
        cur.promoted_to_crm_count += n(r.promoted_to_crm_count);
        cur.opportunities_created_count += n(r.opportunities_created_count);
        cur.proposals_sent_count += n(r.proposals_sent_count);
        cur.won_count += n(r.won_count);
        cur.valid_revenue_amount = n(cur.valid_revenue_amount) + n(r.valid_revenue_amount);
        cur.apollo_credits_used += n(r.apollo_credits_used);
        cur.apollo_dm_found_count += n(r.apollo_dm_found_count);
      }
    }

    const events = Array.from(byEvent.values()).filter((e) => e.event_id || e.event_name);
    if (events.length === 0) continue;

    const avgRevenue = events.reduce((s, e) => s + n(e.valid_revenue_amount), 0) / events.length;
    const avgConv = events.reduce(
      (s, e) => s + (n(e.captured_count) ? n(e.won_count) / n(e.captured_count) : 0),
      0,
    ) / events.length;

    for (const e of events) {
      const captured = n(e.captured_count);
      const sdrReady = n(e.sdr_ready_count);
      const opps = n(e.opportunities_created_count);
      const propsSent = n(e.proposals_sent_count);
      const won = n(e.won_count);
      const revenue = n(e.valid_revenue_amount);
      const credits = n(e.apollo_credits_used);
      const dms = n(e.apollo_dm_found_count);
      const conv = captured ? won / captured : 0;
      const label = e.event_name ?? "evento";
      const targetId = e.event_id ?? null;

      // 1. Event winner
      if (revenue >= avgRevenue && conv >= avgConv && revenue > 0 && captured >= 30) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "event_focus",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `Priorizar evento ${label}`,
          description:
            `${label} entrega receita acima da média (R$ ${revenue.toFixed(0)}) e conversão de ${(conv * 100).toFixed(1)}%. Aumentar volume de sourcing neste evento.`,
          severity: "high",
          impact_estimate: revenue,
          confidence_score: 0.8,
          metric_snapshot: { revenue, conv, captured, won },
          dedup_key: `event_focus:${targetId ?? label}:${today}`,
          status: "open",
        });
      }

      // 2. Low conversion source
      if (captured >= 100 && conv < avgConv * 0.4) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "low_conversion_source",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `${label}: alto volume, baixa conversão`,
          description:
            `${captured} capturados, mas apenas ${won} vendas (${(conv * 100).toFixed(1)}%). Revisar ICP ou qualidade da fonte.`,
          severity: "medium",
          impact_estimate: captured,
          confidence_score: 0.7,
          metric_snapshot: { captured, won, conv },
          dedup_key: `low_conv:${targetId ?? label}:${today}`,
          status: "open",
        });
      }

      // 3. SDR Ready bottleneck
      if (captured >= 200 && sdrReady < captured * 0.1) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "apollo_coverage_issue",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `${label}: poucos SDR Ready (${sdrReady}/${captured})`,
          description:
            `Apenas ${((sdrReady / captured) * 100).toFixed(1)}% dos capturados viraram SDR Ready. Gargalo provável em cobertura Apollo ou ausência de domínio.`,
          severity: "high",
          impact_estimate: captured - sdrReady,
          confidence_score: 0.75,
          metric_snapshot: { captured, sdr_ready: sdrReady },
          dedup_key: `apollo_coverage:${targetId ?? label}:${today}`,
          status: "open",
        });
      }

      // 4. Apollo burn rate
      if (credits >= 200 && dms < credits * 0.05) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "apollo_coverage_issue",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `Apollo queimando crédito em ${label}`,
          description:
            `${credits} créditos consumidos para ${dms} decisores. Reduzir limite Apollo para este evento/ICP.`,
          severity: "high",
          impact_estimate: credits,
          confidence_score: 0.7,
          metric_snapshot: { credits, dms },
          dedup_key: `apollo_burn:${targetId ?? label}:${today}`,
          status: "open",
        });
      }

      // 5. SDR bottleneck (event level proxy)
      if (sdrReady >= 50 && opps < sdrReady * 0.3) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "sdr_bottleneck",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `SDR travado em ${label}`,
          description:
            `${sdrReady} prontos para SDR, mas apenas ${opps} oportunidades criadas. Redistribuir fila ou revisar abordagem.`,
          severity: "medium",
          impact_estimate: sdrReady - opps,
          confidence_score: 0.65,
          metric_snapshot: { sdr_ready: sdrReady, opps },
          dedup_key: `sdr_bottleneck:${targetId ?? label}:${today}`,
          status: "open",
        });
      }

      // 6. Proposal bottleneck
      if (opps >= 20 && propsSent < opps * 0.4) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "proposal_bottleneck",
          target_type: "event",
          target_id: targetId,
          target_label: label,
          title: `Propostas travadas em ${label}`,
          description:
            `${opps} oportunidades, apenas ${propsSent} propostas enviadas (${((propsSent / opps) * 100).toFixed(1)}%). Intervir no processo pós-SDR.`,
          severity: "medium",
          impact_estimate: opps - propsSent,
          confidence_score: 0.7,
          metric_snapshot: { opps, props_sent: propsSent },
          dedup_key: `proposal_bottleneck:${targetId ?? label}:${today}`,
          status: "open",
        });
      }
    }

    // Department winners (sum across rows)
    const byDept = new Map<string, { won: number; opps: number; revenue: number }>();
    for (const r of orgRows) {
      const d = r.primary_contact_department;
      if (!d) continue;
      const cur = byDept.get(d) ?? { won: 0, opps: 0, revenue: 0 };
      cur.won += n(r.won_count);
      cur.opps += n(r.opportunities_created_count);
      cur.revenue += n(r.valid_revenue_amount);
      byDept.set(d, cur);
    }
    const deptArr = Array.from(byDept.entries());
    if (deptArr.length >= 2) {
      deptArr.sort((a, b) => b[1].revenue - a[1].revenue);
      const top = deptArr[0];
      const bot = deptArr[deptArr.length - 1];
      if (top[1].revenue >= bot[1].revenue * 2 && top[1].won > 0) {
        recs.push({
          organization_id: orgId,
          recommendation_type: "department_winner",
          target_type: "department",
          target_id: null,
          target_label: top[0],
          title: `Departamento ${top[0]} converte muito mais`,
          description:
            `${top[0]} gerou R$ ${top[1].revenue.toFixed(0)} contra R$ ${bot[1].revenue.toFixed(0)} de ${bot[0]}. Priorizar ${top[0]} no Apollo Invisible Mode.`,
          severity: "info",
          impact_estimate: top[1].revenue,
          confidence_score: 0.7,
          metric_snapshot: { top, bot },
          dedup_key: `dept_winner:${top[0]}:${today}`,
          status: "open",
        });
      }
    }
  }

  return recs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    let body: { organization_id?: string } = {};
    try { body = await req.json(); } catch { /* */ }

    let q = admin.from("kairos_gtm_performance_summary").select("*").limit(5000);
    if (body.organization_id) q = q.eq("organization_id", body.organization_id);
    const { data, error } = await q;
    if (error) throw error;

    const recs = buildRecommendations((data ?? []) as Row[]);
    let upserted = 0;
    for (const r of recs) {
      const { error: upErr } = await admin
        .from("kairos_gtm_recommendations")
        .upsert(r, { onConflict: "organization_id,dedup_key" });
      if (upErr) {
        console.error("[gtm-rec] upsert", r.dedup_key, upErr.message);
      } else {
        upserted++;
      }
    }
    return json(200, { processed_rows: data?.length ?? 0, recommendations: recs.length, upserted });
  } catch (err) {
    console.error("[kairos-generate-gtm-recommendations]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
