// Apollo enrichment preview — read-only eligibility + cost estimate (Sprint E.1.1)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ESTIMATED_CREDITS = 2;
const ANTI_SPAM_HOURS = 24;

function pickDomain(p: any): string | null {
  if (p?.normalized_domain) return p.normalized_domain;
  if (!p?.website) return null;
  try {
    const u = new URL(p.website.startsWith("http") ? p.website : `https://${p.website}`);
    return u.hostname.replace(/^www\./, "");
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { prospect_id } = await req.json().catch(() => ({}));
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: prospect } = await sb
      .from("prospects")
      .select("id, organization_id, company_name, website, normalized_domain, decision_maker_found")
      .eq("id", prospect_id)
      .maybeSingle();

    if (!prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: lastRun }, { data: score }, { data: lastJob }] = await Promise.all([
      sb.from("enrichment_runs").select("quality_label").eq("prospect_id", prospect_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("prospect_scores").select("priority_score").eq("prospect_id", prospect_id).maybeSingle(),
      sb.from("enrichment_jobs").select("id, status, created_at, contacts_found, decision_makers_found")
        .eq("prospect_id", prospect_id).eq("provider", "apollo")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const qLabel = (lastRun as any)?.quality_label ?? null;
    const pScore = Number((score as any)?.priority_score ?? 0);
    const domain = pickDomain(prospect);

    const cutoff = new Date(Date.now() - ANTI_SPAM_HOURS * 3600 * 1000).toISOString();
    const lastJobStatus = (lastJob as any)?.status ?? null;
    const lastContactsFound = Number((lastJob as any)?.contacts_found ?? 0);
    const recentJob = !!lastJob && (lastJob as any).created_at >= cutoff;
    const recentSuccessfulJob = recentJob && ["done"].includes(lastJobStatus) && lastContactsFound > 0;
    const recentRunningJob = recentJob && lastJobStatus === "running";
    const alreadyEnriched = recentSuccessfulJob;

    // Modo teste Kairós: filtros de quality_label/priority_score viram apenas warnings
    // (não bloqueiam disparo manual). Automações continuam respeitando-os no run-apollo-enrichment.
    let eligible = true;
    let reason: string | null = null;
    let warning: string | null = null;
    let review_required = false;
    let auto_send_allowed = false;

    const lowQuality = qLabel !== "high_confidence" && qLabel !== "usable";

    if (!domain) {
      eligible = false; reason = "Sem domínio disponível para busca Apollo.";
    } else if (recentRunningJob) {
      eligible = false; reason = "Já existe enriquecimento Apollo em execução.";
    } else if (recentSuccessfulJob) {
      eligible = false;
      reason = `Enriquecimento recente (${ANTI_SPAM_HOURS}h). Aguarde para reprocessar.`;
      warning = "Prospect já possui contatos enriquecidos nas últimas 24h.";
    } else if (recentJob) {
      warning = "Última tentativa não encontrou contatos úteis. Nova busca liberada imediatamente.";
    }

    if (eligible) {
      if (qLabel === "high_confidence") {
        review_required = false;
        auto_send_allowed = true;
      } else {
        // usable, low_confidence, sem run → permitido manual, automação revisa
        review_required = true;
        auto_send_allowed = false;
        const tag = qLabel ?? "sem run";
        warning = warning ?? `Modo teste Kairós: lead com qualidade "${tag}" (score ${pScore}). Enriquecimento manual liberado — automações continuam respeitando o filtro.`;
      }
    }

    return new Response(JSON.stringify({
      eligible,
      reason,
      warning,
      review_required,
      auto_send_allowed,
      estimated_credits: ESTIMATED_CREDITS,
      domain,
      company_name: (prospect as any).company_name,
      score: pScore,
      quality_label: qLabel,
      already_enriched: alreadyEnriched,
      decision_maker_found: !!prospect.decision_maker_found,
      last_job_at: (lastJob as any)?.created_at ?? null,
      last_job_status: (lastJob as any)?.status ?? null,
      last_contacts_found: (lastJob as any)?.contacts_found ?? null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("preview-apollo-enrichment error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
