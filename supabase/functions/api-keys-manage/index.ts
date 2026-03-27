import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "noid_";
  const randomBytes = new Uint8Array(40);
  crypto.getRandomValues(randomBytes);
  for (const byte of randomBytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Get user's organization
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: orgMember } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!orgMember) {
      return jsonResponse({ error: "Usuário não pertence a uma organização" }, 403);
    }

    // Only owner/admin can manage API keys
    if (!["owner", "admin"].includes(orgMember.role)) {
      return jsonResponse({ error: "Apenas administradores podem gerenciar API keys" }, 403);
    }

    const orgId = orgMember.organization_id;
    const body = req.method !== "GET" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "";

    // LIST
    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, name, key_prefix, scopes, active, created_at, last_used_at, expires_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return jsonResponse({ success: true, data });
    }

    // CREATE
    if (action === "create") {
      const name = body.name?.trim();
      if (!name) {
        return jsonResponse({ error: "name is required" }, 400);
      }

      const scopes = Array.isArray(body.scopes) ? body.scopes : [];
      const expiresAt = body.expires_at || null;

      const plainKey = generateApiKey();
      const keyHash = await hashKey(plainKey);
      const keyPrefix = plainKey.substring(0, 12);

      const { data, error } = await supabaseAdmin
        .from("api_keys")
        .insert([{
          organization_id: orgId,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          scopes,
          active: true,
          created_by: userId,
          expires_at: expiresAt,
        }])
        .select("id, name, key_prefix, scopes, active, created_at, expires_at")
        .single();

      if (error) throw error;

      // Return the plain key ONLY on creation
      return jsonResponse({
        success: true,
        data: { ...data, key: plainKey },
        message: "Guarde esta chave com segurança. Ela não será exibida novamente.",
      });
    }

    // REVOKE
    if (action === "revoke") {
      const keyId = body.id;
      if (!keyId) {
        return jsonResponse({ error: "id is required" }, 400);
      }

      const { error } = await supabaseAdmin
        .from("api_keys")
        .update({ active: false })
        .eq("id", keyId)
        .eq("organization_id", orgId);

      if (error) throw error;
      return jsonResponse({ success: true, message: "API key revogada com sucesso" });
    }

    // DELETE
    if (action === "delete") {
      const keyId = body.id;
      if (!keyId) {
        return jsonResponse({ error: "id is required" }, 400);
      }

      const { error } = await supabaseAdmin
        .from("api_keys")
        .delete()
        .eq("id", keyId)
        .eq("organization_id", orgId);

      if (error) throw error;
      return jsonResponse({ success: true, message: "API key excluída com sucesso" });
    }

    return jsonResponse({ error: "Unknown action. Use list, create, revoke, or delete" }, 400);
  } catch (err) {
    console.error("api-keys-manage error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
