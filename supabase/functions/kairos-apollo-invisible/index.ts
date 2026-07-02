// kairos-apollo-invisible
// Apollo como camada invisível do Kairós. Decide elegibilidade, executa enrichment,
// seleciona decisor por Contact Score, revela contatos e atualiza Qualified Queue + audit.
// NUNCA cria oportunidade/conta/contato no CRM.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  computeContactScore,
  departmentsForIcp,
  isIgnoredTitle,
  titleSeniorityScore,
} from "../_shared/apollo-icp-departments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  prospect_id: string;
  batch_run_id?: string | null;
  organization_id?: string | null;
  batch_credits_used?: number;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function emitEvent(admin: any, orgId: string, kind: string, payload: Record<string, unknown>) {
  try {
    await admin.from("system_events").insert({
      organization_id: orgId,
      event_type: kind,
      payload,
    });
  } catch { /* noop */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    if (!body?.prospect_id) return json(400, { error: "prospect_id required" });

    const { data: prospect } = await admin
      .from("prospects")
      .select("id, organization_id, company_name, normalized_domain, domain, icp_id")
      .eq("id", body.prospect_id)
      .maybeSingle();
    if (!prospect) return json(404, { error: "prospect_not_found" });

    const orgId = body.organization_id ?? prospect.organization_id;
    if (!orgId) return json(400, { error: "organization_id required" });

    const { data: rules } = await admin
      .from("apollo_auto_enrichment_rules")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    // Auto-create default rules if absent
    let effectiveRules = rules;
    if (!effectiveRules) {
      const { data: created } = await admin
        .from("apollo_auto_enrichment_rules")
        .insert({ organization_id: orgId })
        .select("*")
        .single();
      effectiveRules = created;
    }

    // Eligibility via DB function
    const { data: elig } = await admin
      .rpc("fn_apollo_should_run", { p_prospect_id: body.prospect_id, p_org: orgId });
    const e = Array.isArray(elig) ? elig[0] : elig;
    const priorityScore = e?.priority_score ?? 0;
    const companyName = prospect.company_name ?? "";

    // ICP category
    let icpCategory: string | null = null;
    if (prospect.icp_id) {
      const { data: icp } = await admin
        .from("icp_profiles")
        .select("category")
        .eq("id", prospect.icp_id)
        .maybeSingle();
      icpCategory = icp?.category ?? null;
    }

    if (!e?.eligible) {
      await admin.from("apollo_enrichment_audit").insert({
        organization_id: orgId,
        batch_run_id: body.batch_run_id ?? null,
        prospect_id: body.prospect_id,
        company_name: companyName,
        apollo_status: "skipped",
        skip_reason: e?.reason ?? "unknown",
        priority_score: priorityScore,
        icp_id: prospect.icp_id,
        icp_category: icpCategory,
      });
      await admin
        .from("kairos_qualified_queue")
        .update({ apollo_status: "skipped" })
        .eq("prospect_id", body.prospect_id)
        .eq("organization_id", orgId);
      await emitEvent(admin, orgId, "apollo_skipped", { prospect_id: body.prospect_id, reason: e?.reason });
      return json(200, { status: "skipped", reason: e?.reason });
    }

    // Check batch credit limit
    const batchUsed = body.batch_credits_used ?? 0;
    if (batchUsed >= (effectiveRules?.max_apollo_credits_per_batch ?? 200)) {
      await admin.from("apollo_enrichment_audit").insert({
        organization_id: orgId,
        batch_run_id: body.batch_run_id ?? null,
        prospect_id: body.prospect_id,
        company_name: companyName,
        apollo_status: "skipped",
        skip_reason: "batch_credit_limit_reached",
        priority_score: priorityScore,
      });
      return json(200, { status: "skipped", reason: "batch_credit_limit_reached" });
    }

    await emitEvent(admin, orgId, "apollo_enrichment_started", {
      prospect_id: body.prospect_id,
      icp_category: icpCategory,
      priority_score: priorityScore,
    });

    // Execute enrichment with department-aware custom titles
    const departments = departmentsForIcp(icpCategory);
    const customTitles = departments.flatMap((d) => [
      `Head of ${d}`,
      `Director of ${d}`,
      `Gerente de ${d}`,
      `Coordenador de ${d}`,
    ]);

    let enrichmentStatus = "failed";
    let creditsUsed = 0;
    try {
      const { data: enrich } = await admin.functions.invoke("run-apollo-enrichment", {
        body: {
          prospect_id: body.prospect_id,
          trigger_source: "system",
          custom_titles: customTitles,
        },
      });
      enrichmentStatus = (enrich as any)?.status ?? "failed";
      creditsUsed += 1;
    } catch (err) {
      console.warn("[apollo-invisible] enrichment fail", err);
    }

    // Fetch contacts (already merged-free)
    const { data: contacts } = await admin
      .from("enriched_contact_profiles")
      .select("id, full_name, role_title, seniority, department, email, email_status, phone, phone_source_type, linkedin_url, is_primary, confidence_score")
      .eq("prospect_id", body.prospect_id)
      .eq("is_merged", false)
      .order("confidence_score", { ascending: false });

    const scored = (contacts ?? [])
      .filter((c: any) => !isIgnoredTitle(c.role_title))
      .map((c: any) => {
        const deptMatch = departments.some(
          (d) => (c.department || "").toLowerCase().includes(d.toLowerCase()) ||
                 (c.role_title || "").toLowerCase().includes(d.toLowerCase())
        );
        const score = computeContactScore({
          email: c.email,
          email_status: c.email_status,
          phone: c.phone,
          phone_source_type: c.phone_source_type,
          seniority: c.seniority,
          role_title: c.role_title,
          linkedin_url: c.linkedin_url,
          icp_match: deptMatch,
        });
        return { ...c, _score: score, _dept_match: deptMatch };
      })
      .sort((a: any, b: any) => b._score - a._score);

    const maxContacts = effectiveRules?.max_contacts_per_company ?? 3;
    const toProcess = scored.slice(0, maxContacts);
    let revealed = 0;
    let primary: any = null;

    // Per-company caps
    let phoneRevealsThisRun = 0;
    let emailRevealsThisRun = 0;
    const maxPhonePerCompany = effectiveRules?.max_phone_reveals_per_company ?? 2;
    const maxEmailPerCompany = effectiveRules?.max_email_reveals_per_company ?? 0;
    const phoneMinScore = effectiveRules?.phone_reveal_min_score ?? 180;
    const emailMinScore = effectiveRules?.email_reveal_min_score ?? 220;
    const fallbackEmail = effectiveRules?.fallback_to_email_if_no_phone ?? false;
    const autoPhone = effectiveRules?.auto_reveal_phone ?? true;
    const autoEmail = effectiveRules?.auto_reveal_email ?? false;
    // Legacy flag still respected: if auto_reveal_contact is true, treat as both
    const legacyBoth = effectiveRules?.auto_reveal_contact === true && !autoPhone && !autoEmail;

    for (const c of toProcess) {
      if (titleSeniorityScore(c.seniority || c.role_title) >= 60 && !primary) primary = c;

      const score = c._score ?? 0;
      const wantPhone = (autoPhone || legacyBoth) && score >= phoneMinScore && phoneRevealsThisRun < maxPhonePerCompany;
      const wantEmail = (autoEmail || legacyBoth) && score >= emailMinScore && emailRevealsThisRun < maxEmailPerCompany;

      // Decide data type
      let dataType: 'phone' | 'email' | 'both' | null = null;
      if (wantPhone && wantEmail) dataType = 'both';
      else if (wantPhone) dataType = 'phone';
      else if (wantEmail) dataType = 'email';

      if (dataType) {
        try {
          const { data: revealRes } = await admin.functions.invoke("kairos-apollo-reveal-contact", {
            body: {
              contact_id: c.id,
              prospect_id: body.prospect_id,
              requested_data_type: dataType,
              source: 'apollo_invisible',
            },
          });
          const r = revealRes as any;
          if (r?.status === 'revealed' || r?.status === 'pending') {
            revealed += 1;
            if (dataType === 'phone' || dataType === 'both') phoneRevealsThisRun += 1;
            if (dataType === 'email' || dataType === 'both') emailRevealsThisRun += 1;
            creditsUsed += r?.credits_used ?? 0;
            await emitEvent(admin, orgId, "contact_revealed", { prospect_id: body.prospect_id, contact_id: c.id, data_type: dataType });
          } else if (r?.status === 'not_found' && dataType === 'phone' && fallbackEmail && (autoEmail || legacyBoth) && emailRevealsThisRun < maxEmailPerCompany && score >= emailMinScore) {
            // Fallback: telefone não encontrado, tentar e-mail
            const { data: fbRes } = await admin.functions.invoke("kairos-apollo-reveal-contact", {
              body: { contact_id: c.id, prospect_id: body.prospect_id, requested_data_type: 'email', source: 'apollo_invisible' },
            });
            const fr = fbRes as any;
            if (fr?.status === 'revealed') {
              revealed += 1;
              emailRevealsThisRun += 1;
              creditsUsed += fr?.credits_used ?? 0;
            }
          }
        } catch (err) {
          console.warn("[apollo-invisible] reveal fail", err);
        }
      }
    }

    if (!primary && toProcess.length > 0) primary = toProcess[0];

    if (effectiveRules?.auto_select_primary_contact && primary) {
      try {
        await admin.rpc("resolve_primary_contact_manual", {
          p_prospect_id: body.prospect_id,
          p_contact_id: primary.id,
        });
      } catch { /* noop */ }
    }

    const decisionMakerFound = !!primary && titleSeniorityScore(primary.seniority || primary.role_title) >= 60;
    const apolloStatus = scored.length === 0 ? "failed" : revealed === 0 ? "partial" : "enriched";

    await admin.from("apollo_enrichment_audit").insert({
      organization_id: orgId,
      batch_run_id: body.batch_run_id ?? null,
      prospect_id: body.prospect_id,
      company_name: companyName,
      apollo_status: apolloStatus,
      credits_used: creditsUsed,
      contacts_found: scored.length,
      contacts_revealed: revealed,
      primary_contact_id: primary?.id ?? null,
      decision_maker_found: decisionMakerFound,
      icp_id: prospect.icp_id,
      icp_category: icpCategory,
      priority_score: priorityScore,
      details: { enrichment_status: enrichmentStatus, departments },
    });

    await admin
      .from("kairos_qualified_queue")
      .update({
        apollo_status: apolloStatus,
        contacts_found: scored.length,
        primary_contact_name: primary?.full_name ?? null,
        primary_contact_role: primary?.role_title ?? null,
        primary_contact_score: primary?._score ?? null,
        decision_maker_status: decisionMakerFound ? "found" : null,
      })
      .eq("prospect_id", body.prospect_id)
      .eq("organization_id", orgId);

    await emitEvent(admin, orgId, "apollo_enrichment_completed", {
      prospect_id: body.prospect_id,
      status: apolloStatus,
      contacts_found: scored.length,
      revealed,
      credits_used: creditsUsed,
    });
    if (decisionMakerFound) {
      await emitEvent(admin, orgId, "decision_maker_found", {
        prospect_id: body.prospect_id,
        contact_id: primary?.id,
      });
    }

    return json(200, {
      status: apolloStatus,
      credits_used: creditsUsed,
      contacts_found: scored.length,
      contacts_revealed: revealed,
      decision_maker_found: decisionMakerFound,
      primary_contact_id: primary?.id ?? null,
    });
  } catch (err) {
    console.error("[kairos-apollo-invisible]", err);
    return json(500, { error: err instanceof Error ? err.message : "internal" });
  }
});
