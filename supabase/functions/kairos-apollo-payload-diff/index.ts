// KAI.18.11 — Apollo Payload Diff (INSTRUMENTATION ONLY, read-only).
// Descobre exatamente onde o telefone desaparece entre Apollo Web (HAR) → API Kairós → Persistência DB.
// Não altera nada. Não chama Apollo. Apenas lê o que já está gravado.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Campos alvo pedidos no sprint KAI.18.11.
const PHONE_FIELDS = [
  "phone",
  "phone_number",
  "phone_numbers",
  "mobile_phone",
  "mobile",
  "phones",
  "contact.phone",
  "contact.phone_numbers",
  "organization_people.phone",
  "organization_people.mobile",
  "employment_history",
  "revealed_phone",
  "direct_dial",
  "formatted_phone",
  "sanitized_phone",
  "raw_phone",
  "personal_phone",
  "phone_numbers[].sanitized_number",
  "phone_numbers[].raw_number",
  "phone_numbers[].type",
];

function getPath(obj: any, path: string): unknown {
  if (!obj) return undefined;
  // Handle "phone_numbers[].sanitized_number" style
  if (path.includes("[]")) {
    const [head, tail] = path.split("[].");
    const arr = getPath(obj, head);
    if (!Array.isArray(arr)) return undefined;
    const vals = arr.map((x) => (x && typeof x === "object" ? (x as any)[tail] : undefined)).filter((v) => v !== undefined && v !== null && v !== "");
    return vals.length > 0 ? vals : undefined;
  }
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as any).length > 0;
  return true;
}

// Locate a person object inside an Apollo response by apollo_person_id / name.
function findPerson(container: any, hints: { apollo_person_id?: string | null; full_name?: string | null; email?: string | null }): any {
  if (!container || typeof container !== "object") return null;
  const buckets = [
    container.person,
    ...(Array.isArray(container.people) ? container.people : []),
    ...(Array.isArray(container.contacts) ? container.contacts : []),
    ...(Array.isArray(container.matches) ? container.matches : []),
  ].filter(Boolean);
  const id = hints.apollo_person_id ?? null;
  const nameLc = (hints.full_name ?? "").toLowerCase().trim();
  const emailLc = (hints.email ?? "").toLowerCase().trim();
  for (const p of buckets) {
    if (id && (p.id === id || p.person_id === id)) return p;
  }
  for (const p of buckets) {
    if (emailLc && (p.email ?? "").toLowerCase() === emailLc) return p;
    const n = (p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`).toLowerCase().trim();
    if (nameLc && n === nameLc) return p;
  }
  return buckets[0] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contact_id: string | undefined = body.contact_id;
    if (!contact_id) {
      return new Response(JSON.stringify({ error: "contact_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1) Persisted contact
    const { data: contact, error: cErr } = await sb
      .from("enriched_contact_profiles")
      .select("*")
      .eq("id", contact_id)
      .maybeSingle();
    if (cErr || !contact) {
      return new Response(JSON.stringify({ error: "contact not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prospect_id = contact.prospect_id;
    const org_id = contact.workspace_id;

    // 2) Latest Apollo API raw response for this prospect
    const { data: apolloLog } = await sb
      .from("apollo_query_logs")
      .select("id, endpoint, response_status, response_body, raw_response_full, created_at, apollo_request_id, credits_used, people_returned, mode")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3) Latest Browser Parity HAR for this prospect
    const { data: parity } = await sb
      .from("apollo_browser_parity_logs")
      .select("id, apollo_web_url, apollo_web_contacts_count, kairos_contacts_count, selected_har_request, har_summary, diff_summary, parity_status, root_cause, created_at")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Extract person objects from each source
    const persistedRaw = (contact as any).raw ?? {};
    const apolloBody = apolloLog?.raw_response_full ?? apolloLog?.response_body ?? null;
    const hints = {
      apollo_person_id: contact.apollo_person_id,
      full_name: contact.full_name,
      email: contact.email,
    };
    const apiPerson = apolloBody ? findPerson(apolloBody, hints) : null;
    const browserBody = parity?.selected_har_request?.response_body ?? parity?.selected_har_request?.body ?? null;
    const browserPerson = browserBody ? findPerson(browserBody, hints) : null;

    // 4) Diff each phone field across sources
    const rows = PHONE_FIELDS.map((field) => {
      const browserVal = browserPerson ? getPath(browserPerson, field) : undefined;
      const apiVal = apiPerson ? getPath(apiPerson, field) : undefined;
      const persistedVal = getPath(persistedRaw, field);
      const inBrowser = hasValue(browserVal);
      const inApi = hasValue(apiVal);
      const inPersisted = hasValue(persistedVal);

      let flag: "OK" | "PHONE_ONLY_WEB" | "PHONE_MAPPING_BUG" | "PHONE_UI_BUG" | "ABSENT" = "ABSENT";
      if (inBrowser && !inApi) flag = "PHONE_ONLY_WEB";
      else if (inApi && !inPersisted) flag = "PHONE_MAPPING_BUG";
      else if (inPersisted && !contact.phone_revealed) flag = "PHONE_UI_BUG";
      else if (inBrowser || inApi || inPersisted) flag = "OK";

      return {
        field,
        in_browser: inBrowser,
        in_api: inApi,
        in_persisted: inPersisted,
        browser_value: browserVal ?? null,
        api_value: apiVal ?? null,
        persisted_value: persistedVal ?? null,
        flag,
      };
    });

    // Final columns rendered by the UI (what the user actually sees in Aba Contatos)
    const uiSnapshot = {
      phone: contact.phone,
      phone_revealed: contact.phone_revealed,
      phone_reveal_status: contact.phone_reveal_status,
      phone_source_type: contact.phone_source_type,
      phone_match_quality: contact.phone_match_quality,
      phone_confidence: contact.phone_confidence,
      is_whatsapp_ready: contact.is_whatsapp_ready,
    };

    // Overall root cause hint
    let root_cause: string;
    const anyMapping = rows.some((r) => r.flag === "PHONE_MAPPING_BUG");
    const anyUi = rows.some((r) => r.flag === "PHONE_UI_BUG");
    const anyOnlyWeb = rows.some((r) => r.flag === "PHONE_ONLY_WEB");
    if (anyMapping) root_cause = "PHONE_MAPPING_BUG";
    else if (anyUi) root_cause = "PHONE_UI_BUG";
    else if (anyOnlyWeb) root_cause = "PHONE_ONLY_WEB";
    else if (contact.phone) root_cause = "OK";
    else root_cause = "NO_PHONE_ANYWHERE";

    return new Response(JSON.stringify({
      contact: {
        id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        apollo_person_id: contact.apollo_person_id,
        prospect_id,
        organization_id: org_id,
      },
      sources: {
        api: {
          found: !!apiPerson,
          log_id: apolloLog?.id ?? null,
          endpoint: apolloLog?.endpoint ?? null,
          status: apolloLog?.response_status ?? null,
          apollo_request_id: apolloLog?.apollo_request_id ?? null,
          created_at: apolloLog?.created_at ?? null,
        },
        browser: {
          found: !!browserPerson,
          parity_log_id: parity?.id ?? null,
          apollo_web_url: parity?.apollo_web_url ?? null,
          created_at: parity?.created_at ?? null,
        },
        persisted: {
          has_raw: Object.keys(persistedRaw).length > 0,
          ui_snapshot: uiSnapshot,
        },
      },
      diff: rows,
      root_cause,
      summary: {
        phone_only_web: rows.filter((r) => r.flag === "PHONE_ONLY_WEB").map((r) => r.field),
        phone_mapping_bug: rows.filter((r) => r.flag === "PHONE_MAPPING_BUG").map((r) => r.field),
        phone_ui_bug: rows.filter((r) => r.flag === "PHONE_UI_BUG").map((r) => r.field),
      },
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kairos-apollo-payload-diff error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
