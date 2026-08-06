// kairos-apollo-reveal-contact (KAI.18.13)
// Orquestrador oficial de revelação Apollo. Toda a lógica vive em _shared/apollo-reveal-core.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runApolloReveal, type DataType } from "../_shared/apollo-reveal-core.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!APOLLO_API_KEY) return json(500, { error: "APOLLO_API_KEY not configured" });

    const body = (await req.json().catch(() => ({}))) as {
      contact_id?: string;
      prospect_id?: string;
      requested_data_type?: DataType;
      source?: string;
    };
    if (!body?.contact_id) return json(400, { error: "contact_id required" });
    const dataType: DataType = body.requested_data_type ?? "both";
    if (!["profile_only", "email", "phone", "both"].includes(dataType)) {
      return json(400, { error: "invalid requested_data_type" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let requestedBy: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userRes } = await userClient.auth.getUser();
      requestedBy = userRes?.user?.id ?? null;
    }

    const result = await runApolloReveal(
      admin,
      {
        contact_id: body.contact_id,
        prospect_id: body.prospect_id ?? null,
        requested_data_type: dataType,
        source: body.source ?? "manual",
        requested_by: requestedBy,
      },
      {
        APOLLO_API_KEY,
        SUPABASE_URL,
        APOLLO_WEBHOOK_TOKEN: Deno.env.get("APOLLO_WEBHOOK_TOKEN") ?? "",
      },
    );

    return json(200, result);
  } catch (e) {
    console.error("kairos-apollo-reveal-contact error:", e);
    return json(200, {
      success: false,
      overall_status: "failed",
      status: "failed",
      reason: String((e as any)?.message ?? e),
    });
  }
});
