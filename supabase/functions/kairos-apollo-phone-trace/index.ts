// KAI.18.12 — Apollo Phone Trace (INSTRUMENTATION ONLY, read-only).
// Objetivo: descobrir exatamente qual request do Apollo Web entrega o telefone.
// Entrada: HAR bruto (opcional) OU parity_log_id OU contact_id (usa último HAR persistido).
// Saída: request(s) que contêm o número procurado, endpoint, payload, response, campo, classificação.
// Não chama Apollo. Não altera nada.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normaliza um número para casar variações (+55 48 99179-7878 -> 5548991797878, 991797878, 99179-7878...)
function normalizePhone(s: string): string {
  return (s || "").replace(/[^\d]/g, "");
}

// Gera candidatos de match (com e sem DDI, últimos 8/9/10/11 dígitos)
function phoneCandidates(input: string): string[] {
  const digits = normalizePhone(input);
  const cands = new Set<string>();
  if (digits) {
    cands.add(digits);
    for (const len of [11, 10, 9, 8]) {
      if (digits.length >= len) cands.add(digits.slice(-len));
    }
  }
  // Também considerar o input cru (caso seja um ID hex tipo 685116c45696af0001a5f46d)
  const trimmed = (input || "").trim();
  if (trimmed && !/^\+?\d[\d\s\-\(\)]*$/.test(trimmed)) cands.add(trimmed.toLowerCase());
  return [...cands].filter(Boolean);
}

// Busca recursiva por qualquer valor em string que contenha algum candidato.
// Retorna caminhos JSONPath-like + valor encontrado.
function findMatches(node: any, candidates: string[], path: string, hits: Array<{ path: string; value: string; matched: string }>, depth = 0) {
  if (depth > 20 || node == null) return;
  if (typeof node === "string") {
    const norm = normalizePhone(node);
    const lower = node.toLowerCase();
    for (const c of candidates) {
      const isDigits = /^\d+$/.test(c);
      if (isDigits && norm.includes(c)) {
        hits.push({ path, value: node.slice(0, 200), matched: c });
        return;
      }
      if (!isDigits && lower.includes(c)) {
        hits.push({ path, value: node.slice(0, 200), matched: c });
        return;
      }
    }
    return;
  }
  if (typeof node === "number") {
    const s = String(node);
    for (const c of candidates) {
      if (/^\d+$/.test(c) && s.includes(c)) {
        hits.push({ path, value: s, matched: c });
        return;
      }
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => findMatches(v, candidates, `${path}[${i}]`, hits, depth + 1));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      findMatches(v, candidates, path ? `${path}.${k}` : k, hits, depth + 1);
    }
  }
}

// Extrai body JSON de uma entrada HAR (request ou response)
function tryParseJson(text?: string): any {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Classifica de onde veio o telefone.
function classifyEntry(entry: any, responseHit: boolean, requestHit: boolean): string {
  const url: string = entry?.request?.url ?? "";
  const method: string = entry?.request?.method ?? "GET";
  const postText: string = entry?.request?.postData?.text ?? "";
  const mime: string = entry?.response?.content?.mimeType ?? "";
  const fromCache =
    entry?.response?.status === 304 ||
    entry?.cache?.afterRequest != null ||
    /from[_-]?cache/i.test(entry?._resourceType ?? "") ||
    entry?.response?.headers?.some?.((h: any) => /x-cache|cf-cache-status/i.test(h?.name) && /hit/i.test(h?.value));

  if (!responseHit && requestHit) return "PHONE_FROM_INTERNAL"; // veio de payload/context local, não do servidor
  if (fromCache && responseHit) return "PHONE_FROM_CACHE";
  if (/graphql/i.test(url) || /graphql/i.test(postText)) return "PHONE_FROM_GRAPHQL";
  if (/\/api\/v\d+\/|apollo\.io\/api\//i.test(url)) return "PHONE_FROM_API";
  if (/apollo\.io\/internal|_bff|\/rpc\//i.test(url)) return "PHONE_FROM_INTERNAL";
  return "PHONE_FROM_SECOND_REQUEST";
}

async function loadHarFromDb(supabase: any, opts: { parity_log_id?: string; contact_id?: string; prospect_id?: string }) {
  let query = supabase
    .from("apollo_browser_parity_logs")
    .select("id, prospect_id, created_at, har_json, har_candidate_requests, selected_har_request")
    .order("created_at", { ascending: false })
    .limit(1);
  if (opts.parity_log_id) query = supabase.from("apollo_browser_parity_logs").select("*").eq("id", opts.parity_log_id).maybeSingle();
  else if (opts.prospect_id) query = query.eq("prospect_id", opts.prospect_id);
  else if (opts.contact_id) {
    const { data: c } = await supabase.from("enriched_contact_profiles").select("prospect_id").eq("id", opts.contact_id).maybeSingle();
    if (c?.prospect_id) query = query.eq("prospect_id", c.prospect_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      phone = "+55 48 99179-7878",
      contact_id,
      prospect_id,
      parity_log_id,
      har_json: inlineHar,
      extra_needles = [] as string[], // ex: ["leo.cardoso", "685116c45696af0001a5f46d"]
      max_hits = 25,
    } = body || {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let har = inlineHar;
    let source: any = { origin: "inline" };
    if (!har) {
      const row = await loadHarFromDb(supabase, { parity_log_id, contact_id, prospect_id });
      har = row?.har_json;
      source = { origin: "apollo_browser_parity_logs", parity_log_id: row?.id, prospect_id: row?.prospect_id, created_at: row?.created_at };
    }

    if (!har?.log?.entries?.length) {
      return new Response(
        JSON.stringify({
          status: "no_har",
          reason:
            "Nenhum HAR encontrado. Envie `har_json` no body, ou faça upload via apollo-browser-parity-check antes de rodar o trace.",
          source,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const needles = [phone, ...extra_needles].filter(Boolean).flatMap((n: string) => phoneCandidates(n));
    const uniqueNeedles = [...new Set(needles)];

    const entries = har.log.entries as any[];
    const matches: any[] = [];

    for (const entry of entries) {
      const url = entry?.request?.url ?? "";
      // Só interessam requests Apollo (evita ruído de assets/analytics de terceiros)
      const isApollo = /apollo\.io|apolloapi|myapollo/i.test(url);
      if (!isApollo) continue;

      const reqBody = tryParseJson(entry?.request?.postData?.text);
      const respBody = tryParseJson(entry?.response?.content?.text);

      const reqHits: any[] = [];
      const respHits: any[] = [];
      findMatches(reqBody, uniqueNeedles, "$", reqHits);
      findMatches(respBody, uniqueNeedles, "$", respHits);

      // Fallback: bruteforce string search se JSON não parseou
      if (!respBody && typeof entry?.response?.content?.text === "string") {
        const txt: string = entry.response.content.text;
        for (const c of uniqueNeedles) {
          const norm = normalizePhone(txt);
          if (/^\d+$/.test(c) ? norm.includes(c) : txt.toLowerCase().includes(c)) {
            respHits.push({ path: "$rawText", value: txt.slice(0, 200), matched: c });
            break;
          }
        }
      }

      if (reqHits.length === 0 && respHits.length === 0) continue;

      const classification = classifyEntry(entry, respHits.length > 0, reqHits.length > 0);

      matches.push({
        classification,
        endpoint: url,
        method: entry?.request?.method,
        status: entry?.response?.status,
        started: entry?.startedDateTime,
        request_hits: reqHits.slice(0, 5),
        response_hits: respHits.slice(0, 5),
        request_body_preview: reqBody ? JSON.stringify(reqBody).slice(0, 2000) : (entry?.request?.postData?.text ?? "").slice(0, 2000),
        response_body_preview: respBody
          ? JSON.stringify(respBody).slice(0, 4000)
          : (entry?.response?.content?.text ?? "").slice(0, 4000),
      });

      if (matches.length >= max_hits) break;
    }

    const summary = {
      target_phone: phone,
      needles: uniqueNeedles,
      total_entries: entries.length,
      apollo_entries: entries.filter((e) => /apollo\.io|apolloapi|myapollo/i.test(e?.request?.url ?? "")).length,
      matches_found: matches.length,
      classifications: matches.reduce((acc: Record<string, number>, m) => {
        acc[m.classification] = (acc[m.classification] ?? 0) + 1;
        return acc;
      }, {}),
      verdict:
        matches.length === 0
          ? "PHONE_FROM_WEB_ONLY"
          : matches[0].classification,
      source,
    };

    return new Response(JSON.stringify({ status: "ok", summary, matches }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[kairos-apollo-phone-trace] error", err);
    return new Response(JSON.stringify({ status: "error", error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
