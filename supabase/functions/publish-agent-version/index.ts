import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agent_id, version_id, environment } = await req.json();
    if (!agent_id || !version_id) {
      return new Response(JSON.stringify({ error: "agent_id and version_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetEnv = environment || "production";

    // Get user org
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = member.organization_id;

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    // Check permission
    const { data: perm } = await supabase
      .from("ai_agent_permissions")
      .select("can_publish")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    // If permissions table has an entry and can_publish is false, deny
    if (perm && !perm.can_publish) {
      return new Response(JSON.stringify({ error: "Sem permissão para publicar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify agent belongs to org
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("id, organization_id, last_published_version_id")
      .eq("id", agent_id)
      .eq("organization_id", orgId)
      .single();
    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify version belongs to agent
    const { data: version } = await supabase
      .from("ai_agent_versions")
      .select("id, version_number")
      .eq("id", version_id)
      .eq("agent_id", agent_id)
      .single();
    if (!version) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousVersionId = agent.last_published_version_id;

    // Unpublish all versions of this agent
    await supabase
      .from("ai_agent_versions")
      .update({ is_published: false, is_active: false })
      .eq("agent_id", agent_id);

    // Publish selected version
    await supabase
      .from("ai_agent_versions")
      .update({
        is_published: true,
        is_active: true,
        published_at: new Date().toISOString(),
        published_by: profile?.id || null,
        environment: targetEnv,
      })
      .eq("id", version_id);

    // Update agent
    await supabase
      .from("ai_agents")
      .update({
        last_published_version_id: version_id,
        environment: targetEnv,
        status: targetEnv === "paused" ? "paused" : targetEnv === "production" ? "production" : targetEnv === "test" ? "test" : "draft",
      })
      .eq("id", agent_id);

    // Record publish history
    await supabase.from("ai_agent_publish_history").insert({
      organization_id: orgId,
      agent_id,
      version_id,
      published_by: profile?.id || null,
      previous_version_id: previousVersionId || null,
      environment: targetEnv,
    });

    // Audit
    await supabase.from("ai_agent_audit").insert({
      organization_id: orgId,
      agent_id,
      actor_id: profile?.id || null,
      action_type: "published",
      payload_json: { version_id, version_number: version.version_number, environment: targetEnv },
    });

    return new Response(JSON.stringify({ success: true, version_id, environment: targetEnv }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
