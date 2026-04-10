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

    const { agent_id } = await req.json();
    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) {
      return new Response(JSON.stringify({ allowed: false, reason: "No organization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = member.organization_id;

    // Get agent
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("id, environment, is_paused, autonomy_level, is_active, last_published_version_id")
      .eq("id", agent_id)
      .eq("organization_id", orgId)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ allowed: false, reason: "Agente não encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rule 5: paused
    if (agent.is_paused) {
      return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Agente está pausado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rule 1: must be production
    if (agent.environment !== "production") {
      return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: `Agente está em ambiente '${agent.environment}', não em produção` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Must have published version
    if (!agent.last_published_version_id) {
      return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Nenhuma versão publicada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user permission
    const { data: perm } = await supabase
      .from("ai_agent_permissions")
      .select("can_execute, can_run_autonomous")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (perm && !perm.can_execute) {
      return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Sem permissão de execução" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check environment config
    const { data: envConfig } = await supabase
      .from("ai_agent_environments")
      .select("allow_execution, require_approval, allow_autonomous")
      .eq("organization_id", orgId)
      .eq("environment", "production")
      .limit(1)
      .single();

    if (envConfig && !envConfig.allow_execution) {
      return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Execução desabilitada no ambiente de produção" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rule 4: autonomous check
    if (agent.autonomy_level === "autonomous") {
      if (envConfig && !envConfig.allow_autonomous) {
        return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Autonomia total não permitida neste ambiente" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (perm && !perm.can_run_autonomous) {
        return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Sem permissão para executar agentes autônomos" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check execution policies
    const { data: policies } = await supabase
      .from("ai_agent_execution_policies")
      .select("requires_approval, blocked")
      .eq("organization_id", orgId)
      .or(`agent_id.eq.${agent_id},agent_id.is.null`)
      .order("agent_id", { ascending: false, nullsFirst: false });

    if (policies) {
      for (const p of policies) {
        if (p.blocked) {
          return new Response(JSON.stringify({ allowed: false, requires_approval: false, reason: "Execução bloqueada por política" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Rule 3: approval required
    let requiresApproval = false;
    if (agent.autonomy_level === "assisted") {
      requiresApproval = true;
    }
    if (envConfig && envConfig.require_approval) {
      requiresApproval = true;
    }
    if (policies) {
      for (const p of policies) {
        if (p.requires_approval) requiresApproval = true;
      }
    }

    return new Response(JSON.stringify({
      allowed: true,
      requires_approval: requiresApproval,
      reason: requiresApproval ? "Aprovação obrigatória" : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
