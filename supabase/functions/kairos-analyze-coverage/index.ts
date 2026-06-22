// kairos-analyze-coverage (KAI.18)
// Smart Coverage Engine — diagnostica o que o NOID já sabe sobre uma empresa
// antes de gastar Apollo/SDR/tempo humano.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const DECISION_DEPARTMENTS = [
  "marketing",
  "eventos",
  "trade",
  "compras",
  "operacoes",
  "operações",
  "diretoria",
  "comercial",
];

const DECISION_TITLE_HINTS = ["head", "diretor", "director", "vp", "c-level", "ceo", "cmo", "cfo", "coo", "gerente", "manager"];

type ContactStatus = "none" | "partial" | "complete";
type DMStatus = "found" | "partial" | "absent";
type OppStatus = "open" | "won" | "lost" | "none";
type PropStatus = "sent" | "viewed" | "accepted" | "declined" | "none";
type CustomerStatus = "active" | "former" | "never";
type CoverageClass = "complete" | "good" | "partial" | "weak" | "new";

interface CoverageOutput {
  score: number;
  class: CoverageClass;
  missing: string[];
  recommendations: string[];
  next_best_action: string | null;
  apollo_blocked: boolean;
  analysis_id: string | null;
  account_id: string | null;
  flags: Record<string, unknown>;
}

function classify(score: number): CoverageClass {
  if (score >= 90) return "complete";
  if (score >= 70) return "good";
  if (score >= 40) return "partial";
  if (score >= 20) return "weak";
  return "new";
}

function isMobileBR(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  // BR mobile: 55 + DDD(2) + 9xxxxxxxx → 13 chars OR DDD(2)+9xxxxxxxx → 11 chars
  if (digits.length === 13 && digits.startsWith("55") && digits[4] === "9") return true;
  if (digits.length === 11 && digits[2] === "9") return true;
  return false;
}

function extractPhones(telefones: unknown): string[] {
  if (!telefones) return [];
  if (Array.isArray(telefones)) {
    return telefones
      .map((t: any) => (typeof t === "string" ? t : t?.numero ?? t?.phone ?? t?.value ?? ""))
      .filter(Boolean);
  }
  if (typeof telefones === "string") return [telefones];
  return [];
}

function isDecisionMaker(c: { cargo?: string | null; departamento?: string | null; seniority?: string | null; role_title?: string | null; department?: string | null }): boolean {
  const cargo = (c.cargo ?? c.role_title ?? "").toLowerCase();
  const dept = (c.departamento ?? c.department ?? "").toLowerCase();
  const sen = (c.seniority ?? "").toLowerCase();
  const isSenior = ["c_suite", "director", "vp", "head", "owner", "founder", "partner"].includes(sen);
  const titleHit = DECISION_TITLE_HINTS.some((h) => cargo.includes(h));
  const deptHit = DECISION_DEPARTMENTS.some((d) => dept.includes(d));
  return isSenior || (titleHit && (deptHit || dept === ""));
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => ({}))) as { prospect_id?: string; force_refresh?: boolean };
    if (!body.prospect_id) return json(400, { error: "prospect_id required" });

    // 1) Carrega prospect
    const { data: prospect, error: pErr } = await admin
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, cnpj, website")
      .eq("id", body.prospect_id)
      .maybeSingle();
    if (pErr || !prospect) return json(404, { error: "prospect_not_found" });

    const orgId: string = prospect.organization_id;
    const companyName: string = prospect.company_name ?? "";
    const domain: string | null = prospect.normalized_domain ?? null;
    const cnpj: string | null = prospect.cnpj ?? null;

    // 2) Match de conta (CNPJ → domínio → trigram)
    let account: any = null;
    if (cnpj) {
      const { data } = await admin.from("accounts").select("id, razao_social, nome_fantasia, website, cnpj")
        .eq("organization_id", orgId).eq("cnpj", cnpj).is("deleted_at", null).maybeSingle();
      if (data) account = data;
    }
    if (!account && domain) {
      const { data } = await admin.from("accounts").select("id, razao_social, nome_fantasia, website, cnpj")
        .eq("organization_id", orgId).ilike("website", `%${domain}%`).is("deleted_at", null).limit(1).maybeSingle();
      if (data) account = data;
    }
    if (!account && companyName) {
      try {
        const { data } = await admin.rpc("find_account_by_similarity" as any, { p_org: orgId, p_name: companyName, p_threshold: 0.7 });
        if (Array.isArray(data) && data.length > 0) account = data[0];
      } catch {/* RPC pode não existir; ignora */}
      if (!account) {
        // fallback ilike
        const { data } = await admin.from("accounts").select("id, razao_social, nome_fantasia, website, cnpj")
          .eq("organization_id", orgId).is("deleted_at", null).or(`razao_social.ilike.%${companyName}%,nome_fantasia.ilike.%${companyName}%`).limit(1).maybeSingle();
        if (data) account = data;
      }
    }

    const accountId: string | null = account?.id ?? null;
    const accountExists = !!accountId;

    // 3) Contatos e decisor
    let contacts: any[] = [];
    if (accountId) {
      const { data } = await admin.from("contacts")
        .select("id, cargo, departamento, telefones, emails")
        .eq("account_id", accountId).is("deleted_at", null);
      contacts = data ?? [];
    }
    // Considera também enriched_contact_profiles ligados ao prospect
    const { data: enriched } = await admin.from("enriched_contact_profiles")
      .select("id, role_title, department, seniority, phone, email, phone_revealed, email_revealed, is_merged")
      .eq("prospect_id", body.prospect_id);
    const enrichedRows = (enriched ?? []).filter((e: any) => !e.is_merged);

    const totalContacts = contacts.length + enrichedRows.length;
    const contactStatus: ContactStatus = totalContacts === 0 ? "none" : totalContacts < 3 ? "partial" : "complete";

    const dmCount = [
      ...contacts.map((c) => isDecisionMaker(c)),
      ...enrichedRows.map((c) => isDecisionMaker(c)),
    ].filter(Boolean).length;
    const dmStatus: DMStatus = dmCount === 0 ? "absent" : dmCount === 1 ? "partial" : "found";

    // 4) Telefone / WhatsApp
    const allPhones: string[] = [];
    for (const c of contacts) allPhones.push(...extractPhones(c.telefones));
    for (const e of enrichedRows) if (e.phone) allPhones.push(e.phone);
    const phoneExists = allPhones.some((p) => p && p.replace(/\D/g, "").length >= 8);
    const whatsappReady = allPhones.some(isMobileBR);

    // 5) Oportunidades
    let oppStatus: OppStatus = "none";
    if (accountId) {
      const { data: opps } = await admin.from("opportunities")
        .select("id, status, closed_at")
        .eq("account_id", accountId).is("deleted_at", null)
        .order("updated_at", { ascending: false }).limit(20);
      const list = opps ?? [];
      if (list.some((o: any) => o.status === "open" || o.status === "in_progress" || !o.closed_at)) oppStatus = "open";
      else if (list.some((o: any) => o.status === "won")) oppStatus = "won";
      else if (list.some((o: any) => o.status === "lost")) oppStatus = "lost";
    }

    // 6) Propostas (via oportunidades da conta)
    let propStatus: PropStatus = "none";
    if (accountId) {
      const { data: oppIdsRow } = await admin.from("opportunities").select("id").eq("account_id", accountId).is("deleted_at", null);
      const oppIds = (oppIdsRow ?? []).map((r: any) => r.id);
      if (oppIds.length > 0) {
        const { data: props } = await admin.from("proposals")
          .select("status, accepted_at, declined_at, viewed_at, sent_at")
          .in("opportunity_id" as any, oppIds)
          .order("updated_at", { ascending: false }).limit(10);
        const list = (props ?? []) as any[];
        if (list.some((p) => p.accepted_at || p.status === "accepted")) propStatus = "accepted";
        else if (list.some((p) => p.declined_at || p.status === "declined")) propStatus = "declined";
        else if (list.some((p) => p.viewed_at || p.status === "viewed")) propStatus = "viewed";
        else if (list.some((p) => p.sent_at || p.status === "sent")) propStatus = "sent";
      }
    }

    // 7) Receita histórica (via opportunities ganhas)
    let customerStatus: CustomerStatus = "never";
    if (accountId) {
      const { data: won } = await admin.from("opportunities")
        .select("closed_at")
        .eq("account_id", accountId).eq("status", "won").is("deleted_at", null)
        .order("closed_at", { ascending: false }).limit(1).maybeSingle();
      if (won?.closed_at) {
        const ageMs = Date.now() - new Date(won.closed_at).getTime();
        const days = ageMs / 86400000;
        customerStatus = days <= 365 ? "active" : "former";
      }
    }

    // 8) Score (pesos da spec)
    let score = 0;
    if (accountExists) score += 10;
    if (contactStatus === "complete") score += 15; else if (contactStatus === "partial") score += 8;
    if (dmStatus === "found") score += 20; else if (dmStatus === "partial") score += 10;
    if (phoneExists) score += 20;
    if (whatsappReady) score += 10;
    if (oppStatus !== "none") score += 10;
    if (propStatus !== "none") score += 5;
    if (customerStatus === "active") score += 10; else if (customerStatus === "former") score += 5;
    score = Math.min(100, score);

    const cls = classify(score);

    // 9) Missing items + recommendations
    const missing: string[] = [];
    const recommendations: string[] = [];
    if (!accountExists) { missing.push("Conta no CRM"); recommendations.push("create_account"); }
    if (contactStatus === "none") { missing.push("Contatos"); recommendations.push("add_contacts"); }
    if (dmStatus === "absent") { missing.push("Decisor"); recommendations.push("find_decision_maker"); }
    else if (dmStatus === "partial") { missing.push("Outros decisores"); }
    if (!phoneExists) { missing.push("Telefone"); recommendations.push("reveal_phone"); }
    if (!whatsappReady) { missing.push("WhatsApp (celular)"); }
    if (oppStatus === "none") { missing.push("Oportunidade aberta"); recommendations.push("create_opportunity"); }
    if (customerStatus === "former") { recommendations.push("reactivate_relationship"); }

    let nextBestAction: string | null = null;
    if (recommendations.includes("reveal_phone")) nextBestAction = "reveal_phone";
    else if (recommendations.includes("find_decision_maker")) nextBestAction = "find_decision_maker";
    else if (recommendations.includes("create_opportunity")) nextBestAction = "create_opportunity";
    else if (recommendations.includes("reactivate_relationship")) nextBestAction = "reactivate_relationship";
    else if (cls === "complete") nextBestAction = "no_apollo_needed";

    const apolloBlocked = score >= 90;

    // 10) Upsert (cache 24h via signature)
    const sigInput = JSON.stringify({
      accountExists, contactStatus, dmStatus, phoneExists, whatsappReady, oppStatus, propStatus, customerStatus,
    });
    const signature = await sha256(sigInput);

    const row = {
      organization_id: orgId,
      prospect_id: body.prospect_id,
      account_id: accountId,
      company_name: companyName,
      normalized_domain: domain,
      cnpj,
      account_exists: accountExists,
      contact_status: contactStatus,
      decision_maker_status: dmStatus,
      phone_exists: phoneExists,
      whatsapp_status: whatsappReady ? "ready" : "unknown",
      opportunity_status: oppStatus,
      proposal_status: propStatus,
      customer_status: customerStatus,
      coverage_score: score,
      coverage_class: cls,
      missing_items: missing,
      recommendations,
      next_best_action: nextBestAction,
      apollo_blocked: apolloBlocked,
      signature,
      analyzed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    const { data: upserted } = await admin
      .from("kairos_coverage_analysis")
      .upsert(row, { onConflict: "prospect_id,signature" })
      .select("id")
      .maybeSingle();

    // 11) Sincroniza na qualified queue (se existir)
    try {
      await admin.from("kairos_qualified_queue").update({
        coverage_score: score,
        coverage_class: cls,
        missing_items: missing,
        next_best_action: nextBestAction,
      }).eq("prospect_id", body.prospect_id);
    } catch {/* ignore */}

    const output: CoverageOutput = {
      score,
      class: cls,
      missing,
      recommendations,
      next_best_action: nextBestAction,
      apollo_blocked: apolloBlocked,
      analysis_id: upserted?.id ?? null,
      account_id: accountId,
      flags: {
        account_exists: accountExists,
        contact_status: contactStatus,
        decision_maker_status: dmStatus,
        phone_exists: phoneExists,
        whatsapp_status: whatsappReady ? "ready" : "unknown",
        opportunity_status: oppStatus,
        proposal_status: propStatus,
        customer_status: customerStatus,
      },
    };

    return json(200, output);
  } catch (e) {
    console.error("kairos-analyze-coverage error:", e);
    return json(500, { error: String(e) });
  }
});
