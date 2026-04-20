// Centralized AI client wrapper.
// Provides a single entry point for all edge functions to call LLMs.
// Defaults to OpenAI (api.openai.com); falls back to Lovable AI Gateway when
// AI_PROVIDER=lovable or when OPENAI_API_KEY is missing.
//
// Usage:
//   import { callAI } from "../_shared/ai-client.ts";
//   const { content, usage } = await callAI({
//     model: "google/gemini-2.5-flash", // legacy id is auto-mapped
//     messages: [{ role: "user", content: "..." }],
//     response_format: { type: "json_object" },
//   });

export type AIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type AIToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type CallAIOptions = {
  model?: string;
  messages: AIMessage[];
  response_format?: { type: "json_object" | "text" };
  tools?: AIToolDef[];
  tool_choice?: unknown;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  stream?: boolean;
  // override provider for this call
  provider?: "openai" | "lovable";
  // logging context
  feature?: string;
  organization_id?: string;
};

export type CallAIResult = {
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  raw: any;
  model_used: string;
  provider_used: "openai" | "lovable";
  latency_ms: number;
};

// Map legacy / Gemini model ids to OpenAI equivalents.
// When provider=lovable, the original id is used.
const MODEL_MAP_TO_OPENAI: Record<string, string> = {
  "google/gemini-2.5-pro": "gpt-5",
  "google/gemini-2.5-flash": "gpt-5-mini",
  "google/gemini-2.5-flash-lite": "gpt-5-nano",
  "google/gemini-3-flash-preview": "gpt-5-mini",
  "google/gemini-3.1-pro-preview": "gpt-5",
  "google/gemini-3-pro-image-preview": "gpt-5",
  // pass-through (already OpenAI ids)
  "openai/gpt-5": "gpt-5",
  "openai/gpt-5-mini": "gpt-5-mini",
  "openai/gpt-5-nano": "gpt-5-nano",
  "openai/gpt-5.2": "gpt-5.2",
};

const DEFAULT_MODEL = "gpt-5-mini";

function resolveProvider(opts: CallAIOptions): "openai" | "lovable" {
  if (opts.provider) return opts.provider;
  const envProvider = (Deno.env.get("AI_PROVIDER") || "openai").toLowerCase();
  if (envProvider === "lovable") return "lovable";
  // If OPENAI_API_KEY missing, fall back to Lovable.
  if (!Deno.env.get("OPENAI_API_KEY")) return "lovable";
  return "openai";
}

function resolveModel(model: string | undefined, provider: "openai" | "lovable"): string {
  if (!model) return provider === "openai" ? DEFAULT_MODEL : "google/gemini-2.5-flash";
  if (provider === "openai") {
    return MODEL_MAP_TO_OPENAI[model] ?? (model.startsWith("gpt-") ? model : DEFAULT_MODEL);
  }
  // lovable provider — use as-is, but accept openai/* ids too (gateway supports them)
  return model;
}

/**
 * Get today's date as ISO yyyy-mm-dd in Brasilia timezone (America/Sao_Paulo).
 * Use this when injecting "today" context into prompts.
 */
export function getTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // yyyy-mm-dd
}

/**
 * Standard date-context system prompt fragment to prepend to any system message
 * that involves date reasoning. Prevents "time travel" hallucinations.
 */
export function dateContextPrompt(): string {
  const today = getTodayISO();
  return `CONTEXTO TEMPORAL CRÍTICO: Hoje é ${today} (timezone America/Sao_Paulo). Qualquer sugestão de data futura DEVE ser >= ${today}. NUNCA sugira datas no passado.`;
}

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const provider = resolveProvider(opts);
  const model = resolveModel(opts.model, provider);

  const url = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const apiKey = provider === "openai"
    ? Deno.env.get("OPENAI_API_KEY")
    : Deno.env.get("LOVABLE_API_KEY");

  if (!apiKey) {
    throw new Error(
      `[ai-client] Missing API key for provider=${provider}. ` +
      `Set ${provider === "openai" ? "OPENAI_API_KEY" : "LOVABLE_API_KEY"}.`,
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
  };
  if (opts.response_format) body.response_format = opts.response_format;
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (typeof opts.max_tokens === "number") body.max_tokens = opts.max_tokens;
  if (opts.stream) body.stream = true;

  // Reasoning effort: GPT-5 family supports it; gemini ignores it.
  if (opts.reasoning_effort && model.startsWith("gpt-5")) {
    // OpenAI reasoning models accept reasoning_effort at the top level for chat.completions
    body.reasoning_effort = opts.reasoning_effort;
  }

  const startedAt = Date.now();
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const latency_ms = Date.now() - startedAt;

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`[ai-client] ${provider} ${model} error ${resp.status}: ${text}`);
    if (resp.status === 429) {
      throw new Error("AI_RATE_LIMIT: Muitas requisições. Tente novamente em alguns segundos.");
    }
    if (resp.status === 402) {
      throw new Error("AI_PAYMENT_REQUIRED: Créditos esgotados. Adicione créditos para continuar.");
    }
    if (resp.status === 401) {
      throw new Error(`AI_AUTH_ERROR: Chave de API inválida para ${provider}.`);
    }
    throw new Error(`AI_PROVIDER_ERROR: ${provider} retornou ${resp.status}: ${text.slice(0, 300)}`);
  }

  if (opts.stream) {
    // Caller must handle stream itself; return raw response wrapper.
    return {
      content: "",
      raw: resp,
      model_used: model,
      provider_used: provider,
      latency_ms,
    };
  }

  const data = await resp.json();
  const choice = data?.choices?.[0];
  const content: string = choice?.message?.content ?? "";
  const tool_calls = choice?.message?.tool_calls;
  const usage = data?.usage;

  // Best-effort logging (non-blocking, no-op if log helper unavailable)
  if (opts.feature && opts.organization_id) {
    try {
      logUsage({
        feature: opts.feature,
        organization_id: opts.organization_id,
        provider,
        model,
        latency_ms,
        prompt_tokens: usage?.prompt_tokens ?? 0,
        completion_tokens: usage?.completion_tokens ?? 0,
        success: true,
      }).catch(() => {/* swallow */});
    } catch {/* ignore */}
  }

  return {
    content,
    tool_calls,
    usage,
    raw: data,
    model_used: model,
    provider_used: provider,
    latency_ms,
  };
}

/** Fire-and-forget usage logging into ai_usage_logs (table optional). */
async function logUsage(row: {
  feature: string;
  organization_id: string;
  provider: string;
  model: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  success: boolean;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  // Soft insert via REST — ignore errors (table may not exist yet).
  await fetch(`${supabaseUrl}/rest/v1/ai_usage_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(row),
  }).catch(() => {/* swallow */});
}
