// Generic provider for headless WordPress sites (Next.js front-end) that expose
// their listing blocks through `wp-json/custom/v1/node?path=<slug>`.
// The front-end renders only the first page (15 items) server-side, so generic
// scrapers stop there. This provider reads the block's `pagination` metadata and
// walks every page with the `paged` query parameter.
// Known usage: beautyfair.com.br (Beauty Fair) — 471 exhibitors across 32 pages.

type FetchLike = typeof fetch;

export interface WpHeadlessNodeExhibitor {
  name: string;
  website: string | null;
  category: string | null;
  logo_url: string | null;
  source_url: string;
}

export interface WpHeadlessNodeFetchResult {
  exhibitors: WpHeadlessNodeExhibitor[];
  announced_total: number;
  pages_fetched: number;
  api_base: string;
}

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};

const LISTING_BLOCK_TYPES = /^(exhibitors|expositores|sponsors|patrocinadores|brands|marcas|partners|parceiros)$/i;

function unescapeJsonSlashes(raw: string): string {
  return raw.replace(/\\u0026/gi, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

/** Extracts the `wp-json/custom/v1/node` endpoint embedded in the page HTML. */
export function parseWpHeadlessNodeEndpoint(html: string, pageUrl: string): string | null {
  const absolute = html.match(/https?:\/\/[^"'\\\s]*wp-json\/custom\/v1\/node[^"'\\\s]*/i);
  if (absolute) return unescapeJsonSlashes(absolute[0]);

  const relative = html.match(/wp-json\/custom\/v1\/node\?[^"'\\\s]*/i);
  if (!relative) return null;
  try {
    const origin = new URL(pageUrl).origin;
    return unescapeJsonSlashes(`${origin}/${relative[0]}`);
  } catch {
    return null;
  }
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > 120) return null;
  return cleaned;
}

function pickUrl(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (value && typeof value === "object") {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
    const src = (value as Record<string, unknown>).src;
    if (typeof src === "string" && /^https?:\/\//i.test(src)) return src;
  }
  return null;
}

function pickCategory(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const labels = value
    .map((entry) =>
      entry && typeof entry === "object"
        ? normalizeName((entry as Record<string, unknown>).label ?? (entry as Record<string, unknown>).value)
        : normalizeName(entry),
    )
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(" / ") : null;
}

function findListingBlock(payload: unknown): Record<string, unknown> | null {
  const fields = (payload as Record<string, unknown> | null)?.fields as Record<string, unknown> | undefined;
  const blocks = fields?.blocks;
  if (!Array.isArray(blocks)) return null;
  const candidates = blocks.filter((block): block is Record<string, unknown> =>
    Boolean(block) && typeof block === "object" && Array.isArray((block as Record<string, unknown>).list),
  );
  const typed = candidates.find((block) => LISTING_BLOCK_TYPES.test(String(block.type ?? "")));
  return typed ?? candidates[0] ?? null;
}

export function extractWpHeadlessNodeItems(
  block: Record<string, unknown>,
  sourceUrl: string,
): WpHeadlessNodeExhibitor[] {
  const list = Array.isArray(block.list) ? block.list : [];
  const exhibitors: WpHeadlessNodeExhibitor[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const name = normalizeName(item.title ?? item.name);
    if (!name) continue;
    exhibitors.push({
      name,
      website: pickUrl(item.url) ?? pickUrl(item.link),
      category: pickCategory(item.categories),
      logo_url: pickUrl(item.thumbnail) ?? pickUrl(item.image),
      source_url: sourceUrl,
    });
  }
  return exhibitors;
}

function readPagination(block: Record<string, unknown>): { current: number; totalPages: number; totalItems: number } {
  const pagination = (block.pagination ?? {}) as Record<string, unknown>;
  const num = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    current: num(pagination.current_page, 1),
    totalPages: num(pagination.total_pages, 1),
    totalItems: num(pagination.total_items, 0),
  };
}

async function fetchNodePage(
  fetchImpl: FetchLike,
  endpoint: string,
  paged: number,
): Promise<Record<string, unknown>> {
  const url = new URL(endpoint);
  if (paged > 1) url.searchParams.set("paged", String(paged));
  const response = await fetchImpl(url.toString(), {
    headers: BROWSER_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`WP headless node HTTP ${response.status} on page ${paged}: ${body.slice(0, 160)}`);
  }
  return JSON.parse(body) as Record<string, unknown>;
}

export async function fetchWpHeadlessNodeExhibitors(
  endpoint: string,
  fetchImpl: FetchLike = fetch,
): Promise<WpHeadlessNodeFetchResult> {
  const firstPayload = await fetchNodePage(fetchImpl, endpoint, 1);
  const firstBlock = findListingBlock(firstPayload);
  if (!firstBlock) throw new Error("WP headless node: no listing block with items found");

  const { totalPages, totalItems } = readPagination(firstBlock);
  const seen = new Set<string>();
  const exhibitors: WpHeadlessNodeExhibitor[] = [];
  const push = (items: WpHeadlessNodeExhibitor[]) => {
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      exhibitors.push(item);
    }
  };

  push(extractWpHeadlessNodeItems(firstBlock, endpoint));

  let pagesFetched = 1;
  const maxPages = Math.min(totalPages, 200);
  for (let paged = 2; paged <= maxPages; paged++) {
    const payload = await fetchNodePage(fetchImpl, endpoint, paged);
    const block = findListingBlock(payload);
    if (!block) throw new Error(`WP headless node: missing listing block on page ${paged}`);
    push(extractWpHeadlessNodeItems(block, endpoint));
    pagesFetched++;
  }

  if (pagesFetched < maxPages) {
    throw new Error(`WP headless node incomplete pagination: ${pagesFetched}/${maxPages} pages`);
  }
  if (totalItems > 0 && exhibitors.length < Math.floor(totalItems * 0.9)) {
    throw new Error(`WP headless node incomplete extraction: ${exhibitors.length}/${totalItems} items`);
  }

  return { exhibitors, announced_total: totalItems || exhibitors.length, pages_fetched: pagesFetched, api_base: endpoint };
}

export async function tryWpHeadlessNodeFromUrl(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ detection: boolean; result: WpHeadlessNodeFetchResult | null; error?: string }> {
  let html: string;
  try {
    const response = await fetchImpl(url, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return { detection: false, result: null };
    html = await response.text();
  } catch {
    return { detection: false, result: null };
  }

  const endpoint = parseWpHeadlessNodeEndpoint(html, url);
  if (!endpoint) return { detection: false, result: null };

  try {
    return { detection: true, result: await fetchWpHeadlessNodeExhibitors(endpoint, fetchImpl) };
  } catch (error) {
    return { detection: true, result: null, error: String(error) };
  }
}
