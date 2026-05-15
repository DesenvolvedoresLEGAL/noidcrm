// Informa Markets / Swapcard Provider
// Detects events hosted on app.informamarkets.com.br (Next.js wrapper around Swapcard)
// and fetches all exhibitors via the public GraphQL endpoint using persisted queries.
//
// Why: the page only SSRs the first 50 exhibitors and then paginates via Apollo
// against /api/graphql. Scraping the rendered HTML is impossible without JS;
// hitting the GraphQL endpoint directly returns all 462+ in seconds.

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36";

// Persisted query hash captured from the live app (v2.310.75).
// If Informa rotates the hash, we will detect it via "PersistedQueryNotFound"
// and fall back to a graceful failure (engine then tries Firecrawl).
const PERSISTED_QUERY_HASH =
  "b3cb76208b6de3d96c5ba1a8f02e6be6135d5ff1db0a2eecd64b7d15e7e6b5e2";
const CLIENT_VERSION = "2.310.75";

const HOST_RE = /(?:^|\.)informamarkets\.com(?:\.br)?$/i;
// /event/<slug>/exhibitors/<base64ViewId>
const URL_RE = /\/event\/([^/]+)\/exhibitors\/([^/?#]+)/i;

export interface InformaMarketsDetection {
  origin: string;            // e.g. "https://app.informamarkets.com.br"
  eventSlug: string;         // e.g. "fispal-food-service-2026"
  viewId: string;            // base64 EventView_*
  eventId: string | null;    // base64 Event_* (extracted from SSR if available)
}

export interface InformaMarketsExhibitor {
  external_id: string;       // base64 Exhibitor_*
  name: string;
  country: string | null;
  categories: string[];      // resolved from `aggregation.value.text` / `type`
  source_url: string;        // deep link to exhibitor profile
  raw: Record<string, any>;
}

export interface InformaMarketsFetchResult {
  exhibitors: InformaMarketsExhibitor[];
  total_count: number | null;
  pages_fetched: number;
  view_id: string;
  event_id: string | null;
}

function decodeBase64Maybe(s: string): string | null {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
}

/** Detect Informa Markets exhibitor URLs (and follow-link candidates). */
export function detectInformaMarkets(eventUrl: string): InformaMarketsDetection | null {
  try {
    const u = new URL(eventUrl);
    if (!HOST_RE.test(u.hostname)) return null;
    const m = u.pathname.match(URL_RE);
    if (!m) return null;
    return {
      origin: `${u.protocol}//${u.hostname}`,
      eventSlug: m[1],
      viewId: decodeURIComponent(m[2]),
      eventId: null,
    };
  } catch {
    return null;
  }
}

/**
 * Some Informa marketing sites (e.g. fispalfoodservice.com.br) link to the
 * Informa app instead of listing exhibitors themselves. Walk the HTML for
 * the first link that matches `/event/.../exhibitors/...` on an Informa host.
 */
export function findInformaMarketsLinkInHtml(html: string): string | null {
  const re = /https?:\/\/[a-z0-9.-]*informamarkets\.com(?:\.br)?\/event\/[^"'\s<>]+\/exhibitors\/[^"'\s<>]+/gi;
  const m = html.match(re);
  return m && m.length > 0 ? m[0] : null;
}

/** Extract eventId from the SSR'd HTML (looks for `RXZlbnRf...` near our viewId). */
function extractEventIdFromHtml(html: string): string | null {
  // Patterns Apollo SSR uses: "withEvent({\"eventId\":\"RXZlbnRf...==\"})"
  const m1 = html.match(/eventId\\?":\\?"(RXZlbnRf[A-Za-z0-9_=-]+)/);
  if (m1) return m1[1];
  const m2 = html.match(/"(RXZlbnRf[A-Za-z0-9_=-]+)"/);
  return m2 ? m2[1] : null;
}

async function fetchPage(
  detection: InformaMarketsDetection,
  cursor: string | null,
): Promise<{ nodes: any[]; hasNextPage: boolean; endCursor: string | null; totalCount: number | null; raw: any }> {
  const variables: Record<string, any> = {
    withEvent: true,
    viewId: detection.viewId,
    eventId: detection.eventId ?? "",
  };
  if (cursor) variables.endCursor = cursor;

  const body = [{
    operationName: "EventExhibitorListViewConnectionQuery",
    variables,
    extensions: { persistedQuery: { version: 1, sha256Hash: PERSISTED_QUERY_HASH } },
  }];

  const resp = await fetch(`${detection.origin}/api/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "*/*",
      "user-agent": BROWSER_UA,
      "x-client-platform": "Event App",
      "x-client-origin": new URL(detection.origin).hostname,
      "x-client-version": CLIENT_VERSION,
      "x-content-language": "en_US",
      "referer": `${detection.origin}/`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    throw new Error(`GraphQL HTTP ${resp.status}`);
  }
  const json = await resp.json();
  const first = Array.isArray(json) ? json[0] : json;
  if (first?.errors?.length) {
    const code = first.errors[0]?.extensions?.code || "";
    throw new Error(`GraphQL error: ${first.errors[0]?.message || "unknown"}${code ? ` (${code})` : ""}`);
  }
  const view = first?.data?.view;
  const conn = view?.exhibitors;
  if (!conn) {
    throw new Error("GraphQL: missing view.exhibitors in response");
  }
  const nodes = conn.nodes
    ?? (Array.isArray(conn.edges) ? conn.edges.map((e: any) => e?.node).filter(Boolean) : []);
  return {
    nodes: Array.isArray(nodes) ? nodes : [],
    hasNextPage: !!conn.pageInfo?.hasNextPage,
    endCursor: conn.pageInfo?.endCursor ?? null,
    totalCount: typeof conn.totalCount === "number" ? conn.totalCount : null,
    raw: first,
  };
}

function normalizeExhibitor(node: any, detection: InformaMarketsDetection): InformaMarketsExhibitor {
  const id = String(node?.id ?? "");
  const cats: string[] = [];
  const aggText = node?.aggregation?.value?.text;
  if (typeof aggText === "string" && aggText.trim()) cats.push(aggText.trim());
  if (typeof node?.type === "string" && node.type.trim() && !cats.includes(node.type.trim())) {
    cats.push(node.type.trim());
  }
  return {
    external_id: id,
    name: String(node?.name ?? "").trim(),
    country: node?.country ?? null,
    categories: cats,
    source_url: `${detection.origin}/event/${detection.eventSlug}/exhibitors/${detection.viewId}/${encodeURIComponent(id)}`,
    raw: node,
  };
}

/**
 * Fetch all exhibitors for an Informa Markets event view.
 * Safety: max 50 pages (≈ 2500 exhibitors) to bound runtime.
 */
export async function fetchInformaMarketsExhibitors(
  detection: InformaMarketsDetection,
): Promise<InformaMarketsFetchResult> {
  const all: InformaMarketsExhibitor[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  let total: number | null = null;
  const MAX_PAGES = 50;

  while (pages < MAX_PAGES) {
    const page = await fetchPage(detection, cursor);
    pages++;
    if (total === null && page.totalCount !== null) total = page.totalCount;
    for (const n of page.nodes) {
      const ex = normalizeExhibitor(n, detection);
      if (!ex.name || !ex.external_id || seen.has(ex.external_id)) continue;
      seen.add(ex.external_id);
      all.push(ex);
    }
    if (!page.hasNextPage || !page.endCursor || page.endCursor === cursor) break;
    cursor = page.endCursor;
  }

  return {
    exhibitors: all,
    total_count: total,
    pages_fetched: pages,
    view_id: detection.viewId,
    event_id: detection.eventId,
  };
}

/**
 * High-level helper: given any URL, try to resolve & fetch via Informa Markets.
 * - If URL is already an Informa app URL: fetch directly.
 * - If URL is a marketing page that links to an Informa app URL: follow it.
 * - Otherwise return null detection.
 */
export async function tryInformaMarketsFromUrl(eventUrl: string): Promise<{
  detection: InformaMarketsDetection | null;
  result: InformaMarketsFetchResult | null;
  resolved_url?: string;
  error?: string;
}> {
  let detection = detectInformaMarkets(eventUrl);
  let resolvedUrl: string | undefined;

  if (!detection) {
    // Try to follow a link from the marketing page to the Informa app
    try {
      const resp = await fetch(eventUrl, {
        headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        const html = await resp.text();
        const linked = findInformaMarketsLinkInHtml(html);
        if (linked) {
          resolvedUrl = linked;
          detection = detectInformaMarkets(linked);
        }
      }
    } catch { /* ignore */ }
  }

  if (!detection) return { detection: null, result: null };

  // Try to enrich detection with eventId from SSR (avoids server-side errors when GraphQL needs it).
  if (!detection.eventId) {
    try {
      // viewId is base64 (e.g. "RXZlbnRWaWV3XzEyNDY3NDA=") — keep "=" literal in the path,
      // encodeURIComponent would turn it into "%3D" and Informa returns 404 for the SSR.
      const ssrUrl = `${detection.origin}/event/${detection.eventSlug}/exhibitors/${detection.viewId}`;
      const resp = await fetch(ssrUrl, {
        headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
        signal: AbortSignal.timeout(15_000),
      });
      if (resp.ok) {
        const html = await resp.text();
        detection.eventId = extractEventIdFromHtml(html);
      }
    } catch { /* eventId is best-effort */ }
  }

  try {
    const result = await fetchInformaMarketsExhibitors(detection);
    return { detection, result, resolved_url: resolvedUrl };
  } catch (e) {
    return { detection, result: null, resolved_url: resolvedUrl, error: (e as Error).message };
  }
}
