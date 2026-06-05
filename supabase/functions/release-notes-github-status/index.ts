// Release Notes — GitHub config status (live check)
// Faz um ping real na GitHub API para confirmar que conseguimos ler commits/PRs
// do repositório configurado. Restrito a platform admins.
//
// Env vars consultadas (todas opcionais):
//   - GITHUB_API_KEY        (token do connector GitHub via Lovable Gateway, ou PAT GitHub)
//   - GITHUB_DEFAULT_OWNER  (override do owner — default DesenvolvedoresLEGAL)
//   - GITHUB_DEFAULT_REPO   (override do repo  — default noidcrm)
//
// O repo padrão é PÚBLICO, então a integração funciona mesmo sem token
// (rate limit 60 req/h por IP). Com token, sobe pra 5000/h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_OWNER = "DesenvolvedoresLEGAL";
const DEFAULT_REPO = "noidcrm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizeError(msg: string): string {
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer ***")
    .replace(/(token|key|secret)["':=\s]+[A-Za-z0-9._\-]+/gi, "$1=***")
    .slice(0, 240);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

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

    const owner = (Deno.env.get("GITHUB_DEFAULT_OWNER") || DEFAULT_OWNER).trim();
    const repo = (Deno.env.get("GITHUB_DEFAULT_REPO") || DEFAULT_REPO).trim();
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const githubKey = Deno.env.get("GITHUB_API_KEY");
    const hasGateway = !!(lovableKey && githubKey);

    // Live check: tenta ler /repos/{owner}/{repo} via gateway, com fallback público.
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    let configured = false;
    let mode: "gateway" | "public" | "none" = "none";
    let commitsCount = 0;
    let prsCount = 0;
    let lastError: string | undefined;

    const tryFetch = async (url: string, useGateway: boolean) => {
      const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
      if (useGateway && hasGateway) {
        headers.Authorization = `Bearer ${lovableKey}`;
        headers["X-Connection-Api-Key"] = githubKey!;
        url = `https://connector-gateway.lovable.dev/github${url}`;
      } else {
        url = `https://api.github.com${url}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return res.json();
    };

    // 1. Tenta commits via gateway, depois público
    try {
      const path = `/repos/${owner}/${repo}/commits?sha=main&since=${since}&per_page=100`;
      let commits: unknown[];
      if (hasGateway) {
        try {
          commits = await tryFetch(path, true);
          mode = "gateway";
        } catch (e) {
          lastError = `gateway: ${sanitizeError((e as Error).message)}`;
          commits = await tryFetch(path, false);
          mode = "public";
        }
      } else {
        commits = await tryFetch(path, false);
        mode = "public";
      }
      commitsCount = Array.isArray(commits) ? commits.length : 0;
      configured = true;
    } catch (e) {
      lastError = sanitizeError((e as Error).message);
    }

    // 2. PRs (best-effort)
    if (configured) {
      try {
        const path = `/repos/${owner}/${repo}/pulls?state=closed&base=main&per_page=100&sort=updated&direction=desc`;
        const prs = (await tryFetch(path, mode === "gateway")) as Array<{ merged_at?: string | null }>;
        const cutoff = new Date(Date.now() - 7 * 86400_000);
        prsCount = (prs || []).filter((p) => p.merged_at && new Date(p.merged_at) >= cutoff).length;
      } catch (_) { /* não bloqueia */ }
    }

    const missing: string[] = [];
    if (!Deno.env.get("GITHUB_API_KEY")) missing.push("GITHUB_API_KEY");
    if (!Deno.env.get("GITHUB_DEFAULT_OWNER")) missing.push("GITHUB_DEFAULT_OWNER");
    if (!Deno.env.get("GITHUB_DEFAULT_REPO")) missing.push("GITHUB_DEFAULT_REPO");

    return new Response(
      JSON.stringify({
        configured,
        mode,
        owner,
        repo,
        commits_last_7d: commitsCount,
        prs_last_7d: prsCount,
        missing,
        last_check_at: new Date().toISOString(),
        last_error: lastError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[github-status] error", e);
    return new Response(
      JSON.stringify({ error: "internal", message: sanitizeError((e as Error).message) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
