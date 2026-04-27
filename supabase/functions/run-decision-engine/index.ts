import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DecisionRule {
  id: string;
  organization_id: string;
  name: string;
  priority: number;
  min_score: number | null;
  max_score: number | null;
  min_confidence: number | null;
  min_contact_score: number | null;
  action_create_opportunity: boolean;
  action_create_task: boolean;
  action_assign_owner: boolean;
  action_enroll_sequence: boolean;
  pipeline_id: string | null;
  stage_id: string | null;
  sequence_id: string | null;
  owner_strategy: string | null;
  fixed_owner_user_id: string | null;
  owner_role_filter: string | null;
  priority_label: string | null;
  task_template: Record<string, any>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderTemplate(tpl: string | undefined, vars: Record<string, any>): string {
  if (!tpl) return "";
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

function pickRule(rules: DecisionRule[], score: number, confidence: number, contactScore: number): DecisionRule | null {
  for (const r of rules) {
    if (r.min_score != null && score < r.min_score) continue;
    if (r.max_score != null && score > r.max_score) continue;
    if (r.min_confidence != null && confidence < r.min_confidence) continue;
    if (r.min_contact_score != null && contactScore < r.min_contact_score) continue;
    return r;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { prospect_id, enrichment_run_id, organization_id, dry_run } = await req.json();

    if (!prospect_id || !organization_id) {
      return jsonResponse({ error: "prospect_id and organization_id are required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Anti-loop: já executou para este enrichment_run_id?
    if (enrichment_run_id) {
      const { data: existingLog } = await supabase
        .from("decision_logs")
        .select("*")
        .eq("prospect_id", prospect_id)
        .eq("enrichment_run_id", enrichment_run_id)
        .eq("decision_taken", "executed")
        .maybeSingle();
      if (existingLog) {
        return jsonResponse({ skipped: "already_executed", log: existingLog });
      }
    }

    // Carregar prospect
    const { data: prospect, error: prospectErr } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .maybeSingle();
    if (prospectErr || !prospect) {
      return jsonResponse({ error: "prospect not found" }, 404);
    }

    // Carregar enrichment_run + score
    const { data: run } = enrichment_run_id
      ? await supabase.from("enrichment_runs").select("*").eq("id", enrichment_run_id).maybeSingle()
      : { data: null as any };

    const { data: scoreRow } = await supabase
      .from("prospect_scores")
      .select("*")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const score = Math.round(Number(scoreRow?.priority_score ?? 0));
    const confidence = Math.round(Number(run?.quality_score ?? 0));
    const qualityLabel: string | null = run?.quality_label ?? null;
    const contactScore = 0; // placeholder até existir contact scoring

    // Anti-baixa-qualidade
    if (qualityLabel === "low_confidence" || qualityLabel === "insufficient") {
      const { data: log } = await supabase
        .from("decision_logs")
        .insert({
          organization_id,
          prospect_id,
          enrichment_run_id: enrichment_run_id ?? null,
          score,
          confidence,
          quality_label: qualityLabel,
          decision_taken: "skipped_low_quality",
          decision_payload: { reason: "quality_label below threshold" },
        })
        .select()
        .single();
      return jsonResponse({ decision_taken: "skipped_low_quality", log });
    }

    // Anti-duplicação: oportunidade aberta para o prospect?
    let duplicateOppId: string | null = null;
    if (prospect.matched_account_id) {
      const { data: openOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("account_id", prospect.matched_account_id)
        .is("deleted_at", null)
        .not("status", "in", "(won,lost)")
        .limit(1);
      if (openOpps && openOpps.length > 0) duplicateOppId = openOpps[0].id;
    } else {
      const { data: openOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("prospect_id", prospect_id)
        .is("deleted_at", null)
        .not("status", "in", "(won,lost)")
        .limit(1);
      if (openOpps && openOpps.length > 0) duplicateOppId = openOpps[0].id;
    }
    if (duplicateOppId) {
      const { data: log } = await supabase
        .from("decision_logs")
        .insert({
          organization_id,
          prospect_id,
          enrichment_run_id: enrichment_run_id ?? null,
          score,
          confidence,
          quality_label: qualityLabel,
          decision_taken: "skipped_duplicate",
          decision_payload: { existing_opportunity_id: duplicateOppId },
        })
        .select()
        .single();
      return jsonResponse({ decision_taken: "skipped_duplicate", log });
    }

    // Match de regras
    const { data: rules } = await supabase
      .from("decision_rules")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    const rule = pickRule((rules ?? []) as DecisionRule[], score, confidence, contactScore);

    if (!rule) {
      const { data: log } = await supabase
        .from("decision_logs")
        .insert({
          organization_id,
          prospect_id,
          enrichment_run_id: enrichment_run_id ?? null,
          score,
          confidence,
          quality_label: qualityLabel,
          decision_taken: "skipped_no_rule",
          decision_payload: { score, confidence },
        })
        .select()
        .single();
      return jsonResponse({ decision_taken: "skipped_no_rule", log });
    }

    if (dry_run) {
      return jsonResponse({
        dry_run: true,
        rule_matched: rule,
        would_execute: {
          create_opportunity: rule.action_create_opportunity,
          assign_owner: rule.action_assign_owner,
          create_task: rule.action_create_task,
          enroll_sequence: rule.action_enroll_sequence,
        },
      });
    }

    // Executar ações (idempotentes, try/catch individual)
    const actions: Record<string, any> = {};
    const errors: string[] = [];

    // 1. Resolver/criar account_id
    let accountId: string | null = prospect.matched_account_id ?? null;
    if (rule.action_create_opportunity && !accountId) {
      try {
        const baseAccount: any = {
          organization_id,
          razao_social: prospect.razao_social ?? prospect.company_name,
          nome_fantasia: prospect.nome_fantasia ?? prospect.company_name,
          cnpj: prospect.cnpj ?? null,
          website: prospect.website ?? null,
          cnae: prospect.cnae_code ?? null,
          segmento: prospect.industry ?? null,
          porte: prospect.porte ?? null,
          cidade: prospect.cidade_enriched ?? prospect.city ?? null,
          uf: prospect.uf_enriched ?? prospect.state ?? null,
          origem_principal: "caramelo",
          tipo_empresa: "prospect",
        };
        const { data: newAccount, error: accErr } = await supabase
          .from("accounts")
          .insert(baseAccount)
          .select("id")
          .single();
        if (accErr) throw accErr;
        accountId = newAccount.id;
        actions.account_id = accountId;
        await supabase
          .from("prospects")
          .update({ matched_account_id: accountId })
          .eq("id", prospect_id);
      } catch (e: any) {
        errors.push(`create_account: ${e.message}`);
      }
    }

    // 2. Owner (round-robin / fixed)
    let ownerUserId: string | null = null;
    if (rule.action_assign_owner) {
      try {
        if (rule.owner_strategy === "fixed" && rule.fixed_owner_user_id) {
          ownerUserId = rule.fixed_owner_user_id;
        } else {
          const { data: oid } = await supabase.rpc("claim_next_owner_round_robin", {
            _organization_id: organization_id,
            _role_filter: rule.owner_role_filter,
          });
          ownerUserId = (oid as string) ?? null;
        }
        if (ownerUserId) actions.owner_user_id = ownerUserId;
      } catch (e: any) {
        errors.push(`assign_owner: ${e.message}`);
      }
    }

    // 3. Oportunidade
    let opportunityId: string | null = null;
    if (rule.action_create_opportunity && accountId) {
      try {
        const title = `LEAD - ${(prospect.company_name ?? "EMPRESA").toUpperCase()}`;
        const { data: opp, error: oppErr } = await supabase
          .from("opportunities")
          .insert({
            organization_id,
            account_id: accountId,
            title,
            owner_user_id: ownerUserId,
            pipeline_id: rule.pipeline_id,
            stage_id: rule.stage_id,
            origem: "caramelo",
            fonte: "decision_engine",
            status: "open",
            priority_score: score,
            prospect_id,
            playbook_run_id: prospect.playbook_run_id ?? null,
            source_metadata: {
              caramelo: true,
              rule_id: rule.id,
              rule_name: rule.name,
              priority_label: rule.priority_label,
              score,
              confidence,
            },
          })
          .select("id")
          .single();
        if (oppErr) throw oppErr;
        opportunityId = opp.id;
        actions.opportunity_id = opportunityId;
      } catch (e: any) {
        errors.push(`create_opportunity: ${e.message}`);
      }
    }

    // 4. Task (activities + outbound_tasks espelho)
    if (rule.action_create_task) {
      try {
        const tpl = rule.task_template ?? {};
        const vars = {
          company_name: prospect.company_name ?? "",
          score,
          confidence,
          industry: prospect.industry ?? "",
        };
        const taskType: string = tpl.task_type ?? "call";
        const subject = renderTemplate(tpl.subject, vars) || `Atuar lead ${prospect.company_name ?? ""}`;
        const description = renderTemplate(tpl.description, vars);
        const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: act, error: actErr } = await supabase
          .from("activities")
          .insert({
            organization_id,
            opportunity_id: opportunityId,
            account_id: accountId,
            owner_user_id: ownerUserId,
            type: taskType,
            title: subject,
            description,
            status: "pending",
            scheduled_date: dueAt,
            is_automated: true,
            ai_generated: true,
          })
          .select("id")
          .single();
        if (actErr) throw actErr;
        actions.activity_id = act.id;

        await supabase.from("outbound_tasks").insert({
          organization_id,
          prospect_id,
          account_id: accountId,
          opportunity_id: opportunityId,
          owner_user_id: ownerUserId,
          task_type: taskType,
          payload: { subject, description, activity_id: act.id, ...tpl },
          due_at: dueAt,
          status: "pending",
        });
      } catch (e: any) {
        errors.push(`create_task: ${e.message}`);
      }
    }

    // 5. Sequence
    if (rule.action_enroll_sequence && rule.sequence_id && opportunityId) {
      try {
        const { data: enr, error: enrErr } = await supabase
          .from("sequence_enrollments")
          .insert({
            organization_id,
            sequence_id: rule.sequence_id,
            opportunity_id: opportunityId,
            status: "active",
          })
          .select("id")
          .single();
        if (enrErr) throw enrErr;
        actions.sequence_enrollment_id = enr.id;
      } catch (e: any) {
        errors.push(`enroll_sequence: ${e.message}`);
      }
    }

    const decisionTaken = errors.length === 0 ? "executed" : "failed";

    const { data: log } = await supabase
      .from("decision_logs")
      .insert({
        organization_id,
        prospect_id,
        enrichment_run_id: enrichment_run_id ?? null,
        rule_id: rule.id,
        score,
        confidence,
        quality_label: qualityLabel,
        decision_taken: decisionTaken,
        actions_executed: actions,
        decision_payload: {
          rule_name: rule.name,
          priority_label: rule.priority_label,
          score,
          confidence,
        },
        error_message: errors.length > 0 ? errors.join(" | ") : null,
      })
      .select()
      .single();

    return jsonResponse({
      decision_taken: decisionTaken,
      rule_applied: { id: rule.id, name: rule.name, priority_label: rule.priority_label },
      actions_executed: actions,
      errors,
      log,
    });
  } catch (e: any) {
    console.error("run-decision-engine error:", e);
    return jsonResponse({ error: e.message ?? "unknown" }, 500);
  }
});
