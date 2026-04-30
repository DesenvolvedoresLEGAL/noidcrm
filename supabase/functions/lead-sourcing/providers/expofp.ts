// ExpoFP Provider — extracts exhibitors directly from ExpoFP's public data endpoint.
// ExpoFP is a SaaS used by hundreds of trade shows (APAS, NRF, Anuga, etc.) that
// embeds an iframe loading exhibitor data as JSON. Scraping the host marketing page
// returns garbage; this provider hits the data source directly.

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface ExpoFPDetection {
  subdomain: string;            // e.g. "apasshow2026"
  origin: string;               // e.g. "https://apasshow2026.expofp.com"
  iframeUrl: string;            // full URL of detected iframe/script
}

export interface ExpoFPExhibitor {
  external_id: string;          // ExpoFP id
  name: string;
  country: string | null;
  categories: string[];         // resolved category names
  source_url: string;           // deep-link to that exhibitor on the floor plan
  raw: Record<string, any>;
}

export interface ExpoFPFetchResult {
  exhibitors: ExpoFPExhibitor[];
  event_title: string | null;
  event_subtitle: string | null;
  exhibitors_count: number;
  with_country: number;
  with_categories: number;
  data_version: string | null;
}

/**
 * Detect whether a given event page embeds an ExpoFP floor plan.
 * Looks at both rendered iframes and direct ExpoFP links.
 */
export function detectExpoFP(eventUrl: string, html: string): ExpoFPDetection | null {
  const sources: string[] = [];

  // 1. iframe src or data-src
  const iframeRe = /<iframe[^>]+(?:src|data-src)\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(iframeRe)) sources.push(m[1]);

  // 2. div with original-tag iframe (some hosts replace iframes with div)
  const divRe = /data-original-tag\s*=\s*["']iframe["'][^>]*src\s*=\s*["']([^"']+)["']/gi;
  for (const m of html.matchAll(divRe)) sources.push(m[1]);
  const divRe2 = /src\s*=\s*["']([^"']*\.expofp\.com[^"']*)["']/gi;
  for (const m of html.matchAll(divRe2)) sources.push(m[1]);

  // 3. data-event-id attribute (ExpoFP embed pattern)
  const eventIdRe = /data-event-id\s*=\s*["']([a-zA-Z0-9_-]+)["']/i;
  const eventIdMatch = html.match(eventIdRe);

  // 4. The event url itself might already be an ExpoFP subdomain
  try {
    const evUrl = new URL(eventUrl);
    if (evUrl.hostname.endsWith(".expofp.com")) sources.push(eventUrl);
  } catch { /* ignore */ }

  for (const raw of sources) {
    try {
      const u = new URL(raw, eventUrl);
      if (u.hostname.endsWith(".expofp.com")) {
        const subdomain = u.hostname.replace(/\.expofp\.com$/, "");
        if (subdomain && subdomain !== "www") {
          return {
            subdomain,
            origin: `${u.protocol}//${u.hostname}`,
            iframeUrl: u.toString(),
          };
        }
      }
    } catch { /* ignore */ }
  }

  // Fallback: data-event-id + assume default expofp.com host
  if (eventIdMatch) {
    const subdomain = eventIdMatch[1];
    return {
      subdomain,
      origin: `https://${subdomain}.expofp.com`,
      iframeUrl: `https://${subdomain}.expofp.com/`,
    };
  }

  return null;
}

/**
 * Fetch and parse exhibitor list from an ExpoFP-hosted event.
 * Strategy:
 *   1. GET /data/version.js → extract __fpDataVersion
 *   2. GET /data/data.js?v=<version> → strip wrapper, JSON.parse
 *   3. Resolve category IDs → names using payload's `categories` array
 */
export async function fetchExpoFPExhibitors(detection: ExpoFPDetection): Promise<ExpoFPFetchResult> {
  const baseHeaders = {
    "User-Agent": BROWSER_UA,
    "Referer": `${detection.origin}/`,
    "Accept": "application/json, text/javascript, */*; q=0.01",
  };

  // Step 1: version
  let version: string | null = null;
  try {
    const versionResp = await fetch(`${detection.origin}/data/version.js`, { headers: baseHeaders });
    if (versionResp.ok) {
      const versionText = await versionResp.text();
      const m = versionText.match(/=\s*["']([^"']+)["']/);
      if (m) version = m[1];
    }
  } catch { /* version is optional */ }

  // Step 2: data.js
  const dataUrl = version
    ? `${detection.origin}/data/data.js?v=${encodeURIComponent(version)}`
    : `${detection.origin}/data/data.js`;

  const dataResp = await fetch(dataUrl, { headers: baseHeaders });
  if (!dataResp.ok) {
    throw new Error(`ExpoFP data.js fetch failed: HTTP ${dataResp.status}`);
  }

  // Strip BOM and parse
  let dataText = await dataResp.text();
  if (dataText.charCodeAt(0) === 0xFEFF) dataText = dataText.slice(1);

  // Expect: var __data = { ... };
  const eqIdx = dataText.indexOf("=");
  if (eqIdx === -1) throw new Error("ExpoFP data.js: invalid format (no '=' found)");
  let body = dataText.slice(eqIdx + 1).trim();
  if (body.endsWith(";")) body = body.slice(0, -1);

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch (e) {
    throw new Error(`ExpoFP data.js: JSON parse failed (${(e as Error).message})`);
  }

  const rawExhibitors: any[] = Array.isArray(payload?.exhibitors) ? payload.exhibitors : [];
  const rawCategories: any[] = Array.isArray(payload?.categories) ? payload.categories : [];
  const categoryById = new Map<number | string, string>();
  for (const c of rawCategories) {
    if (c?.id != null && c?.name) categoryById.set(c.id, String(c.name));
  }

  const exhibitors: ExpoFPExhibitor[] = rawExhibitors
    .filter((e) => e && typeof e.name === "string" && e.name.trim().length > 0)
    .map((e) => {
      const cats: string[] = Array.isArray(e.categories)
        ? e.categories.map((cid: any) => categoryById.get(cid)).filter(Boolean) as string[]
        : [];
      const externalId = String(e.id ?? e.externalId ?? "");
      const slug = e.externalId ? String(e.externalId) : externalId;
      return {
        external_id: externalId,
        name: String(e.name).trim(),
        country: e.country ? String(e.country) : null,
        categories: cats,
        source_url: `${detection.origin}/${encodeURIComponent(slug)}`,
        raw: e,
      };
    });

  return {
    exhibitors,
    event_title: payload?.title ?? null,
    event_subtitle: payload?.subtitle ?? null,
    exhibitors_count: exhibitors.length,
    with_country: exhibitors.filter((e) => !!e.country).length,
    with_categories: exhibitors.filter((e) => e.categories.length > 0).length,
    data_version: version,
  };
}

/**
 * Convenience helper: fetch the event page HTML, run detection, and pull exhibitors.
 * Returns null detection if the page does NOT use ExpoFP.
 */
export async function tryExpoFPFromUrl(eventUrl: string): Promise<{
  detection: ExpoFPDetection | null;
  result: ExpoFPFetchResult | null;
  error?: string;
}> {
  let html = "";
  try {
    const resp = await fetch(eventUrl, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
      redirect: "follow",
    });
    if (!resp.ok) return { detection: null, result: null, error: `host fetch HTTP ${resp.status}` };
    html = await resp.text();
  } catch (e) {
    return { detection: null, result: null, error: `host fetch failed: ${(e as Error).message}` };
  }

  const detection = detectExpoFP(eventUrl, html);
  if (!detection) return { detection: null, result: null };

  try {
    const result = await fetchExpoFPExhibitors(detection);
    return { detection, result };
  } catch (e) {
    return { detection, result: null, error: (e as Error).message };
  }
}
