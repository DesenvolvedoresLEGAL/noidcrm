// Generate Release Notes Draft
// Coleta PRs do GitHub (via connector gateway, opcional) + eventos internos do CRM
// e gera um rascunho (status='draft') em release_notes via OpenAI.
// Sempre cria como DRAFT — nunca publica direto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  period_days: z.number().int().min(1).max(60).default(14),
  trigger: z.enum(["manual", "scheduled"]).default("manual"),
  github_owner: z.string().optional(),
  github_repo: z.string().optional(),
});

type IngestionItem = {
  source: "github" | "system_events" | "action_executions" | "migrations" | "ai_runs";
  external_id: string;
  summary: string;
  payload: Record<string, unknown>;
};

const AIResponseSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(600).optional().default(""),
  is_major: z.boolean().default(false),
  changes: z
    .array(
      z.object({
        type: z.enum(["feature", "fix", "improvement", "security"]),
        description: z.string().min(3).max(280),
      }),
    )
    .min(1)
    .max(40),
});

function incrementVersion(last: string | null | undefined, isMajor: boolean): string {
  if (!last) return isMajor ? "2.0.0" : "1.0.0";
  const parts = last.split(".").map((x) => parseInt(x, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (isMajor) {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else {
    parts[1] += 1;
    parts[2] = 0;
  }
  return parts.join(".");
}

const DEFAULT_GH_OWNER = "DesenvolvedoresLEGAL";
const DEFAULT_GH_REPO = "noidcrm";

// Commits genéricos do bot — incluídos mas com peso menor na sumarização.
const GENERIC_COMMIT_RE = /^(changes|update|wip|fix typo|chore|merge( branch)?|initial commit|lovable[-\s]?dev)/i;

function isGenericCommit(msg: string): boolean {
  const first = (msg || "").split("\n")[0].trim();
  return first.length < 8 || GENERIC_COMMIT_RE.test(first);
}

async function ghFetch(path: string, hasGateway: boolean): Promise<Response> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const githubKey = Deno.env.get("GITHUB_API_KEY");
  if (hasGateway && lovableKey && githubKey) {
    return fetch(`https://connector-gateway.lovable.dev/github${path}`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": githubKey,
        Accept: "application/vnd.github+json",
      },
    });
  }
  return fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
}

async function collectGitHubPRs(opts: {
  periodDays: number;
  owner: string;
  repo: string;
}): Promise<IngestionItem[]> {
  const hasGateway = !!(Deno.env.get("LOVABLE_API_KEY") && Deno.env.get("GITHUB_API_KEY"));
  const since = new Date(Date.now() - opts.periodDays * 86400_000);
  const path = `/repos/${opts.owner}/${opts.repo}/pulls?state=closed&base=main&per_page=100&sort=updated&direction=desc`;
  try {
    let res = await ghFetch(path, hasGateway);
    if (!res.ok && hasGateway) {
      // fallback público
      res = await ghFetch(path, false);
    }
    if (!res.ok) {
      console.error("[release-draft] GitHub PRs fetch failed", res.status);
      return [];
    }
    const prs = (await res.json()) as Array<{
      number: number;
      title: string;
      body: string | null;
      merged_at: string | null;
      html_url: string;
      user: { login: string };
      labels: Array<{ name: string }>;
    }>;
    return (Array.isArray(prs) ? prs : [])
      .filter((pr) => pr.merged_at && new Date(pr.merged_at) >= since)
      .map((pr) => ({
        source: "github" as const,
        external_id: `pr-${pr.number}`,
        summary: pr.title,
        payload: {
          kind: "pr",
          number: pr.number,
          title: pr.title,
          body: (pr.body || "").slice(0, 800),
          merged_at: pr.merged_at,
          author: pr.user?.login,
          labels: pr.labels?.map((l) => l.name) || [],
          url: pr.html_url,
          weight: 2,
        },
      }));
  } catch (e) {
    console.error("[release-draft] GitHub PRs error", e);
    return [];
  }
}

async function collectGitHubCommits(opts: {
  periodDays: number;
  owner: string;
  repo: string;
}): Promise<IngestionItem[]> {
  const hasGateway = !!(Deno.env.get("LOVABLE_API_KEY") && Deno.env.get("GITHUB_API_KEY"));
  const since = new Date(Date.now() - opts.periodDays * 86400_000).toISOString();
  const path = `/repos/${opts.owner}/${opts.repo}/commits?sha=main&since=${since}&per_page=100`;
  try {
    let res = await ghFetch(path, hasGateway);
    if (!res.ok && hasGateway) res = await ghFetch(path, false);
    if (!res.ok) {
      console.error("[release-draft] GitHub commits fetch failed", res.status);
      return [];
    }
    const commits = (await res.json()) as Array<{
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } };
      author: { login: string } | null;
    }>;
    return (Array.isArray(commits) ? commits : []).map((c) => {
      const msg = c.commit?.message || "";
      const first = msg.split("\n")[0].trim();
      const generic = isGenericCommit(first);
      return {
        source: "github" as const,
        external_id: `commit-${c.sha}`,
        summary: first.slice(0, 200),
        payload: {
          kind: "commit",
          sha: c.sha.slice(0, 7),
          message: first.slice(0, 240),
          author: c.author?.login || c.commit?.author?.name,
          at: c.commit?.author?.date,
          url: c.html_url,
          generic,
          weight: generic ? 1 : 3,
        },
      };
    });
  } catch (e) {
    console.error("[release-draft] GitHub commits error", e);
    return [];
  }
}

async function collectSystemSignals(
  supa: any,
  periodDays: number,
): Promise<IngestionItem[]> {
  const since = new Date(Date.now() - periodDays * 86400_000).toISOString();
  const items: IngestionItem[] = [];

  // system_events relevantes
  const { data: events } = await supa
    .from("system_events")
    .select("id, event_type, event_category, action, payload, created_at")
    .gte("created_at", since)
    .in("event_category", ["release", "feature_flag", "migration", "security", "deployment"])
    .limit(200);
  for (const ev of events || []) {
    items.push({
      source: "system_events",
      external_id: `evt-${ev.id}`,
      summary: `${ev.event_category}/${ev.action}`,
      payload: { event_type: ev.event_type, action: ev.action, category: ev.event_category, at: ev.created_at },
    });
  }

  // action_executions relevantes — agrupado por action_key
  const { data: actions } = await supa
    .from("action_executions")
    .select("action_key, status, created_at")
    .gte("created_at", since)
    .in("status", ["succeeded", "failed"])
    .limit(1000);
  const grouped: Record<string, { ok: number; fail: number; last: string }> = {};
  for (const a of actions || []) {
    const k = a.action_key || "unknown";
    if (!grouped[k]) grouped[k] = { ok: 0, fail: 0, last: a.created_at };
    if (a.status === "succeeded") grouped[k].ok++;
    else grouped[k].fail++;
    if (a.created_at > grouped[k].last) grouped[k].last = a.created_at;
  }
  for (const [k, v] of Object.entries(grouped)) {
    if (v.ok + v.fail < 3) continue; // ignora ruído
    items.push({
      source: "action_executions",
      external_id: `act-${k}-${periodDays}d`,
      summary: `${k}: ${v.ok} ok, ${v.fail} fail`,
      payload: { action_key: k, ok: v.ok, fail: v.fail, period_days: periodDays, last: v.last },
    });
  }

  // ai_runs — agregado por agente (se tabela existir)
  try {
    const { data: airuns } = await supa
      .from("ai_runs")
      .select("id, created_at")
      .gte("created_at", since)
      .limit(1);
    if (airuns) {
      items.push({
        source: "ai_runs",
        external_id: `ai-runs-${periodDays}d`,
        summary: `${(airuns || []).length} ai runs no período`,
        payload: { period_days: periodDays },
      });
    }
  } catch (_) { /* tabela pode não existir */ }

  return items;
}

async function collectMigrations(periodDays: number): Promise<IngestionItem[]> {
  // schema_migrations vive em supabase_migrations schema. Acessível só via SQL bruto.
  // Tentativa best-effort via RPC inexistente — pulamos por padrão e deixamos como hook futuro.
  return [];
}

function sanitizePayload(p: Record<string, unknown>): Record<string, unknown> {
  const FORBIDDEN = /(token|secret|api[_-]?key|password|authorization|bearer|cookie|session|stack|trace|email|cpf|cnpj|phone|telefone|whatsapp)/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p || {})) {
    if (FORBIDDEN.test(k)) continue;
    if (typeof v === "string" && v.length > 400) out[k] = v.slice(0, 400);
    else if (typeof v === "object" && v !== null) {
      try { out[k] = JSON.parse(JSON.stringify(v)); } catch { /* skip */ }
    } else out[k] = v;
  }
  return out;
}

function deterministicDraft(items: IngestionItem[], period_days: number) {
  const changes: Array<{ type: "feature" | "fix" | "improvement" | "security"; description: string }> = [];
  const ghItems = items.filter((i) => i.source === "github");
  const sysItems = items.filter((i) => i.source === "system_events");
  const actItems = items.filter((i) => i.source === "action_executions");
  for (const pr of ghItems.slice(0, 30)) {
    const labels = (pr.payload as any)?.labels as string[] | undefined;
    const type: "feature" | "fix" | "improvement" | "security" =
      labels?.includes("security") ? "security"
      : labels?.includes("bug") || labels?.includes("fix") ? "fix"
      : labels?.includes("feature") ? "feature"
      : "improvement";
    changes.push({ type, description: pr.summary.slice(0, 240) });
  }
  for (const ev of sysItems.slice(0, 20)) {
    const cat = (ev.payload as any)?.category as string | undefined;
    changes.push({ type: cat === "security" ? "security" : "improvement", description: `Evento ${ev.summary}`.slice(0, 240) });
  }
  for (const a of actItems.slice(0, 10)) {
    changes.push({ type: "improvement", description: a.summary.slice(0, 240) });
  }
  if (changes.length === 0) {
    changes.push({ type: "improvement", description: `Atualizações internas dos últimos ${period_days} dias.` });
  }
  return {
    title: `Atualizações dos últimos ${period_days} dias`,
    description: `Rascunho gerado sem sumarização IA (fallback determinístico). Revise antes de publicar.`,
    is_major: false,
    changes: changes.slice(0, 40),
  };
}

async function logSystemEvent(
  supa: any,
  event_type: string,
  payload: Record<string, unknown>,
  actor_id?: string,
) {
  try {
    await supa.from("system_events").insert({
      trace_id: crypto.randomUUID(),
      actor_type: actor_id ? "user" : "system",
      actor_id: actor_id || null,
      event_type,
      event_category: "system",
      action: event_type,
      entity_type: "release_note",
      payload,
    });
  } catch (e) {
    console.error("[release-draft] logSystemEvent failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let callerId: string | undefined;

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "validation", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { period_days, trigger, github_owner, github_repo } = parsed.data;

    // Auth: manual exige platform admin; scheduled aceita chamada do cron (sem JWT de usuário).
    if (trigger === "manual") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        return new Response(JSON.stringify({ error: "unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: userRes } = await supa.auth.getUser(token);
      const uid = userRes?.user?.id;
      if (!uid) {
        return new Response(JSON.stringify({ error: "unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: isAdmin } = await supa.rpc("is_platform_admin", { _user_id: uid });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      callerId = uid;
    }

    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - period_days * 86400_000);

    const [ghItems, sysItems, migItems] = await Promise.all([
      collectGitHubPRs({
        periodDays: period_days,
        owner: github_owner || Deno.env.get("GITHUB_DEFAULT_OWNER") || undefined,
        repo: github_repo || Deno.env.get("GITHUB_DEFAULT_REPO") || undefined,
      }),
      collectSystemSignals(supa, period_days),
      collectMigrations(period_days),
    ]);
    const all: IngestionItem[] = [...ghItems, ...sysItems, ...migItems]
      .map((i) => ({ ...i, payload: sanitizePayload(i.payload) }));

    const keys = all.map((i) => i.external_id);
    const { data: existing } = await supa
      .from("release_notes_ingestion_log")
      .select("source, external_id")
      .in("external_id", keys.length ? keys : ["__none__"]);
    const existSet = new Set((existing || []).map((e) => `${e.source}:${e.external_id}`));
    const fresh = all.filter((i) => !existSet.has(`${i.source}:${i.external_id}`));

    console.log(`[release-draft] collected=${all.length} fresh=${fresh.length}`);

    if (fresh.length === 0) {
      return new Response(
        JSON.stringify({ success: true, created: false, message: "Nenhuma novidade no período.", items_used: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // 3. Sumariza via IA
    const inputForAI = fresh.map((i) => ({
      source: i.source,
      summary: i.summary,
      payload: i.payload,
    }));

    const today = new Date().toISOString().slice(0, 10);

    // 3. Sumarização via IA com fallback determinístico
    let ai: { title: string; description: string; is_major: boolean; changes: Array<{ type: "feature"|"fix"|"improvement"|"security"; description: string }> };
    let aiFallbackUsed = false;
    try {
      const aiRes = await callAI({
        model: "openai/gpt-5-mini",
        response_format: { type: "json_object" },
        feature: "release-notes-draft",
        messages: [
          {
            role: "system",
            content:
              `Hoje é ${today} (America/Sao_Paulo). Você é um redator técnico de release notes do NOID RevenueOS (CRM brasileiro). ` +
              `Receberá uma lista bruta de PRs do GitHub mergeados e eventos internos das últimas ${period_days} dias. ` +
              `Sua tarefa: agrupar tematicamente, eliminar ruído técnico, e produzir um rascunho executivo em pt-BR. ` +
              `Cada item de 'changes' deve ser uma frase clara para usuário final (não jargão de commit). ` +
              `Não inclua tokens, IDs internos, nomes de tabelas, stack traces, dados pessoais ou metadados sensíveis. ` +
              `Tipos permitidos: feature, fix, improvement, security. ` +
              `Marque is_major=true APENAS se houver mudança grande (nova área, refactor significativo, breaking change). ` +
              `Saída APENAS JSON válido: { title, description, is_major, changes: [{type, description}] }.`,
          },
          { role: "user", content: JSON.stringify({ period_days, items: inputForAI }, null, 2) },
        ],
      });
      let aiJson: unknown;
      try { aiJson = JSON.parse(aiRes.content); }
      catch {
        const m = aiRes.content.match(/\{[\s\S]*\}/);
        aiJson = m ? JSON.parse(m[0]) : null;
      }
      const aiParsed = AIResponseSchema.safeParse(aiJson);
      if (!aiParsed.success) {
        console.error("[release-draft] AI invalid output, using fallback", aiParsed.error.flatten());
        await logSystemEvent(supa, "release_note_generation_failed",
          { reason: "ai_output_invalid", period_days, items: fresh.length }, callerId);
        ai = deterministicDraft(fresh, period_days);
        aiFallbackUsed = true;
      } else {
        ai = aiParsed.data as typeof ai;
      }
    } catch (e) {
      console.error("[release-draft] AI call failed, using deterministic fallback", e);
      await logSystemEvent(supa, "release_note_generation_failed",
        { reason: "ai_call_error", message: (e as Error).message?.slice(0, 200), period_days, items: fresh.length }, callerId);
      ai = deterministicDraft(fresh, period_days);
      aiFallbackUsed = true;
    }



    // 4. Idempotência: se já houver draft aberto, anexa ao invés de criar novo
    const { data: openDraft } = await supa
      .from("release_notes")
      .select("id, version, changes, source_summary")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let releaseId: string;
    let version: string;

    if (openDraft) {
      const mergedChanges = [
        ...((openDraft.changes as Array<{ type: string; description: string }>) || []),
        ...ai.changes,
      ];
      const prev = (openDraft.source_summary as Record<string, number>) || {};
      const newSummary = {
        github_prs: (prev.github_prs || 0) + ghItems.length,
        system_events: (prev.system_events || 0) + sysItems.length,
        period_start: prev.period_start || periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
      };
      const { data: upd, error: updErr } = await supa
        .from("release_notes")
        .update({
          changes: mergedChanges,
          source_summary: newSummary,
        })
        .eq("id", openDraft.id)
        .select("id, version")
        .single();
      if (updErr) throw updErr;
      releaseId = upd.id;
      version = upd.version;
    } else {
      // 5. Próxima versão
      const { data: last } = await supa
        .from("release_notes")
        .select("version")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      version = incrementVersion(last?.version, ai.is_major);

      const { data: ins, error: insErr } = await supa
        .from("release_notes")
        .insert({
          version,
          title: ai.title,
          description: ai.description || `Rascunho gerado ${trigger === "scheduled" ? "automaticamente" : "manualmente"} a partir de ${fresh.length} sinais.`,
          release_date: today,
          is_major: ai.is_major,
          changes: ai.changes,
          status: "draft",
          generated_by: trigger,
          source_summary: {
            github_prs: ghItems.length,
            system_events: sysItems.length,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
          },
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      releaseId = ins.id;
    }

    // 6. Registra log de ingestão
    if (fresh.length > 0) {
      const logRows = fresh.map((i) => ({
        source: i.source,
        external_id: i.external_id,
        payload: i.payload,
        included_in_release: releaseId,
      }));
      const { error: logErr } = await supa
        .from("release_notes_ingestion_log")
        .insert(logRows);
      if (logErr) console.error("[release-draft] log insert error", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: !openDraft,
        appended: !!openDraft,
        release_id: releaseId,
        version,
        items_collected: all.length,
        items_used: fresh.length,
        github_prs: ghItems.length,
        system_events: sysItems.length,
        ai_fallback_used: aiFallbackUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[release-draft] fatal", e);
    await logSystemEvent(supa, "release_note_generation_failed",
      { reason: "internal_error", message: (e as Error).message?.slice(0, 200) }, callerId);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "Falha interna ao gerar rascunho. Verifique os logs." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

