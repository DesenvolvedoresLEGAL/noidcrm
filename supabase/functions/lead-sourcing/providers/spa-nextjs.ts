// Generic SPA provider for Next.js (App/Pages Router), Nuxt, and other JS-rendered sites
// where the initial HTML is an empty shell + spinner. Tries (in order):
//   Layer 2: Hydrated payload extraction (__NEXT_DATA__, RSC __next_f, __NUXT__, __APOLLO_STATE__)
//   Layer 3: Internal API sniffing (look for fetch("/api/..") in JS bundles, call directly)
//   Layer 4: Firecrawl scrape with long waitFor — returns rendered HTML for downstream pipeline
//
// This provider is purely additive: it only runs AFTER ExpoFP and Informa/Swapcard providers
// fail to detect their respective platforms.

const NAME_KEYS = ["name", "nome", "companyName", "razaoSocial", "razao_social", "title", "exhibitorName", "expositor"];
const COMPANY_HINT_KEYS = ["logo", "logoUrl", "logo_url", "website", "site", "url", "stand", "booth", "country", "pais", "city", "cidade", "categoria", "category", "categories", "segment", "segmento", "description", "descricao"];

export interface SpaDetection {
  framework: "nextjs-app" | "nextjs-pages" | "nuxt" | "react-spa" | "vue-spa" | "angular-spa";
  origin: string;
  initial_html_length: number;
}

export interface SpaExhibitor {
  name: string;
  website: string | null;
  category: string | null;
  description: string | null;
  booth: string | null;
  country: string | null;
  city: string | null;
  source_url: string;
  logo_url: string | null;
  external_id: string | null;
  raw: Record<string, unknown>;
}

export interface SpaFetchResult {
  detection: SpaDetection | null;
  exhibitors: SpaExhibitor[];
  layer: 2 | 3 | 4 | null;
  hydrated_html?: string;
  error?: string;
  endpoints_probed?: string[];
}

const USER_AGENT = "Mozilla/5.0 (compatible; KairosBot/1.0; +https://crm.humanoid-os.ai)";

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: ctl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

export function detectSpa(html: string, url: string): SpaDetection | null {
  if (!html) return null;
  // Strip scripts/styles to estimate visible body content
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const hasLoader = /carregando|loading|please\s*wait|aguarde/i.test(visible);
  const isShell = visible.length < 800;

  let framework: SpaDetection["framework"] | null = null;
  if (/self\.__next_f\.push/.test(html) || /\b__next_f\b/.test(html)) framework = "nextjs-app";
  else if (/<script[^>]+id=["']__NEXT_DATA__["']/.test(html)) framework = "nextjs-pages";
  else if (/window\.__NUXT__/.test(html) || /id=["']__nuxt["']/.test(html)) framework = "nuxt";
  else if (/ng-version=/.test(html)) framework = "angular-spa";
  else if (/id=["']root["'][^>]*>\s*<\/div>/.test(html) || /id=["']app["'][^>]*>\s*<\/div>/.test(html)) framework = "react-spa";

  if (!framework) return null;
  // For Next.js App Router, presence of __next_f is enough (RSC always inlines payload).
  // For others, also require shell-like body to avoid false positives on already-SSRed pages.
  if (framework !== "nextjs-app" && !isShell && !hasLoader) return null;

  const origin = (() => {
    try { return new URL(url).origin; } catch { return url; }
  })();
  return { framework, origin, initial_html_length: html.length };
}

// ─────────────────────────────────────────────────────────────
// Heuristic: is `arr` an array of "company-like" objects?
// ─────────────────────────────────────────────────────────────
function looksLikeCompanyArray(arr: unknown): arr is Record<string, unknown>[] {
  if (!Array.isArray(arr) || arr.length < 10) return false;
  let nameHits = 0;
  let companyHintHits = 0;
  const sample = arr.slice(0, Math.min(arr.length, 50));
  for (const item of sample) {
    if (!item || typeof item !== "object") continue;
    const keys = Object.keys(item as Record<string, unknown>).map(k => k.toLowerCase());
    if (keys.some(k => NAME_KEYS.includes(k))) nameHits++;
    if (keys.some(k => COMPANY_HINT_KEYS.includes(k))) companyHintHits++;
  }
  const ratio = nameHits / sample.length;
  return ratio >= 0.6 && companyHintHits >= sample.length * 0.2;
}

function pick<T = string>(obj: Record<string, unknown>, keys: string[]): T | null {
  for (const k of keys) {
    for (const ok of Object.keys(obj)) {
      if (ok.toLowerCase() === k.toLowerCase()) {
        const v = obj[ok];
        if (v !== null && v !== undefined && v !== "") return v as T;
      }
    }
  }
  return null;
}

function normalizeOne(raw: Record<string, unknown>, sourceUrl: string): SpaExhibitor | null {
  const name = pick<string>(raw, NAME_KEYS);
  if (!name || typeof name !== "string" || name.trim().length < 2) return null;

  const categoryVal = pick<unknown>(raw, ["category", "categoria", "segment", "segmento"]);
  const categoriesVal = pick<unknown>(raw, ["categories", "categorias", "tags"]);
  const category = (() => {
    if (typeof categoryVal === "string") return categoryVal;
    if (Array.isArray(categoriesVal) && categoriesVal.length > 0) {
      const c = categoriesVal[0];
      if (typeof c === "string") return c;
      if (c && typeof c === "object") return (c as Record<string, unknown>).name as string ?? null;
    }
    return null;
  })();

  return {
    name: name.trim(),
    website: pick<string>(raw, ["website", "site", "url", "siteUrl", "websiteUrl"]),
    category,
    description: pick<string>(raw, ["description", "descricao", "summary", "about"]),
    booth: pick<string>(raw, ["booth", "stand", "standNumber", "boothNumber"]),
    country: pick<string>(raw, ["country", "pais", "countryName"]),
    city: pick<string>(raw, ["city", "cidade", "town"]),
    source_url: sourceUrl,
    logo_url: pick<string>(raw, ["logo", "logoUrl", "logo_url", "image", "imageUrl", "thumbnail"]),
    external_id: pick<string>(raw, ["id", "_id", "uuid", "slug", "code"]),
    raw,
  };
}

function deepFindCompanyArrays(node: unknown, found: Record<string, unknown>[][] = [], depth = 0): Record<string, unknown>[][] {
  if (depth > 12 || !node) return found;
  if (Array.isArray(node)) {
    if (looksLikeCompanyArray(node)) found.push(node);
    else for (const item of node) deepFindCompanyArrays(item, found, depth + 1);
  } else if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) deepFindCompanyArrays(v, found, depth + 1);
  }
  return found;
}

// ─────────────────────────────────────────────────────────────
// Layer 2: Extract from hydrated payloads
// ─────────────────────────────────────────────────────────────
export function extractFromHydratedPayload(html: string, sourceUrl: string): SpaExhibitor[] {
  const collected: Record<string, unknown>[] = [];

  // 2a. __NEXT_DATA__ (Pages Router)
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const arrs = deepFindCompanyArrays(json);
      for (const a of arrs) collected.push(...a);
    } catch { /* swallow */ }
  }

  // 2b. RSC payload (App Router) — self.__next_f.push([1, "..."])
  if (collected.length === 0) {
    const rscChunks: string[] = [];
    const rx = /self\.__next_f\.push\(\s*\[\s*1\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null) {
      try { rscChunks.push(JSON.parse(m[1])); } catch { /* ignore */ }
    }
    const concat = rscChunks.join("");
    // RSC chunks contain JSON fragments prefixed by id markers like `1a:[...]`. Try line-by-line.
    const lines = concat.split(/\n/);
    for (const line of lines) {
      const colon = line.indexOf(":");
      const candidate = colon > 0 ? line.slice(colon + 1) : line;
      const trimmed = candidate.trim();
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const arrs = deepFindCompanyArrays(parsed);
        for (const a of arrs) collected.push(...a);
      } catch { /* ignore non-JSON lines */ }
    }
  }

  // 2c. __NUXT__ / __APOLLO_STATE__
  if (collected.length === 0) {
    const m1 = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    const m2 = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    for (const m of [m1, m2]) {
      if (!m) continue;
      try {
        const parsed = JSON.parse(m[1]);
        const arrs = deepFindCompanyArrays(parsed);
        for (const a of arrs) collected.push(...a);
      } catch { /* ignore */ }
    }
  }

  // Dedupe by name
  const seen = new Set<string>();
  const out: SpaExhibitor[] = [];
  for (const raw of collected) {
    const norm = normalizeOne(raw, sourceUrl);
    if (!norm) continue;
    const key = norm.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Layer 3: Sniff internal API endpoints from JS bundles + page HTML
// ─────────────────────────────────────────────────────────────
function extractApiCandidates(text: string, origin: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /["'`](\/api\/[a-z0-9_\-/\.]+)["'`]/gi,
    /["'`](https?:\/\/[a-z0-9.\-]+\/api\/[a-z0-9_\-/\.]+)["'`]/gi,
    /["'`](https?:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/[a-z0-9_\-]+)["'`]/gi,
    /["'`](https?:\/\/cdn\.contentful\.com\/[a-z0-9_\-/\.]+)["'`]/gi,
  ];
  for (const rx of patterns) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      let u = m[1];
      // Skip obvious noise
      if (/\.(js|css|png|jpe?g|svg|woff2?|ico|map)(\?|$)/i.test(u)) continue;
      if (u.startsWith("/")) u = origin + u;
      // Filter to plausibly listing endpoints (heuristic)
      if (/exhibit|expos|company|brand|partner|list|catalog|directory|search/i.test(u) || /\/api\//i.test(u)) {
        out.add(u);
      }
    }
  }
  return Array.from(out).slice(0, 20);
}

async function probeApiEndpoint(url: string, origin: string): Promise<Record<string, unknown>[] | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,*/*",
        Origin: origin,
        Referer: origin + "/",
      },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!/json/i.test(ct)) return null;
    const data = await r.json();
    const arrs = deepFindCompanyArrays(data);
    if (arrs.length === 0) return null;
    return arrs.flat();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main entry
// ─────────────────────────────────────────────────────────────
export async function tryGenericSpaFromUrl(eventUrl: string): Promise<SpaFetchResult> {
  const url = eventUrl.startsWith("http") ? eventUrl : `https://${eventUrl}`;
  const html = await fetchHtml(url);
  if (!html) return { detection: null, exhibitors: [], layer: null, error: "fetch_failed" };

  const detection = detectSpa(html, url);
  if (!detection) return { detection: null, exhibitors: [], layer: null };

  // Layer 2
  const fromPayload = extractFromHydratedPayload(html, url);
  if (fromPayload.length >= 20) {
    return { detection, exhibitors: fromPayload, layer: 2 };
  }

  // Layer 3: Sniff API endpoints from inline scripts + first 5 JS bundles
  const apiCandidates = extractApiCandidates(html, detection.origin);
  // Pull script srcs to also scan a couple of bundles
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/g))
    .map(m => m[1])
    .filter(s => /\.js(\?|$)/i.test(s))
    .slice(0, 4)
    .map(s => s.startsWith("http") ? s : (s.startsWith("/") ? detection.origin + s : `${detection.origin}/${s}`));

  for (const src of scriptSrcs) {
    const js = await fetchHtml(src, 8000);
    if (js) for (const c of extractApiCandidates(js, detection.origin)) {
      if (apiCandidates.length < 30 && !apiCandidates.includes(c)) apiCandidates.push(c);
    }
  }

  const probed: string[] = [];
  for (const ep of apiCandidates) {
    probed.push(ep);
    const items = await probeApiEndpoint(ep, detection.origin);
    if (items && items.length >= 20) {
      const seen = new Set<string>();
      const out: SpaExhibitor[] = [];
      for (const raw of items) {
        const norm = normalizeOne(raw, ep);
        if (!norm) continue;
        const key = norm.name.toLowerCase().trim();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(norm);
      }
      if (out.length >= 20) {
        return { detection, exhibitors: out, layer: 3, endpoints_probed: probed };
      }
    }
  }

  // Layer 4: signal to caller that this is a SPA — caller may do Firecrawl waitFor scrape
  // We return whatever Layer 2 found (could be < 20) and mark layer=4 as a hint.
  return {
    detection,
    exhibitors: fromPayload,
    layer: 4,
    endpoints_probed: probed,
    error: fromPayload.length === 0 ? "no_payload_match" : "below_threshold",
  };
}
