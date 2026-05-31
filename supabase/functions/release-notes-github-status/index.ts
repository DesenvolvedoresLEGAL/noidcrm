// Release Notes — GitHub config status
// Retorna se as env vars do GitHub estão configuradas para enriquecer drafts
// com PRs reais. Apenas leitura, restrito a platform admins.
//
// Env vars consultadas:
//   - GITHUB_API_KEY        (token do connector GitHub via Lovable Gateway)
//   - GITHUB_DEFAULT_OWNER  (org/usuário dono do repo principal)
//   - GITHUB_DEFAULT_REPO   (nome do repositório principal)
//
// Sem essas, `generate-release-notes-draft` continua operando apenas com
// eventos internos (system_events, action_executions, migrations).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const required = ["GITHUB_API_KEY", "GITHUB_DEFAULT_OWNER", "GITHUB_DEFAULT_REPO"] as const;
    const missing = required.filter((k) => !(Deno.env.get(k) || "").trim());

    return new Response(
      JSON.stringify({ configured: missing.length === 0, missing }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[github-status] error", e);
    return new Response(
      JSON.stringify({ error: "internal", message: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
