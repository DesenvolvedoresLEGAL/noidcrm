// Sprint D — Headless Humanoid: generic execute-action dispatcher.
// Resolves an action_key in action_registry, registers the execution, dispatches to
// the correct executor (rpc | edge_function), and completes the audit log.
// `service` executor_type is returned to the caller for client-side dispatch.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExecutorType = "rpc" | "edge_function" | "service" | "manual";

interface ActionDef {
  action_key: string;
  executor_type: ExecutorType;
  executor_ref: string | null;
  approval_required: boolean;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // Client running as the user → respects RLS + populates auth.uid() inside RPCs
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  // Service client used to read registry without RLS surprises
  const adminClient = createClient(SUPABASE_URL, SERVICE);

  let body: {
    action_key?: string;
    input?: Record<string, unknown>;
    context?: { entity_type?: string; entity_id?: string; surface?: string };
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.action_key) return json({ ok: false, error: "action_key_required" }, 400);

  // 1. Resolve action definition
  const { data: def, error: defErr } = await adminClient
    .from("action_registry")
    .select("action_key, executor_type, executor_ref, approval_required, is_active")
    .eq("action_key", body.action_key)
    .maybeSingle<ActionDef>();

  if (defErr || !def || !def.is_active) {
    return json({ ok: false, error: "action_not_found_or_inactive" }, 404);
  }

  // 2. Register execution (validates role, emits awaiting_approval if needed)
  const start = Date.now();
  const { data: reg, error: regErr } = await userClient.rpc("register_action_execution", {
    p_action_key: body.action_key,
    p_input: (body.input ?? {}) as never,
    p_entity_type: body.context?.entity_type ?? null,
    p_entity_id: body.context?.entity_id ?? null,
    p_surface: body.context?.surface ?? "api",
  });

  if (regErr) return json({ ok: false, error: regErr.message }, 400);
  const r = reg as {
    ok: boolean;
    error?: string;
    execution_id?: string;
    status?: "pending" | "awaiting_approval";
  };
  if (!r.ok) return json({ ok: false, error: r.error ?? "register_failed" }, 403);
  if (r.status === "awaiting_approval") {
    return json({ ok: true, awaiting_approval: true, execution_id: r.execution_id });
  }
  if (!r.execution_id) return json({ ok: false, error: "no_execution_id" }, 500);

  // 3. Service-type actions cannot be executed server-side here. Tell client to dispatch.
  if (def.executor_type === "service" || def.executor_type === "manual") {
    return json({
      ok: true,
      execution_id: r.execution_id,
      dispatch: "client",
      executor_type: def.executor_type,
      executor_ref: def.executor_ref,
    });
  }

  // 4. Dispatch
  let output: unknown = null;
  let errorMsg: string | null = null;
  let status: "succeeded" | "failed" = "succeeded";
  try {
    if (!def.executor_ref) throw new Error("executor_ref_missing");

    if (def.executor_type === "rpc") {
      const { data, error } = await userClient.rpc(def.executor_ref, (body.input ?? {}) as never);
      if (error) throw new Error(error.message);
      output = data;
    } else if (def.executor_type === "edge_function") {
      const { data, error } = await userClient.functions.invoke(def.executor_ref, {
        body: { ...(body.input ?? {}), execution_id: r.execution_id },
      });
      if (error) throw new Error(error.message);
      output = data;
    }
  } catch (err) {
    status = "failed";
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  // 5. Complete the execution
  await userClient.rpc("complete_action_execution", {
    p_execution_id: r.execution_id,
    p_status: status,
    p_output: (output ?? null) as never,
    p_after_state: null,
    p_error: errorMsg,
    p_duration_ms: Date.now() - start,
  });

  if (status === "failed") {
    return json({ ok: false, execution_id: r.execution_id, error: errorMsg }, 500);
  }
  return json({ ok: true, execution_id: r.execution_id, output });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
