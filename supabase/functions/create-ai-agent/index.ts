import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { name, description, objective, autonomy_level, agent_scope, primary_channel,
      prompt_system, prompt_deliberation, prompt_generation, prompt_review,
      source_type, source_text } = body;

    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization and profile
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "No profile found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = member.organization_id;
    const ownerId = profile.id;

    // Generate unique slug
    let baseSlug = slugify(name.trim());
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const { data: existing } = await supabase
        .from("ai_agents")
        .select("id")
        .eq("organization_id", orgId)
        .eq("slug", slug)
        .limit(1);
      if (!existing || existing.length === 0) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    // Insert agent
    const { data: agent, error: agentError } = await supabase
      .from("ai_agents")
      .insert({
        organization_id: orgId,
        owner_id: ownerId,
        name: name.trim(),
        slug,
        description: description || null,
        objective: objective || null,
        autonomy_level: autonomy_level || "observer",
        agent_scope: agent_scope || [],
        primary_channel: primary_channel || null,
        status: "draft",
        is_active: true,
      })
      .select()
      .single();

    if (agentError) {
      console.error("Agent insert error:", agentError);
      return new Response(JSON.stringify({ error: agentError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert version 1
    const configJson: Record<string, unknown> = {};
    if (source_type) configJson.source_type = source_type;
    if (source_text) configJson.source_text = source_text;

    const { data: version, error: versionError } = await supabase
      .from("ai_agent_versions")
      .insert({
        agent_id: agent.id,
        organization_id: orgId,
        version_number: 1,
        config_json: configJson,
        prompt_system: prompt_system || null,
        prompt_deliberation: prompt_deliberation || null,
        prompt_generation: prompt_generation || null,
        prompt_review: prompt_review || null,
        is_active: true,
        published_by: ownerId,
        change_summary: source_type === 'conversation' ? "Gerado via IA" : source_type === 'prompt_import' ? "Importado de prompt externo" : "Versão inicial",
      })
      .select()
      .single();

    if (versionError) {
      console.error("Version insert error:", versionError);
      // Cleanup agent
      await supabase.from("ai_agents").delete().eq("id", agent.id);
      return new Response(JSON.stringify({ error: versionError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert audit
    await supabase.from("ai_agent_audit").insert({
      organization_id: orgId,
      agent_id: agent.id,
      actor_id: ownerId,
      action_type: "created",
      payload_json: { name: agent.name, slug: agent.slug },
    });

    return new Response(
      JSON.stringify({ agent, version }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
