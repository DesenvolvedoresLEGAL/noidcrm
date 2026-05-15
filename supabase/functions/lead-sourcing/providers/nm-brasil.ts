// NürnbergMesse Brasil Vitrine provider
// Extracts exhibitors directly from the public catalogue API used by vitrine.* sites
// (FCE Cosmetique/Pharma, BFShow, PETSA/PETVET), avoiding SPA/Firecrawl fallbacks.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const API_BASE = "https://api-one.nm-brasil.com.br";
const LAYOUTS = ["bfshow", "cosmetique", "pharma", "petsa", "petvet"] as const;
type NmBrasilLayout = typeof LAYOUTS[number];

export interface NmBrasilDetection {
  origin: string;
  layout: NmBrasilLayout;
  fair_ids: string[];
  source: "vitrine_bundle" | "known_host";
}

export interface NmBrasilExhibitor {
  external_id: string;
  name: string;
  website: string | null;
  category: string | null;
  categories: string[];
  description: string | null;
  booth: string | null;
  source_url: string;
  logo_url: string | null;
  fair_id: string | null;
  fair_name: string | null;
  status: string | null;
  raw: Record<string, unknown>;
}

export interface NmBrasilFetchResult {
  exhibitors: NmBrasilExhibitor[];
  total_count: number;
  active_count: number;
  pages_fetched: number;
  fair_ids: string[];
  layout: NmBrasilLayout;
}

function resolveLayoutFromUrl(url: string): NmBrasilLayout | null {
  try {
    const u = new URL(url);
    const requested = u.searchParams.get("layout")?.toLowerCase();
    if (requested && (LAYOUTS as readonly string[]).includes(requested)) return requested as NmBrasilLayout;
    const haystack = `${u.hostname} ${u.pathname}`.toLowerCase();
    if (/fcecosmetique|cosmetique/.test(haystack)) return "cosmetique";
    if (/fcepharma|pharma/.test(haystack)) return "pharma";
    if (/petsa/.test(haystack)) return "petsa";
    if (/petvet/.test(haystack)) return "petvet";
    if (/bfshow|brazilianfootwear|footwear/.test(haystack)) return "bfshow";
  } catch { /* ignore */ }
  return null;
}

async function fetchText(url: string, referer?: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const resp = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/json,*/*",
        ...(referer ? { "Referer": referer } : {}),
      },
      redirect: "follow",
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractScriptUrls(html: string, pageUrl: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const src = match[1];
    if (!src || /googletagmanager|google-analytics/i.test(src)) continue;
    try {
      const resolved = new URL(src, pageUrl).toString();
      if (/\/(_next|static)\//i.test(resolved) || /\.js(\?|$)/i.test(resolved)) urls.add(resolved);
    } catch { /* ignore */ }
  }
  return Array.from(urls).slice(0, 30);
}

function extractFairIdsByLayout(text: string): Partial<Record<NmBrasilLayout, string[]>> {
  const byLayout: Partial<Record<NmBrasilLayout, string[]>> = {};
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const rx = new RegExp(`"(${LAYOUTS.join("|")})"\\s*:\\s*\\[((?:\\s*"${uuid}"\\s*,?)+)\\]`, "gi");
  let match: RegExpExecArray | null;
  while ((match = rx.exec(text)) !== null) {
    const layout = match[1] as NmBrasilLayout;
    const ids = Array.from(match[2].matchAll(new RegExp(uuid, "gi"))).map((m) => m[0]);
    if (ids.length > 0) byLayout[layout] = Array.from(new Set([...(byLayout[layout] || []), ...ids]));
  }
  return byLayout;
}

function fairIdsForLayout(layout: NmBrasilLayout, byLayout: Partial<Record<NmBrasilLayout, string[]>>): string[] {
  // FCE's own bundle intentionally merges Cosmetique + Pharma in the same public catalogue.
  if (layout === "cosmetique" || layout === "pharma") {
    return Array.from(new Set([...(byLayout.cosmetique || []), ...(byLayout.pharma || [])]));
  }
  return byLayout[layout] || [];
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeWebsite(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(value)) return `https://${value}`;
  return null;
}

function descriptionFromAbout(about: unknown): string | null {
  if (typeof about === "string") return about.trim() || null;
  if (about && typeof about === "object") {
    const obj = about as Record<string, unknown>;
    return pickString(obj["pt-BR"], obj["pt"], obj["en-US"], obj["en"]);
  }
  return null;
}

function normalizeStore(store: Record<string, any>, origin: string, layout: NmBrasilLayout): NmBrasilExhibitor | null {
  if (String(store.status || "").toUpperCase() !== "ACTIVE") return null;
  const customer = store.customer || {};
  const rawName = pickString(store.name, customer.aliasName, customer.fullName);
  const name = rawName?.replace(/^['"\s]+|['"\s]+$/g, "").replace(/\s+/g, " ").trim();
  if (!name || name.length < 2) return null;

  const links = store.links || {};
  const categories = Array.isArray(store.segments)
    ? store.segments.map((s: any) => pickString(s?.name)).filter(Boolean) as string[]
    : [];
  const fairId = pickString(store.fair?.id);
  const profileUrl = `${origin.replace(/\/$/, "")}/vitrines/${encodeURIComponent(String(store.id))}?layout=${encodeURIComponent(layout)}${fairId ? `&fairId=${encodeURIComponent(fairId)}` : ""}`;

  return {
    external_id: String(store.id || ""),
    name,
    website: normalizeWebsite(links.website ?? links.site ?? links.url ?? links.websiteUrl),
    category: categories[0] || null,
    categories,
    description: descriptionFromAbout(store.about),
    booth: pickString(store.standNumber),
    source_url: profileUrl,
    logo_url: pickString(store.logoUrl),
    fair_id: fairId,
    fair_name: pickString(store.fair?.name),
    status: pickString(store.status),
    raw: store,
  };
}

export async function fetchNmBrasilExhibitors(detection: NmBrasilDetection): Promise<NmBrasilFetchResult> {
  const fairParams = detection.fair_ids.map((id) => `fairIds=${encodeURIComponent(id)}`).join("&");
  const exhibitors: NmBrasilExhibitor[] = [];
  const seen = new Set<string>();
  let totalCount = 0;
  let pagesFetched = 0;

  for (let page = 1; page <= 20; page++) {
    const url = `${API_BASE}/public/fairs/stores?${fairParams}&page=${page}&pageSize=2000`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json,*/*",
        "Origin": detection.origin,
        "Referer": `${detection.origin}/`,
      },
    });
    if (!resp.ok) throw new Error(`NM Brasil stores fetch failed: HTTP ${resp.status}`);
    const data = await resp.json();
    const items: Record<string, any>[] = Array.isArray(data?.items) ? data.items : [];
    totalCount = Number(data?.total || totalCount || items.length);
    pagesFetched++;

    for (const item of items) {
      const ex = normalizeStore(item, detection.origin, detection.layout);
      if (!ex) continue;
      const key = ex.external_id || `${ex.name.toLowerCase()}|${ex.booth || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      exhibitors.push(ex);
    }

    if (!data?.hasMorePages || items.length === 0) break;
  }

  return {
    exhibitors,
    total_count: totalCount,
    active_count: exhibitors.length,
    pages_fetched: pagesFetched,
    fair_ids: detection.fair_ids,
    layout: detection.layout,
  };
}

export async function tryNmBrasilFromUrl(eventUrl: string): Promise<{
  detection: NmBrasilDetection | null;
  result: NmBrasilFetchResult | null;
  error?: string;
}> {
  const url = eventUrl.startsWith("http") ? eventUrl : `https://${eventUrl}`;
  const layout = resolveLayoutFromUrl(url);
  if (!layout) return { detection: null, result: null };

  let origin: string;
  try { origin = new URL(url).origin; } catch { return { detection: null, result: null, error: "invalid_url" }; }

  const html = await fetchText(url, undefined, 15000);
  if (!html) return { detection: null, result: null, error: "host_fetch_failed" };

  const scripts = extractScriptUrls(html, url);
  const byLayout: Partial<Record<NmBrasilLayout, string[]>> = extractFairIdsByLayout(html);
  for (const scriptUrl of scripts) {
    const js = await fetchText(scriptUrl, url, 12000);
    if (!js) continue;
    const found = extractFairIdsByLayout(js);
    for (const key of LAYOUTS) {
      if (found[key]?.length) byLayout[key] = Array.from(new Set([...(byLayout[key] || []), ...found[key]! ]));
    }
  }

  const fairIds = fairIdsForLayout(layout, byLayout);
  if (fairIds.length === 0) return { detection: null, result: null, error: "fair_ids_not_found" };

  const detection: NmBrasilDetection = { origin, layout, fair_ids: fairIds, source: "vitrine_bundle" };
  try {
    const result = await fetchNmBrasilExhibitors(detection);
    return { detection, result };
  } catch (e) {
    return { detection, result: null, error: (e as Error).message };
  }
}