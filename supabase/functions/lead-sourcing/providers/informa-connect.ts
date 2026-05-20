// Informa Connect Provider — Informa Markets "marketing" sites (Next.js shells
// like abfexpo.com.br, fispalfoodservice.com.br, hospitalar.com, etc.) that
// render an `informa-exhibitor-list-module` block populated client-side from
// the public Informa Connect API at api-connect.informamarkets.com.
//
// This is DISTINCT from informa-markets.ts (which targets the Swapcard-based
// app.informamarkets.com.br GraphQL). Both are Informa, different stacks.
//
// Detection: HTML contains `"eventEditionCode":"<CODE>"` (escaped inside the
// Next.js streaming payload — `self.__next_f.push(...)`). No auth required.
//
// Fetch: GET /api/v1/editions/{code}/listings?lang=pt&page=N&limit=50, follow
// `data.paging.next` until empty. Bounded to 100 pages (5000 exhibitors).

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const API_BASE = "https://api-connect.informamarkets.com";
const MAX_PAGES = 100;
const PAGE_LIMIT = 50;
const PLACEHOLDER_LOGO = "logo_placeholder";

export interface InformaConnectDetection {
  editionCode: string;        // e.g. "BRZ26ABF"
  eventSiteUrl: string;       // origin of the marketing site (e.g. "https://www.abfexpo.com.br")
}

export interface InformaConnectExhibitor {
  external_id: string;        // numeric listing id, stringified
  name: string;
  website: string | null;
  logo_url: string | null;
  source_url: string;         // marketing-site elisting deep link
  booth: string | null;
  categories: string[];
  country: string | null;
  city: string | null;
  state: string | null;
  raw: Record<string, any>;
}

export interface InformaConnectFetchResult {
  exhibitors: InformaConnectExhibitor[];
  edition_code: string;
  total_count: number | null;
  pages_fetched: number;
}

/** Detect Informa Connect marketing site from a fetched HTML page. */
export function detectInformaConnect(
  eventUrl: string,
  html: string,
): InformaConnectDetection | null {
  if (!html) return null;

  // The edition code shows up in the SSR Next.js streaming payload, possibly
  // escaped (\"eventEditionCode\":\"BRZ26ABF\"). Match both forms.
  const re = /\\?"eventEditionCode\\?"\s*:\s*\\?"([A-Z0-9_]+)\\?"/;
  const match = html.match(re);
  if (!match) return null;
  const editionCode = match[1];
  if (!editionCode) return null;

  // Sanity: only claim this provider on pages that actually render the Informa
  // exhibitor-list module OR live on a known Informa-shaped Next.js shell.
  const looksInforma =
    html.includes("informa-exhibitor-list-module") ||
    html.includes("BaseLayout_wrapper") ||
    html.includes("informaCoreTheme");
  if (!looksInforma) return null;

  let eventSiteUrl: string;
  try {
    const u = new URL(eventUrl);
    eventSiteUrl = `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }

  return { editionCode, eventSiteUrl };
}

function normalizeItem(
  item: any,
  detection: InformaConnectDetection,
): InformaConnectExhibitor | null {
  const name = typeof item?.title === "string" ? item.title.trim() : "";
  if (!name) return null;

  const externalId = String(item?.id ?? "");
  const slug = typeof item?.slug === "string" ? item.slug : externalId;

  const logoOriginal: string = item?.logo?.original ?? "";
  const logo_url = logoOriginal && !logoOriginal.includes(PLACEHOLDER_LOGO)
    ? logoOriginal
    : null;

  const website: string | null = (() => {
    const w1 = typeof item?.website_url === "string" ? item.website_url.trim() : "";
    const w2 = typeof item?.company?.website === "string" ? item.company.website.trim() : "";
    return w1 || w2 || null;
  })();

  const booth = item?.booths?.[0]?.booth_number
    ? String(item.booths[0].booth_number)
    : null;

  const categoriesObj = item?.categories;
  const categories: string[] = categoriesObj && typeof categoriesObj === "object"
    ? Object.values(categoriesObj).map((v) => String(v)).filter(Boolean)
    : [];

  const addr = item?.address ?? {};
  const country = typeof addr?.country === "string" && addr.country ? addr.country : null;
  // ABF uses `city`/`state` somewhat inconsistently — keep both raw.
  const city = typeof addr?.city === "string" && addr.city ? addr.city : null;
  const state = typeof addr?.state === "string" && addr.state ? addr.state : null;

  return {
    external_id: externalId,
    name,
    website,
    logo_url,
    source_url: `${detection.eventSiteUrl}/elisting/${encodeURIComponent(slug)}`,
    booth,
    categories,
    country,
    city,
    state,
    raw: item,
  };
}

/** Fetch all exhibitor listings for a given edition code. */
export async function fetchInformaConnectExhibitors(
  detection: InformaConnectDetection,
): Promise<InformaConnectFetchResult> {
  const all: InformaConnectExhibitor[] = [];
  let pagesFetched = 0;
  let totalCount: number | null = null;

  let nextPath: string | null =
    `/api/v1/editions/${encodeURIComponent(detection.editionCode)}/listings?lang=pt&page=1&limit=${PAGE_LIMIT}`;

  while (nextPath && pagesFetched < MAX_PAGES) {
    const url = nextPath.startsWith("http") ? nextPath : `${API_BASE}${nextPath}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "application/json",
        "Referer": `${detection.eventSiteUrl}/`,
      },
    });
    if (!resp.ok) {
      throw new Error(
        `Informa Connect listings fetch failed: HTTP ${resp.status} (page ${pagesFetched + 1})`,
      );
    }

    const json = await resp.json();
    const data = json?.data ?? {};
    const items: any[] = Array.isArray(data?.items) ? data.items : [];

    for (const raw of items) {
      const ex = normalizeItem(raw, detection);
      if (ex) all.push(ex);
    }

    pagesFetched += 1;

    const sizeStr = data?.paging?.size;
    if (totalCount === null && (typeof sizeStr === "string" || typeof sizeStr === "number")) {
      const parsed = Number(sizeStr);
      if (Number.isFinite(parsed) && parsed > 0) totalCount = parsed;
    }

    const nextRaw = data?.paging?.next;
    nextPath = typeof nextRaw === "string" && nextRaw.length > 0 ? nextRaw : null;
  }

  return {
    exhibitors: all,
    edition_code: detection.editionCode,
    total_count: totalCount,
    pages_fetched: pagesFetched,
  };
}

/** High-level helper: given any URL, try to resolve & fetch via Informa Connect. */
export async function tryInformaConnectFromUrl(eventUrl: string): Promise<{
  detection: InformaConnectDetection | null;
  result: InformaConnectFetchResult | null;
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

  const detection = detectInformaConnect(eventUrl, html);
  if (!detection) return { detection: null, result: null };

  try {
    const result = await fetchInformaConnectExhibitors(detection);
    return { detection, result };
  } catch (e) {
    return { detection, result: null, error: (e as Error).message };
  }
}
