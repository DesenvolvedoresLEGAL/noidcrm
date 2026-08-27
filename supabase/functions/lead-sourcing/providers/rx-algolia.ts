// RX Global / Reed Exhibitions exhibitor directory provider (generic).
//
// Every RX event site (FENATRAN, Hospitalar, Equipotel, Fispal, Bett Brasil,
// Analitica, etc.) renders its exhibitor list with the shared
// `exhibitor-directory` React widget. The HTML shipped to the browser contains
// no exhibitor at all — the widget queries an Algolia index client-side and the
// generic scrapers only ever see the first virtualized page of cards.
//
// The page HTML *does* embed the public Algolia credentials plus the event ids:
//   "algoliaConfig":{"apiKey":"…","appId":"…"}       → search credentials
//   "eventId":"evt-<uuid>"                            → index = `<eventId>-index`
//   "eventEditionId":"eve-<uuid>"                     → edition filter
//
// With those we page the index directly: deterministic, complete, zero AI and
// zero Firecrawl spend. Detection is structural, so any RX site works.

type FetchLike = typeof fetch;

const REQUEST_TIMEOUT_MS = 25_000;
const HITS_PER_PAGE = 1000;
const MAX_PAGES = 20;

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

function runtimeSecret(name: string): string | null {
  try {
    return (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(name) ?? null;
  } catch {
    return null;
  }
}

export interface RxAlgoliaExhibitor {
  name: string;
  website: string | null;
  booth: string | null;
  country: string | null;
  category: string | null;
  description: string | null;
  profile_url: string | null;
  source_url: string;
}

export interface RxAlgoliaFetchResult {
  exhibitors: RxAlgoliaExhibitor[];
  announced_total: number;
  pages_fetched: number;
  index_name: string;
  event_edition_id: string;
  locale: string;
  access_method: "direct" | "firecrawl_proxy";
}

export interface RxAlgoliaConfig {
  appId: string;
  apiKey: string;
  eventId: string;
  eventEditionId: string;
  locale: string;
}

/** The page ships the config JSON escaped as \x22 sequences and \u002D dashes. */
function unescapePayload(html: string): string {
  return html
    .replace(/\\x22/g, '"')
    .replace(/\\u002[dD]/g, "-")
    .replace(/\\u0026/g, "&")
    .replace(/\\"/g, '"');
}

export function parseRxAlgoliaConfig(html: string, pageUrl: string): RxAlgoliaConfig | null {
  const text = unescapePayload(html);

  const algolia = text.match(/"algoliaConfig"\s*:\s*\{[^}]*"apiKey"\s*:\s*"([^"]+)"[^}]*"appId"\s*:\s*"([^"]+)"/);
  if (!algolia) return null;

  const eventId = text.match(/"eventId"\s*:\s*"(evt-[0-9a-f-]{36})"/i)?.[1] ?? null;
  const eventEditionId = text.match(/"eventEditionId"\s*:\s*"(eve-[0-9a-f-]{36})"/i)?.[1] ?? null;
  if (!eventId || !eventEditionId) return null;

  let locale = "pt-br";
  const localeMatch = pageUrl.match(/\/([a-z]{2}-[a-z]{2})\//i);
  if (localeMatch) locale = localeMatch[1].toLowerCase();

  return { appId: algolia[2], apiKey: algolia[1], eventId, eventEditionId, locale };
}

async function fetchViaFirecrawl(url: string, fetchImpl: FetchLike): Promise<string> {
  const firecrawlKey = runtimeSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured for RX fallback");
  const gatewayMode = firecrawlKey.startsWith("lovc_");
  const lovableKey = runtimeSecret("LOVABLE_API_KEY");
  if (gatewayMode && !lovableKey) throw new Error("LOVABLE_API_KEY not configured for Firecrawl gateway");

  const response = await fetchImpl(
    gatewayMode ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape" : "https://api.firecrawl.dev/v2/scrape",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayMode ? lovableKey : firecrawlKey}`,
        "Content-Type": "application/json",
        ...(gatewayMode ? { "X-Connection-Api-Key": firecrawlKey } : {}),
      },
      body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, proxy: "stealth" }),
      signal: AbortSignal.timeout(75_000),
    },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`RX Firecrawl proxy HTTP ${response.status}: ${body.slice(0, 160)}`);
  const envelope = JSON.parse(body) as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object" ? envelope.data as Record<string, unknown> : envelope;
  const html = typeof data.rawHtml === "string" ? data.rawHtml : null;
  if (!html) throw new Error("RX Firecrawl proxy returned no raw HTML");
  return html;
}

async function fetchPageHtml(url: string, fetchImpl: FetchLike): Promise<{ html: string; method: "direct" | "firecrawl_proxy" }> {
  try {
    const response = await fetchImpl(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return { html: await response.text(), method: "direct" };
    if (response.status !== 403 && response.status !== 429 && response.status < 500) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch {
    // fall through to the proxy
  }
  return { html: await fetchViaFirecrawl(url, fetchImpl), method: "firecrawl_proxy" };
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 2 ? text : null;
}

function pickWebsite(hit: Record<string, unknown>): string | null {
  const candidates = [hit.website, hit.websiteUrl, hit.companyWebsite, hit.url];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (!value) continue;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(normalized);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname)) continue;
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
      continue;
    }
  }
  return null;
}

function pickBooth(hit: Record<string, unknown>): string | null {
  const stands = hit.stands;
  if (Array.isArray(stands) && stands.length > 0) {
    const first = stands[0] as Record<string, unknown>;
    const name = cleanText(first?.name ?? first?.standName);
    if (name) return name;
  }
  return cleanText(hit.standReference ?? hit.stand ?? null);
}

function pickCategory(hit: Record<string, unknown>): string | null {
  const sponsored = hit.sponsoredCategory as Record<string, unknown> | undefined;
  const sponsoredName = cleanText(sponsored?.name);
  if (sponsoredName) return sponsoredName;
  const filters = hit.exhibitorFilters;
  if (Array.isArray(filters)) {
    for (const filter of filters) {
      const values = (filter as Record<string, unknown>)?.values;
      if (Array.isArray(values) && values.length > 0) {
        const name = cleanText((values[0] as Record<string, unknown>)?.name ?? values[0]);
        if (name) return name;
      }
      const name = cleanText((filter as Record<string, unknown>)?.name);
      if (name) return name;
    }
  }
  return null;
}

async function queryAlgolia(
  config: RxAlgoliaConfig,
  page: number,
  fetchImpl: FetchLike,
): Promise<{ hits: Record<string, unknown>[]; nbHits: number; nbPages: number }> {
  const indexName = `${config.eventId}-index`;
  const endpoint = `https://${config.appId.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`;
  const filters = `recordType:exhibitor AND locale:${config.locale} AND eventEditionId:${config.eventEditionId}`;
  const params = `query=&page=${page}&hitsPerPage=${HITS_PER_PAGE}&filters=${encodeURIComponent(filters)}`;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": config.appId,
      "X-Algolia-API-Key": config.apiKey,
    },
    body: JSON.stringify({ params }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`RX Algolia HTTP ${response.status}: ${body.slice(0, 160)}`);
  const parsed = JSON.parse(body) as { hits?: unknown; nbHits?: number; nbPages?: number };
  return {
    hits: Array.isArray(parsed.hits) ? parsed.hits as Record<string, unknown>[] : [],
    nbHits: typeof parsed.nbHits === "number" ? parsed.nbHits : 0,
    nbPages: typeof parsed.nbPages === "number" ? parsed.nbPages : 1,
  };
}

export async function fetchRxAlgoliaExhibitors(
  pageUrl: string,
  fetchImpl: FetchLike = fetch,
): Promise<RxAlgoliaFetchResult> {
  const { html, method } = await fetchPageHtml(pageUrl, fetchImpl);
  const config = parseRxAlgoliaConfig(html, pageUrl);
  if (!config) throw new Error("RX Algolia config not found in page HTML");

  const exhibitors: RxAlgoliaExhibitor[] = [];
  const seen = new Set<string>();
  let announced = 0;
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { hits, nbHits, nbPages } = await queryAlgolia(config, page, fetchImpl);
    announced = nbHits;
    pages = page + 1;

    for (const hit of hits) {
      const name = cleanText(hit.companyName) ?? cleanText(hit.exhibitorName);
      if (!name) continue;
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      exhibitors.push({
        name,
        website: pickWebsite(hit),
        booth: pickBooth(hit),
        country: cleanText(hit.countryName),
        category: pickCategory(hit),
        description: cleanText(hit.description ?? hit.profile ?? null),
        profile_url: typeof hit.detailsPageUrl === "string" ? hit.detailsPageUrl : null,
        source_url: pageUrl,
      });
    }

    if (page + 1 >= nbPages) break;
  }

  // Never let a truncated Algolia page pass as a complete directory.
  if (announced > 0 && exhibitors.length < Math.floor(announced * 0.9)) {
    throw new Error(`RX Algolia incomplete: announced=${announced}, extracted=${exhibitors.length}`);
  }
  if (exhibitors.length === 0) throw new Error("RX Algolia returned no exhibitors");

  return {
    exhibitors,
    announced_total: announced,
    pages_fetched: pages,
    index_name: `${config.eventId}-index`,
    event_edition_id: config.eventEditionId,
    locale: config.locale,
    access_method: method,
  };
}

export async function tryRxAlgoliaFromUrl(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ detection: boolean; result: RxAlgoliaFetchResult | null; error?: string }> {
  let html: string;
  try {
    const fetched = await fetchPageHtml(url, fetchImpl);
    html = fetched.html;
  } catch (error) {
    return { detection: false, result: null, error: String(error) };
  }

  if (!parseRxAlgoliaConfig(html, url)) return { detection: false, result: null };

  try {
    return { detection: true, result: await fetchRxAlgoliaExhibitors(url, fetchImpl) };
  } catch (error) {
    return { detection: true, result: null, error: String(error) };
  }
}
