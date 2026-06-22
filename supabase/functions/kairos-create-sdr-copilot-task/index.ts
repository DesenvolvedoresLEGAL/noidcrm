// kairos-create-sdr-copilot-task (KAI.19)
// Cria uma SDR Copilot task a partir de um item da Qualified Queue.
// NÃO envia mensagens, NÃO altera Forecast/OTE/Receita.
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

function pickPreferredChannel(opts: {
  hasPhone: boolean;
  hasMobile: boolean;
  hasEmail: boolean;
  hasLinkedin: boolean;
  isFormerCustomer: boolean;
}): "whatsapp" | "email" | "linkedin" | "call" {
  if (opts.isFormerCustomer && opts.hasPhone) return "call";
  if (opts.hasMobile) return "whatsapp";
  if (opts.hasEmail) return "email";
  if (opts.hasLinkedin) return "linkedin";
  if (opts.hasPhone) return "call";
  return "email";
}

function pickNextBestAction(opts: {
  coverageClass: string | null;
  channel: string;
  isFormerCustomer: boolean;
  hasOpenOpportunity: boolean;
  isDuplicate: boolean;
}): string {
  if (opts.isDuplicate) return "review_duplicate";
  if (opts.isFormerCustomer) return "reactivate_customer";
  if (opts.hasOpenOpportunity) return "create_activity";
  return opts.channel;
}

function isMobileBR(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55") && d[4] === "9") return true;
  if (d.length === 11 && d[2] === "9") return true;
  return false;
}

function computePriority(input: {
  queueScore: number;
  coverageScore: number | null;
  hasContact: boolean;
  hasBrief: boolean;
  recencyDays: number;
}): number {
  const queueComponent = (input.queueScore ?? 0) * 0.4;
  const coverageGap = input.coverageScore != null ? (100 - input.coverageScore) * 0.15 : 7.5;
  const contactComponent = input.hasContact ? 15 : 0;
  const briefComponent = input.hasBrief ? 10 : 0;
  const recency = Math.max(0, 10 - Math.min(10, input.recencyDays * 0.5));
  return Math.round((queueComponent + coverageGap + contactComponent + briefComponent + recency) * 10) / 10;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json(401, { error: "missing_authorization" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json(401, { error: "unauthorized" });
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const body = (await req.json().catch(() => ({}))) as {
      queue_id?: string;
      assigned_to?: string | null;
    };
    if (!body.queue_id) return json(400, { error: "queue_id_required" });

    // 1) Queue item
    const { data: qi, error: qErr } = await admin
      .from("kairos_qualified_queue")
      .select("*")
      .eq("id", body.queue_id)
      .maybeSingle();
    if (qErr || !qi) return json(404, { error: "queue_item_not_found" });

    // 2) Idempotência — task ativa
    const { data: existing } = await admin
      .from("kairos_sdr_copilot_tasks")
      .select("id, status, priority_score")
      .eq("queue_id", body.queue_id)
      .not("status", "in", "(completed,dismissed,promoted_to_crm)")
      .maybeSingle();
    if (existing) return json(200, { task_id: existing.id, reused: true });

    // 3) Smart Coverage (mais recente)
    const { data: coverage } = await admin
      .from("kairos_coverage_analysis")
      .select("*")
      .eq("prospect_id", qi.prospect_id)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4) Contato principal
    let contactRow: any = null;
    if (coverage?.account_id) {
      const { data: ct } = await admin
        .from("contacts")
        .select("id, nome, sobrenome, cargo, departamento, telefones, emails, is_primary")
        .eq("account_id", coverage.account_id)
        .is("deleted_at", null)
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ct) contactRow = ct;
    }
    // Enriched fallback
    let enriched: any = null;
    if (!contactRow) {
      const { data: er } = await admin
        .from("enriched_contact_profiles")
        .select("id, role_title, department, phone, email, linkedin_url, phone_revealed, email_revealed")
        .eq("prospect_id", qi.prospect_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      enriched = er;
    }

    const phones: string[] = [];
    if (contactRow?.telefones) {
      const arr = Array.isArray(contactRow.telefones) ? contactRow.telefones : [];
      for (const t of arr) {
        const v = typeof t === "string" ? t : (t?.numero ?? t?.phone ?? t?.value ?? "");
        if (v) phones.push(String(v));
      }
    }
    if (enriched?.phone) phones.push(enriched.phone);

    const hasPhone = phones.length > 0;
    const hasMobile = phones.some(isMobileBR);
    const hasEmail =
      (Array.isArray(contactRow?.emails) && contactRow.emails.length > 0) ||
      !!enriched?.email;
    const hasLinkedin = !!enriched?.linkedin_url;

    // 5) Commercial brief
    const { data: brief } = await admin
      .from("commercial_briefs")
      .select("*")
      .eq("prospect_id", qi.prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6) Heurísticas
    const isFormerCustomer = coverage?.customer_status === "former";
    const hasOpenOpportunity = coverage?.opportunity_status === "open";
    const isDuplicate = qi.qualification_status === "duplicate";

    const preferredChannel = pickPreferredChannel({
      hasPhone, hasMobile, hasEmail, hasLinkedin, isFormerCustomer,
    });
    const nextBestAction = pickNextBestAction({
      coverageClass: coverage?.coverage_class ?? null,
      channel: preferredChannel,
      isFormerCustomer,
      hasOpenOpportunity,
      isDuplicate,
    });

    const createdAt = new Date(qi.created_at).getTime();
    const recencyDays = (Date.now() - createdAt) / 86400000;

    const priority = computePriority({
      queueScore: qi.score ?? 0,
      coverageScore: coverage?.coverage_score ?? null,
      hasContact: !!contactRow || !!enriched,
      hasBrief: !!brief,
      recencyDays,
    });

    const reason = [
      coverage ? `cobertura ${coverage.coverage_class} (${coverage.coverage_score})` : "sem cobertura calculada",
      isFormerCustomer ? "cliente antigo" : null,
      hasOpenOpportunity ? "oportunidade aberta" : null,
      isDuplicate ? "possível duplicidade" : null,
    ].filter(Boolean).join(" · ");

    // 7) Insert
    const { data: inserted, error: insErr } = await admin
      .from("kairos_sdr_copilot_tasks")
      .insert({
        organization_id: qi.organization_id,
        queue_id: qi.id,
        prospect_id: qi.prospect_id,
        account_id: coverage?.account_id ?? null,
        contact_id: contactRow?.id ?? null,
        opportunity_id: null,
        assigned_to: body.assigned_to ?? qi.owner_id ?? null,
        status: "pending",
        priority_score: priority,
        preferred_channel: preferredChannel,
        next_best_action: nextBestAction,
        reason,
        commercial_brief: brief ?? {},
        suggested_messages: {},
        objections: (brief as any)?.objections ?? [],
        cta: (brief as any)?.cta ?? null,
      })
      .select("id")
      .single();
    if (insErr) {
      // unique violation → reused
      if ((insErr as any).code === "23505") {
        const { data: ex } = await admin
          .from("kairos_sdr_copilot_tasks").select("id")
          .eq("queue_id", body.queue_id)
          .not("status", "in", "(completed,dismissed,promoted_to_crm)")
          .maybeSingle();
        return json(200, { task_id: ex?.id, reused: true });
      }
      return json(500, { error: insErr.message });
    }

    // 8) Revenue event
    await admin.from("revenue_events").insert({
      organization_id: qi.organization_id,
      event_type: "sdr_copilot_task_created",
      actor_user_id: userId,
      payload: {
        task_id: inserted.id,
        queue_id: qi.id,
        prospect_id: qi.prospect_id,
        preferred_channel: preferredChannel,
        next_best_action: nextBestAction,
        priority_score: priority,
        coverage_score: coverage?.coverage_score ?? null,
        coverage_class: coverage?.coverage_class ?? null,
      },
    });

    return json(200, {
      task_id: inserted.id,
      reused: false,
      priority_score: priority,
      preferred_channel: preferredChannel,
      next_best_action: nextBestAction,
    });
  } catch (e) {
    console.error("kairos-create-sdr-copilot-task error:", e);
    return json(500, { error: String(e) });
  }
});
